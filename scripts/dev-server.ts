import express from 'express'
import { emitRoomClosed, emitRoomState, subscribe } from '../lib/broadcast.js'
import {
  assignScrumMaster,
  castVote,
  createRoom,
  destroyRoom,
  getRoom,
  getRoomPublicInfo,
  joinRoom,
  leaveRoom,
  resetVotes,
  revealVotes,
  serializeRoom,
  setCreatorRole,
  updateParticipantAvatar,
} from '../lib/rooms.js'
import { POKER_CARDS, type PokerCard, type SessionPayload } from '../lib/types.js'

const PORT = Number(process.env.PORT) || 3000

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const MIN_PASSWORD_LENGTH = 4

app.post('/api/rooms/create', (req, res) => {
  const { name, roomId, passwordProtected, password, avatar } = req.body as {
    name?: string
    roomId?: string
    passwordProtected?: boolean
    password?: string
    avatar?: { emoji?: string; color?: string }
  }
  if (!name?.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required' })
    return
  }

  const isProtected = Boolean(passwordProtected)
  const trimmedPassword = password?.trim() ?? ''

  if (isProtected && trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      ok: false,
      error: `Room password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
    return
  }

  const { room, participantId } = createRoom(
    name,
    roomId,
    isProtected ? trimmedPassword : undefined,
    avatar,
  )
  const state = serializeRoom(room, participantId)
  emitRoomState(room.id)

  const payload: SessionPayload = { roomId: room.id, participantId, state }
  res.json({ ok: true, data: payload })
})

app.post('/api/rooms/join', (req, res) => {
  const { roomId, name, password, avatar } = req.body as {
    roomId?: string
    name?: string
    password?: string
    avatar?: { emoji?: string; color?: string }
  }
  if (!roomId?.trim() || !name?.trim()) {
    res.status(400).json({ ok: false, error: 'Room ID and name are required' })
    return
  }

  const room = getRoom(roomId)
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  const needsPassword = room.passwordHash !== null
  const trimmedPassword = password?.trim() ?? ''

  if (needsPassword && !trimmedPassword) {
    res.status(400).json({ ok: false, error: 'Room password is required' })
    return
  }

  const result = joinRoom(roomId, name, trimmedPassword || undefined, avatar)
  if (!result.ok) {
    const errors = {
      not_found: { status: 404, message: 'Room not found' },
      wrong_password: { status: 401, message: 'Incorrect room password' },
      duplicate_name: { status: 409, message: 'That name is already taken in this room' },
      room_full: { status: 403, message: 'This room is full (max 11 including host)' },
    } as const
    const { status, message } = errors[result.reason]
    res.status(status).json({ ok: false, error: message })
    return
  }

  const { room: joinedRoom, participantId } = result
  const state = serializeRoom(joinedRoom, participantId)
  emitRoomState(joinedRoom.id)

  const payload: SessionPayload = { roomId: joinedRoom.id, participantId, state }
  res.json({ ok: true, data: payload })
})

app.get('/api/rooms/:roomId/info', (req, res) => {
  const { roomId } = req.params
  const info = getRoomPublicInfo(roomId)
  if (!info) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }
  res.json({ ok: true, data: info })
})

app.get('/api/rooms/:roomId/stream', (req, res) => {
  const { roomId } = req.params
  const participantId = req.query.participantId

  if (typeof participantId !== 'string') {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  const room = getRoom(roomId)
  if (!room || !room.participants.has(participantId)) {
    res.status(404).json({ ok: false, error: 'Room or participant not found' })
    return
  }

  subscribe(roomId, participantId, res)
})

app.post('/api/rooms/:roomId/role', (req, res) => {
  const { roomId } = req.params
  const { participantId, role } = req.body as {
    participantId?: string
    role?: 'player' | 'scrum_master'
  }

  if (!participantId || !role) {
    res.status(400).json({ ok: false, error: 'participantId and role are required' })
    return
  }

  if (!setCreatorRole(roomId, participantId, role)) {
    res.status(403).json({ ok: false, error: 'Only the room owner can choose their role once' })
    return
  }

  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/scrum-master', (req, res) => {
  const { roomId } = req.params
  const { participantId, scrumMasterId } = req.body as {
    participantId?: string
    scrumMasterId?: string
  }

  if (!participantId || !scrumMasterId) {
    res.status(400).json({ ok: false, error: 'participantId and scrumMasterId are required' })
    return
  }

  if (!assignScrumMaster(roomId, participantId, scrumMasterId)) {
    res.status(403).json({
      ok: false,
      error: 'Only the room owner can assign a scrum master while playing as a participant',
    })
    return
  }

  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/avatar', (req, res) => {
  const { roomId } = req.params
  const { participantId, avatar } = req.body as {
    participantId?: string
    avatar?: { emoji?: string; color?: string }
  }

  if (!participantId || !avatar) {
    res.status(400).json({ ok: false, error: 'participantId and avatar are required' })
    return
  }

  if (!updateParticipantAvatar(roomId, participantId, avatar)) {
    res.status(400).json({ ok: false, error: 'Unable to update avatar' })
    return
  }

  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/vote', (req, res) => {
  const { roomId } = req.params
  const { participantId, value } = req.body as { participantId?: string; value?: PokerCard }

  if (!participantId || !value || !POKER_CARDS.includes(value)) {
    res.status(400).json({ ok: false, error: 'Valid participantId and vote are required' })
    return
  }

  if (!castVote(roomId, participantId, value)) {
    res.status(400).json({ ok: false, error: 'Unable to cast vote' })
    return
  }

  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/reveal', (req, res) => {
  const { roomId } = req.params
  const { participantId } = req.body as { participantId?: string }

  if (!participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!revealVotes(roomId, participantId)) {
    res.status(403).json({ ok: false, error: 'Only the scrum master can reveal votes' })
    return
  }

  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/reset', (req, res) => {
  const { roomId } = req.params
  const { participantId } = req.body as { participantId?: string }

  if (!participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!resetVotes(roomId, participantId)) {
    res.status(403).json({ ok: false, error: 'Only the scrum master can reset votes' })
    return
  }

  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/leave', (req, res) => {
  const { roomId } = req.params
  const { participantId } = req.body as { participantId?: string }

  if (!participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  leaveRoom(participantId, roomId)
  emitRoomState(roomId)
  res.json({ ok: true })
})

app.post('/api/rooms/:roomId/destroy', (req, res) => {
  const { roomId } = req.params
  const { participantId } = req.body as { participantId?: string }

  if (!participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!destroyRoom(roomId, participantId)) {
    res.status(403).json({ ok: false, error: 'Only the room creator can close the room' })
    return
  }

  emitRoomClosed(roomId)
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`Local API server listening on http://localhost:${PORT}`)
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or run with PORT=3001`)
  } else {
    console.error(error)
  }
  process.exit(1)
})
