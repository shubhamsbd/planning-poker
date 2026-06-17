import { randomBytes, randomUUID } from 'node:crypto'
import { parseAvatar } from './avatars.js'
import { createPasswordRecord, verifyPassword } from './password.js'
import type { ClientRoomState, Participant, PokerCard } from './types.js'

/** Creator + up to 10 teammates */
export const MAX_PARTICIPANTS = 11

export type CreatorRole = 'pending' | 'player' | 'scrum_master'

interface Room {
  id: string
  revealed: boolean
  creatorId: string
  creatorRole: CreatorRole
  scrumMasterId: string | null
  passwordSalt: string | null
  passwordHash: string | null
  participants: Map<string, Participant>
}

const rooms = new Map<string, Room>()

export type JoinFailureReason =
  | 'not_found'
  | 'wrong_password'
  | 'duplicate_name'
  | 'room_full'

export interface RoomPublicInfo {
  roomId: string
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  isFull: boolean
}

function generateRoomId(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}

function isPasswordProtected(room: Room): boolean {
  return room.passwordHash !== null && room.passwordSalt !== null
}

function toPublicParticipant(
  participant: Participant,
  revealed: boolean,
  viewerId: string,
): Participant {
  if (revealed || participant.id === viewerId) return participant
  return {
    ...participant,
    vote: null,
  }
}

export function createRoom(
  name: string,
  preferredId?: string,
  password?: string,
  avatarInput?: unknown,
): { room: Room; participantId: string } {
  let id = preferredId?.trim().toUpperCase() || generateRoomId()
  if (rooms.has(id)) {
    id = generateRoomId()
  }

  const participantId = randomUUID()
  const trimmedPassword = password?.trim() ?? ''
  const credentials =
    trimmedPassword.length > 0 ? createPasswordRecord(trimmedPassword) : null

  const trimmedName = name.trim()
  const host: Participant = {
    id: participantId,
    name: trimmedName,
    avatar: parseAvatar(avatarInput, trimmedName),
    vote: null,
    hasVoted: false,
  }

  const room: Room = {
    id,
    revealed: false,
    creatorId: participantId,
    creatorRole: 'pending',
    scrumMasterId: null,
    passwordSalt: credentials?.salt ?? null,
    passwordHash: credentials?.hash ?? null,
    participants: new Map([[participantId, host]]),
  }

  rooms.set(id, room)
  return { room, participantId }
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase())
}

export function getRoomPublicInfo(roomId: string): RoomPublicInfo | null {
  const room = getRoom(roomId)
  if (!room) return null

  return {
    roomId: room.id,
    passwordProtected: isPasswordProtected(room),
    participantCount: room.participants.size,
    maxParticipants: MAX_PARTICIPANTS,
    isFull: room.participants.size >= MAX_PARTICIPANTS,
  }
}

export function joinRoom(
  roomId: string,
  name: string,
  password?: string,
  avatarInput?: unknown,
):
  | { ok: true; room: Room; participantId: string }
  | { ok: false; reason: JoinFailureReason } {
  const room = getRoom(roomId)
  if (!room) return { ok: false, reason: 'not_found' }

  if (room.participants.size >= MAX_PARTICIPANTS) {
    return { ok: false, reason: 'room_full' }
  }

  if (isPasswordProtected(room)) {
    const trimmedPassword = password?.trim() ?? ''
    if (
      !room.passwordSalt ||
      !room.passwordHash ||
      !verifyPassword(trimmedPassword, room.passwordSalt, room.passwordHash)
    ) {
      return { ok: false, reason: 'wrong_password' }
    }
  }

  const trimmedName = name.trim()
  const duplicate = [...room.participants.values()].some(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
  )
  if (duplicate) return { ok: false, reason: 'duplicate_name' }

  const participantId = randomUUID()
  room.participants.set(participantId, {
    id: participantId,
    name: trimmedName,
    avatar: parseAvatar(avatarInput, trimmedName),
    vote: null,
    hasVoted: false,
  })

  return { ok: true, room, participantId }
}

