import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../../lib/broadcast.js'
import { castVote } from '../../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../../lib/http.js'
import { POKER_CARDS, type PokerCard } from '../../../lib/types.js'

interface VoteBody {
  participantId?: string
  value?: PokerCard
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

  const body = await readJsonBody<VoteBody>(req)
  if (!body?.participantId || !body.value || !POKER_CARDS.includes(body.value)) {
    res.status(400).json({ ok: false, error: 'Valid participantId and vote are required' })
    return
  }

  if (!castVote(roomId, body.participantId, body.value)) {
    res.status(400).json({ ok: false, error: 'Unable to cast vote' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
