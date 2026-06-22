import { useCallback, useEffect, useRef, useState } from 'react'
import { clearRoomSession, loadRoomSession, saveRoomSession } from '../lib/roomSession'
import { clearInvitePath, parseInviteRoomId, setInvitePath } from '../lib/urls'
import type { Avatar } from '../lib/avatars'
import { avatarForSession, saveCustomizedAvatar, saveName } from '../lib/userProfile'
import type { ClientRoomState, PokerCard, SessionPayload } from '../types'
import { normalizeRoomState } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string }

async function postJson<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await response.json()) as ApiResponse<T>
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export function usePokerRoom() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<ClientRoomState | null>(null)
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(() => parseInviteRoomId())
  const [restoringSession, setRestoringSession] = useState(() => {
    const urlRoomId = parseInviteRoomId()
    const saved = loadRoomSession()
    return Boolean(saved && (!urlRoomId || urlRoomId === saved.roomId))
  })
  const eventSourceRef = useRef<EventSource | null>(null)
  const sessionRef = useRef<{ roomId: string; participantId: string } | null>(null)
  const restoringRef = useRef(restoringSession)

  useEffect(() => {
    function syncInviteFromUrl() {
      setInviteRoomId(parseInviteRoomId())
    }
    window.addEventListener('popstate', syncInviteFromUrl)
    return () => window.removeEventListener('popstate', syncInviteFromUrl)
  }, [])

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
  }, [])

  const handleRoomClosed = useCallback(
    (message: string) => {
      closeStream()
      sessionRef.current = null
      clearRoomSession()
      setRoom(null)
      clearInvitePath()
      setInviteRoomId(null)
      setRestoringSession(false)
      setError(message)
    },
    [closeStream],
  )

  const finishRestore = useCallback(() => {
    restoringRef.current = false
    setRestoringSession(false)
    clearRoomSession()
  }, [])

  const subscribe = useCallback(
    (roomId: string, participantId: string) => {
      closeStream()
      const session = { roomId: roomId.trim().toUpperCase(), participantId }
      sessionRef.current = session
      saveRoomSession(session)
      setInvitePath(session.roomId)

      const stream = new EventSource(
        `${API_BASE}/api/rooms/${encodeURIComponent(session.roomId)}/stream?participantId=${encodeURIComponent(participantId)}`,
      )

      stream.addEventListener('room:state', (event) => {
        restoringRef.current = false
        setRestoringSession(false)
        setRoom(normalizeRoomState(JSON.parse(event.data) as ClientRoomState))
        setError(null)
        setConnected(true)
      })

      stream.addEventListener('room:closed', (event) => {
        const { message } = JSON.parse(event.data) as { message: string }
        handleRoomClosed(message)
      })

      stream.onerror = () => {
        setConnected(false)
        if (restoringRef.current) {
          finishRestore()
        }
      }

      eventSourceRef.current = stream
    },
    [closeStream, finishRestore, handleRoomClosed],
  )

  useEffect(() => {
    const urlRoomId = parseInviteRoomId()
    const saved = loadRoomSession()
    if (!saved) {
      setRestoringSession(false)
      return
    }
    if (urlRoomId && urlRoomId !== saved.roomId) {
      clearRoomSession()
      setRestoringSession(false)
      return
    }

    restoringRef.current = true
    setRestoringSession(true)
    subscribe(saved.roomId, saved.participantId)
  }, [subscribe])

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE}/api/health`)
        if (!cancelled) setConnected(response.ok)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
      closeStream()
    }
  }, [closeStream])

  const createRoom = useCallback(
    async (
      name: string,
      passwordProtected: boolean,
      password?: string,
      roomId?: string,
    ) => {
      const trimmedName = name.trim()
      const avatar = avatarForSession(trimmedName)

      const result = await postJson<SessionPayload>('/api/rooms/create', {
        name: trimmedName,
        passwordProtected,
        password: passwordProtected ? password : undefined,
        roomId: roomId?.trim() || undefined,
        avatar,
      })

      if (!result.ok) {
        setError(result.error)
        return false
      }

      saveName(trimmedName)
      setRoom(normalizeRoomState(result.data.state))
      subscribe(result.data.roomId, result.data.participantId)
      setConnected(true)
      setInviteRoomId(null)
      return true
    },
    [subscribe],
  )

  const joinRoom = useCallback(
    async (roomId: string, name: string, password?: string) => {
      const trimmedName = name.trim()
      const avatar = avatarForSession(trimmedName)

      const result = await postJson<SessionPayload>('/api/rooms/join', {
        roomId: roomId.trim().toUpperCase(),
        name: trimmedName,
        password: password?.trim() || undefined,
        avatar,
      })

      if (!result.ok) {
        setError(result.error)
        return false
      }

      saveName(trimmedName)
      setRoom(normalizeRoomState(result.data.state))
      subscribe(result.data.roomId, result.data.participantId)
      setConnected(true)
      return true
    },
    [subscribe],
  )

  const withSession = useCallback(
    async (path: string, body: Record<string, unknown> = {}) => {
      const session = sessionRef.current
      if (!session) return

      await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}${path}`, {
        participantId: session.participantId,
        ...body,
      })
    },
    [],
  )

  const castVote = useCallback(
    (value: PokerCard) => {
      void withSession('/vote', { value })
    },
    [withSession],
  )

  const revealVotes = useCallback(() => {
    void withSession('/reveal')
  }, [withSession])

  const resetVotes = useCallback(() => {
    void withSession('/reset')
  }, [withSession])

  const chooseRole = useCallback(
    async (role: 'player' | 'scrum_master') => {
      await withSession('/role', { role })
    },
    [withSession],
  )

  const assignScrumMaster = useCallback(
    async (scrumMasterId: string) => {
      await withSession('/scrum-master', { scrumMasterId })
    },
    [withSession],
  )

  const updateAvatar = useCallback(
    async (avatar: Avatar, displayName: string) => {
      await withSession('/avatar', { avatar })
      saveCustomizedAvatar(displayName, avatar)
    },
    [withSession],
  )

  const killRoom = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return false

    const result = await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/destroy`, {
      participantId: session.participantId,
    })

    if (!result.ok) {
      setError(result.error)
      return false
    }

    handleRoomClosed('You closed the room.')
    return true
  }, [handleRoomClosed])

  const leaveRoom = useCallback(async () => {
    const session = sessionRef.current
    if (session) {
      await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/leave`, {
        participantId: session.participantId,
      })
    }

    closeStream()
    sessionRef.current = null
    clearRoomSession()
    setRoom(null)
    setError(null)
    clearInvitePath()
    setInviteRoomId(null)
    setRestoringSession(false)
  }, [closeStream])

  return {
    connected,
    error,
    room,
    inviteRoomId,
    restoringSession,
    createRoom,
    joinRoom,
    castVote,
    revealVotes,
    resetVotes,
    chooseRole,
    assignScrumMaster,
    updateAvatar,
    killRoom,
    leaveRoom,
    clearError: () => setError(null),
  }
}
