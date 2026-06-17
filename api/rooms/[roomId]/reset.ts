import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../../lib/broadcast.js'
import { resetVotes } from '../../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../../lib/http.js'

interface HostBody {
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

  const body = await readJsonBody<HostBody>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!resetVotes(roomId, body.participantId)) {
    res.status(403).json({ ok: false, error: 'Only the scrum master can reset votes' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
