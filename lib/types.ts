export const POKER_CARDS = ['0', '½', '1', '2', '3', '5', '8', '13', '21', '?', '☕'] as const

export type PokerCard = (typeof POKER_CARDS)[number]

export interface Avatar {
  emoji: string
  color: string
}

export interface Participant {
  id: string
  name: string
  avatar: Avatar
  vote: PokerCard | null
  hasVoted: boolean
}

export type CreatorRole = 'pending' | 'player' | 'scrum_master'

export interface RoomState {
  roomId: string
  revealed: boolean
  creatorId: string
  scrumMasterId: string | null
  creatorRole: CreatorRole | null
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  participants: Participant[]
}

export interface ClientRoomState extends RoomState {
  you: Participant
  isCreator: boolean
  isScrumMaster: boolean
  needsRoleSetup: boolean
  needsScrumMasterAssignment: boolean
  canVote: boolean
  canReveal: boolean
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SessionPayload {
  roomId: string
  participantId: string
  state: ClientRoomState
}
