import type { VercelRequest, VercelResponse } from '@vercel/node'
import { subscribe } from '../../../lib/broadcast.js'
import { getRoom } from '../../../lib/rooms.js'
import { methodNotAllowed } from '../../../lib/http.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const roomId = req.query.roomId
  const participantId = req.query.participantId

  if (typeof roomId !== 'string' || typeof participantId !== 'string') {
    res.status(400).json({ ok: false, error: 'roomId and participantId are required' })
    return
  }

  const room = getRoom(roomId)
  if (!room || !room.participants.has(participantId)) {
    res.status(404).json({ ok: false, error: 'Room or participant not found' })
    return
  }

  subscribe(roomId, participantId, res)
}
