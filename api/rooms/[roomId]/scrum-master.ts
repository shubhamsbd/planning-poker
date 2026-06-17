import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../../lib/broadcast.js'
import { assignScrumMaster } from '../../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../../lib/http.js'

interface AssignBody {
  participantId?: string
  scrumMasterId?: string
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

  const body = await readJsonBody<AssignBody>(req)
  if (!body?.participantId || !body.scrumMasterId) {
    res.status(400).json({ ok: false, error: 'participantId and scrumMasterId are required' })
    return
  }

  if (!assignScrumMaster(roomId, body.participantId, body.scrumMasterId)) {
    res.status(403).json({
      ok: false,
      error: 'Only the room owner can assign a scrum master while playing as a participant',
    })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
