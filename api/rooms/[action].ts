import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleCreateRoom, handleJoinRoom } from '../../lib/roomApiHandlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action

  if (typeof action !== 'string') {
    res.status(404).json({ ok: false, error: 'Not found' })
    return
  }

  if (action === 'create') {
    await handleCreateRoom(req, res)
    return
  }

  if (action === 'join') {
    await handleJoinRoom(req, res)
    return
  }

  res.status(404).json({ ok: false, error: 'Not found' })
}
