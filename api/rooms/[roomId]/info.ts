import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getRoomPublicInfo } from '../../../lib/rooms.js'
import { methodNotAllowed } from '../../../lib/http.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const roomId = req.query.roomId
  if (typeof roomId !== 'string') {
    res.status(400).json({ ok: false, error: 'Room ID is required' })
    return
  }

  const info = getRoomPublicInfo(roomId)
  if (!info) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  res.status(200).json({ ok: true, data: info })
}