export function updateParticipantAvatar(
  roomId: string,
  participantId: string,
  avatarInput: unknown,
): boolean {
  const room = getRoom(roomId)
  if (!room) return false

  const participant = room.participants.get(participantId)
  if (!participant) return false

  participant.avatar = parseAvatar(avatarInput, participant.name)
  return true
}

export function setCreatorRole(
  roomId: string,
  requesterId: string,
  role: 'player' | 'scrum_master',
): boolean {
  const room = getRoom(roomId)
  if (!room || room.creatorId !== requesterId || room.creatorRole !== 'pending') {
    return false
  }

  room.creatorRole = role
  if (role === 'scrum_master') {
    room.scrumMasterId = requesterId
  } else {
    room.scrumMasterId = null
  }

  return true
}

export function assignScrumMaster(
  roomId: string,
  requesterId: string,
  scrumMasterId: string,
): boolean {
  const room = getRoom(roomId)
  if (!room || room.creatorId !== requesterId || room.creatorRole !== 'player') {
    return false
  }

  if (scrumMasterId === requesterId) return false
  if (!room.participants.has(scrumMasterId)) return false

  room.scrumMasterId = scrumMasterId
  return true
}

export function leaveRoom(participantId: string, roomId: string): void {
  const room = getRoom(roomId)
  if (!room) return

  room.participants.delete(participantId)

  if (room.scrumMasterId === participantId) {
    room.scrumMasterId = null
  }

  if (room.participants.size === 0) {
    rooms.delete(room.id)
  }
}

export function destroyRoom(roomId: string, requesterId: string): boolean {
  const room = getRoom(roomId)
  if (!room || room.creatorId !== requesterId) return false
  rooms.delete(room.id)
  return true
}

export function castVote(roomId: string, participantId: string, value: PokerCard): boolean {
  const room = getRoom(roomId)
  if (!room || room.revealed) return false
  if (room.scrumMasterId === participantId) return false

  const participant = room.participants.get(participantId)
  if (!participant) return false

  participant.vote = value
  participant.hasVoted = true
  return true
}

export function revealVotes(roomId: string, requesterId: string): boolean {
  const room = getRoom(roomId)
  if (!room || room.scrumMasterId !== requesterId) return false
  room.revealed = true
  return true
}

export function resetVotes(roomId: string, requesterId: string): boolean {
  const room = getRoom(roomId)
  if (!room || room.scrumMasterId !== requesterId) return false

  room.revealed = false
  for (const participant of room.participants.values()) {
    participant.vote = null
    participant.hasVoted = false
  }
  return true
}

export function serializeRoom(room: Room, viewerId: string): ClientRoomState {
  const you = room.participants.get(viewerId)
  if (!you) {
    throw new Error('Participant not in room')
  }

  const isCreator = room.creatorId === viewerId
  const isScrumMaster = room.scrumMasterId === viewerId
  const needsRoleSetup = isCreator && room.creatorRole === 'pending'
  const needsScrumMasterAssignment =
    isCreator && room.creatorRole === 'player' && room.scrumMasterId === null

  return {
    roomId: room.id,
    revealed: room.revealed,
    creatorId: room.creatorId,
    scrumMasterId: room.scrumMasterId,
    creatorRole: isCreator ? room.creatorRole : null,
    isCreator,
    isScrumMaster,
    needsRoleSetup,
    needsScrumMasterAssignment,
    canVote: room.scrumMasterId !== viewerId,
    canReveal: isScrumMaster,
    passwordProtected: isPasswordProtected(room),
    participantCount: room.participants.size,
    maxParticipants: MAX_PARTICIPANTS,
    you: toPublicParticipant(you, room.revealed, viewerId),
    participants: [...room.participants.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => toPublicParticipant(p, room.revealed, viewerId)),
  }
}
