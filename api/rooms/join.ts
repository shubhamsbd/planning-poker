import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../lib/broadcast.js'
import { getRoom, joinRoom, serializeRoom } from '../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../lib/http.js'
import type { SessionPayload } from '../../lib/types.js'

interface JoinBody {
  roomId?: string
  name?: string
  password?: string
  avatar?: { emoji?: string; color?: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<JoinBody>(req)
  if (!body?.roomId?.trim() || !body?.name?.trim()) {
    res.status(400).json({ ok: false, error: 'Room ID and name are required' })
    return
  }

  const room = getRoom(body.roomId)
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  const passwordProtected = room.passwordHash !== null
  const password = body.password?.trim() ?? ''

  if (passwordProtected && !password) {
    res.status(400).json({ ok: false, error: 'Room password is required' })
    return
  }

  const result = joinRoom(body.roomId, body.name, password || undefined, body.avatar)
  if (!result.ok) {
    const errors: Record<typeof result.reason, { status: number; message: string }> = {
      not_found: { status: 404, message: 'Room not found' },
      wrong_password: { status: 401, message: 'Incorrect room password' },
      duplicate_name: { status: 409, message: 'That name is already taken in this room' },
      room_full: { status: 403, message: 'This room is full (max 11 including host)' },
    }
    const { status, message } = errors[result.reason]
    res.status(status).json({ ok: false, error: message })
    return
  }

  const { room: joinedRoom, participantId } = result
  const state = serializeRoom(joinedRoom, participantId)
  emitRoomState(joinedRoom.id)

  const payload: SessionPayload = {
    roomId: joinedRoom.id,
    participantId,
    state,
  }

  res.status(200).json({ ok: true, data: payload })
}
