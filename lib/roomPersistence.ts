import { Redis } from '@upstash/redis'
import type { Participant } from './types.js'

const ROOM_KEY_PREFIX = 'room:'
const ROOM_TTL_SECONDS = 60 * 60 * 24

export interface PersistedRoom {
  id: string
  revealed: boolean
  creatorId: string
  creatorRole: 'pending' | 'player' | 'scrum_master'
  scrumMasterId: string | null
  passwordSalt: string | null
  passwordHash: string | null
  participants: Participant[]
  revision: number
}

const memoryRooms = new Map<string, PersistedRoom>()

let redisClient: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    redisClient = null
    return null
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

export function isPersistentStorageEnabled(): boolean {
  return getRedis() !== null
}

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId.toUpperCase()}`
}

export async function loadPersistedRoom(roomId: string): Promise<PersistedRoom | null> {
  const normalizedId = roomId.toUpperCase()
  const redis = getRedis()

  if (redis) {
    const stored = await redis.get<PersistedRoom>(roomKey(normalizedId))
    return stored ?? null
  }

  return memoryRooms.get(normalizedId) ?? null
}

export async function savePersistedRoom(room: PersistedRoom): Promise<void> {
  const normalizedId = room.id.toUpperCase()
  const payload: PersistedRoom = { ...room, id: normalizedId, revision: room.revision + 1 }
  const redis = getRedis()

  if (redis) {
    await redis.set(roomKey(normalizedId), payload, { ex: ROOM_TTL_SECONDS })
    return
  }

  memoryRooms.set(normalizedId, payload)
}

export async function deletePersistedRoom(roomId: string): Promise<void> {
  const normalizedId = roomId.toUpperCase()
  const redis = getRedis()

  if (redis) {
    await redis.del(roomKey(normalizedId))
    return
  }

  memoryRooms.delete(normalizedId)
}

export async function persistedRoomExists(roomId: string): Promise<boolean> {
  const room = await loadPersistedRoom(roomId)
  return room !== null
}
