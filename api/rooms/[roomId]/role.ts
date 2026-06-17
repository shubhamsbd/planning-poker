import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../../lib/broadcast.js'
import { setCreatorRole } from '../../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../../lib/http.js'

interface RoleBody {
  participantId?: string
  role?: 'player' | 'scrum_master'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const roomId = req.query.roomId
  if (typeof roomId !== 'string') {
    res.status(400).json({ ok: false, error: 'Room ID is required' })
    return
  }

  const body = await readJsonBody<RoleBody>(req)
  if (!body?.participantId || !body.role) {
    res.status(400).json({ ok: false, error: 'participantId and role are required' })
    return
  }

  if (!setCreatorRole(roomId, body.participantId, body.role)) {
    res.status(403).json({ ok: false, error: 'Only the room owner can choose their role once' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
