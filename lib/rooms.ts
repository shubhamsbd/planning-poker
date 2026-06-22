import { randomBytes, randomUUID } from 'node:crypto'
import { parseAvatar } from './avatars.js'
import { createPasswordRecord, verifyPassword } from './password.js'
import {
  deletePersistedRoom,
  loadPersistedRoom,
  persistedRoomExists,
  savePersistedRoom,
  type PersistedRoom,
} from './roomPersistence.js'
import type { ClientRoomState, Participant, PokerCard } from './types.js'

/** Creator + up to 10 teammates */
export const MAX_PARTICIPANTS = 11

export type CreatorRole = 'pending' | 'player' | 'scrum_master'

export interface Room {
  id: string
  revealed: boolean
  creatorId: string
  creatorRole: CreatorRole
  scrumMasterId: string | null
  passwordSalt: string | null
  passwordHash: string | null
  participants: Map<string, Participant>
  revision: number
}

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

function toRoom(persisted: PersistedRoom): Room {
  return {
    ...persisted,
    participants: new Map(persisted.participants.map((participant) => [participant.id, participant])),
  }
}

function toPersisted(room: Room): PersistedRoom {
  return {
    id: room.id,
    revealed: room.revealed,
    creatorId: room.creatorId,
    creatorRole: room.creatorRole,
    scrumMasterId: room.scrumMasterId,
    passwordSalt: room.passwordSalt,
    passwordHash: room.passwordHash,
    participants: [...room.participants.values()],
    revision: room.revision,
  }
}

async function persistRoom(room: Room): Promise<Room> {
  await savePersistedRoom(toPersisted(room))
  const reloaded = await loadPersistedRoom(room.id)
  return reloaded ? toRoom(reloaded) : room
}

export async function createRoom(
  name: string,
  preferredId?: string,
  password?: string,
  avatarInput?: unknown,
): Promise<{ room: Room; participantId: string }> {
  let id = preferredId?.trim().toUpperCase() || generateRoomId()
  if (await persistedRoomExists(id)) {
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
    revision: 0,
  }

  const saved = await persistRoom(room)
  return { room: saved, participantId }
}

export async function getRoom(roomId: string): Promise<Room | undefined> {
  const persisted = await loadPersistedRoom(roomId)
  return persisted ? toRoom(persisted) : undefined
}

export async function getRoomPublicInfo(roomId: string): Promise<RoomPublicInfo | null> {
  const room = await getRoom(roomId)
  if (!room) return null

  return {
    roomId: room.id,
    passwordProtected: isPasswordProtected(room),
    participantCount: room.participants.size,
    maxParticipants: MAX_PARTICIPANTS,
    isFull: room.participants.size >= MAX_PARTICIPANTS,
  }
}

export async function joinRoom(
  roomId: string,
  name: string,
  password?: string,
  avatarInput?: unknown,
): Promise<
  | { ok: true; room: Room; participantId: string }
  | { ok: false; reason: JoinFailureReason }
> {
  const room = await getRoom(roomId)
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

  const saved = await persistRoom(room)
  return { ok: true, room: saved, participantId }
}

export async function updateParticipantAvatar(
  roomId: string,
  participantId: string,
  avatarInput: unknown,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room) return false

  const participant = room.participants.get(participantId)
  if (!participant) return false

  participant.avatar = parseAvatar(avatarInput, participant.name)
  await persistRoom(room)
  return true
}

export async function setCreatorRole(
  roomId: string,
  requesterId: string,
  role: 'player' | 'scrum_master',
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.creatorId !== requesterId || room.creatorRole !== 'pending') {
    return false
  }

  room.creatorRole = role
  if (role === 'scrum_master') {
    room.scrumMasterId = requesterId
  } else {
    room.scrumMasterId = null
  }

  await persistRoom(room)
  return true
}

export async function assignScrumMaster(
  roomId: string,
  requesterId: string,
  scrumMasterId: string,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.creatorId !== requesterId || room.creatorRole !== 'player') {
    return false
  }

  if (scrumMasterId === requesterId) return false
  if (!room.participants.has(scrumMasterId)) return false

  room.scrumMasterId = scrumMasterId
  await persistRoom(room)
  return true
}

export async function leaveRoom(participantId: string, roomId: string): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) return

  room.participants.delete(participantId)

  if (room.scrumMasterId === participantId) {
    room.scrumMasterId = null
  }

  if (room.participants.size === 0) {
    await deletePersistedRoom(room.id)
    return
  }

  await persistRoom(room)
}

export async function destroyRoom(roomId: string, requesterId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.creatorId !== requesterId) return false
  await deletePersistedRoom(room.id)
  return true
}

export async function castVote(
  roomId: string,
  participantId: string,
  value: PokerCard,
): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.revealed) return false
  if (room.scrumMasterId === participantId) return false

  const participant = room.participants.get(participantId)
  if (!participant) return false

  participant.vote = value
  participant.hasVoted = true
  await persistRoom(room)
  return true
}

export async function revealVotes(roomId: string, requesterId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.scrumMasterId !== requesterId) return false
  room.revealed = true
  await persistRoom(room)
  return true
}

export async function resetVotes(roomId: string, requesterId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  if (!room || room.scrumMasterId !== requesterId) return false

  room.revealed = false
  for (const participant of room.participants.values()) {
    participant.vote = null
    participant.hasVoted = false
  }
  await persistRoom(room)
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
