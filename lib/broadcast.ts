import type { ServerResponse } from 'node:http'
import { getRoom, serializeRoom } from './rooms.js'

export type SseResponse = Pick<ServerResponse, 'setHeader' | 'write' | 'on' | 'end'>

interface Subscriber {
  roomId: string
  participantId: string
  res: SseResponse
  heartbeat: ReturnType<typeof setInterval>
}

const subscribers = new Set<Subscriber>()

function sendState(subscriber: Subscriber): void {
  const room = getRoom(subscriber.roomId)
  if (!room) return

  try {
    const state = serializeRoom(room, subscriber.participantId)
    subscriber.res.write(`event: room:state\ndata: ${JSON.stringify(state)}\n\n`)
  } catch {
    // Participant no longer in room.
  }
}

function removeSubscriber(subscriber: Subscriber): void {
  clearInterval(subscriber.heartbeat)
  subscribers.delete(subscriber)
}

export function subscribe(roomId: string, participantId: string, res: SseResponse): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const subscriber: Subscriber = {
    roomId: roomId.toUpperCase(),
    participantId,
    res,
    heartbeat: setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 15000),
  }

  subscribers.add(subscriber)
  sendState(subscriber)

  res.on('close', () => {
    removeSubscriber(subscriber)
  })
}

export function emitRoomState(roomId: string): void {
  const normalizedRoomId = roomId.toUpperCase()
  for (const subscriber of subscribers) {
    if (subscriber.roomId === normalizedRoomId) {
      sendState(subscriber)
    }
  }
}

export function emitRoomClosed(roomId: string): void {
  const normalizedRoomId = roomId.toUpperCase()
  const payload = JSON.stringify({ message: 'The room was closed by the host.' })

  for (const subscriber of subscribers) {
    if (subscriber.roomId !== normalizedRoomId) continue
    subscriber.res.write(`event: room:closed\ndata: ${payload}\n\n`)
    removeSubscriber(subscriber)
    subscriber.res.end?.()
  }
}
