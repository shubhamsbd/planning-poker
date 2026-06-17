import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../lib/broadcast.js'
import { createRoom, serializeRoom } from '../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../lib/http.js'
import type { SessionPayload } from '../../lib/types.js'

interface CreateBody {
  name?: string
  roomId?: string
  passwordProtected?: boolean
  password?: string
  avatar?: { emoji?: string; color?: string }
}

const MIN_PASSWORD_LENGTH = 4

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<CreateBody>(req)
  if (!body?.name?.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required' })
    return
  }

  const passwordProtected = Boolean(body.passwordProtected)
  const password = body.password?.trim() ?? ''

  if (passwordProtected && password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      ok: false,
      error: `Room password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
    return
  }

  const { room, participantId } = createRoom(
    body.name,
    body.roomId,
    passwordProtected ? password : undefined,
    body.avatar,
  )
  const state = serializeRoom(room, participantId)
  emitRoomState(room.id)

  const payload: SessionPayload = {
    roomId: room.id,
    participantId,
    state,
  }

  res.status(200).json({ ok: true, data: payload })
}
