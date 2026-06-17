import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomClosed } from '../../../lib/broadcast.js'
import { destroyRoom } from '../../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../../lib/http.js'

interface DestroyBody {
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

  const body = await readJsonBody<DestroyBody>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!destroyRoom(roomId, body.participantId)) {
    res.status(403).json({ ok: false, error: 'Only the room creator can close the room' })
    return
  }

  emitRoomClosed(roomId)
  res.status(200).json({ ok: true })
}
