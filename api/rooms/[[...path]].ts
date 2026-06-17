import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleCreateRoom,
  handleJoinRoom,
  handleRoomAction,
  handleRoomInfo,
  handleRoomStream,
  pathSegments,
} from '../../lib/roomApiHandlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = pathSegments(req)

  if (segments.length === 1 && segments[0] === 'create') {
    await handleCreateRoom(req, res)
    return
  }

  if (segments.length === 1 && segments[0] === 'join') {
    await handleJoinRoom(req, res)
    return
  }

  if (segments.length === 2) {
    const [roomId, action] = segments

    if (action === 'info') {
      handleRoomInfo(req, res, roomId)
      return
    }

    if (action === 'stream') {
      handleRoomStream(req, res, roomId)
      return
    }

    await handleRoomAction(req, res, roomId, action)
    return
  }

  res.status(404).json({ ok: false, error: 'Not found' })
}
