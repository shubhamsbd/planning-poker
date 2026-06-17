import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../../lib/broadcast.js'
import { leaveRoom } from '../../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../../lib/http.js'

interface LeaveBody {
  participantId?: string
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

  const body = await readJsonBody<LeaveBody>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  leaveRoom(body.participantId, roomId)
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
