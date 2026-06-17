import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomState } from '../../lib/broadcast.js'
import { updateParticipantAvatar } from '../../lib/rooms.js'
import { methodNotAllowed, readJsonBody } from '../../lib/http.js'

interface AvatarBody {
  participantId?: string
  avatar?: { emoji?: string; color?: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const roomId = req.query.roomId as string
  const body = await readJsonBody<AvatarBody>(req)

  if (!body?.participantId || !body.avatar) {
    res.status(400).json({ ok: false, error: 'participantId and avatar are required' })
    return
  }

  if (!updateParticipantAvatar(roomId, body.participantId, body.avatar)) {
    res.status(400).json({ ok: false, error: 'Unable to update avatar' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
