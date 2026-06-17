import type { CSSProperties } from 'react'
import { defaultAvatar, type Avatar } from './lib/avatars'

export const POKER_CARDS = ['0', '½', '1', '2', '3', '5', '8', '13', '21', '?', '☕'] as const

export type PokerCard = (typeof POKER_CARDS)[number]

export type CreatorRole = 'pending' | 'player' | 'scrum_master'

export type { Avatar }

export interface Participant {
  id: string
  name: string
  avatar?: Avatar
  vote: PokerCard | null
  hasVoted: boolean
}

export interface ClientRoomState {
  roomId: string
  revealed: boolean
  creatorId: string
  scrumMasterId: string | null
  creatorRole: CreatorRole | null
  isCreator: boolean
  isScrumMaster: boolean
  needsRoleSetup: boolean
  needsScrumMasterAssignment: boolean
  canVote: boolean
  canReveal: boolean
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  you: Participant
  participants: Participant[]
}

export interface RoomPublicInfo {
  roomId: string
  passwordProtected: boolean
  participantCount: number
  maxParticipants: number
  isFull: boolean
}

export interface SessionPayload {
  roomId: string
  participantId: string
  state: ClientRoomState
}

const NUMERIC_VALUES: Record<string, number> = {
  '0': 0,
  '½': 0.5,
  '1': 1,
  '2': 2,
  '3': 3,
  '5': 5,
  '8': 8,
  '13': 13,
  '21': 21,
}

export interface VoteStats {
  count: number
  average: number
  min: number
  max: number
}

export interface MajorityResult {
  majorityCard: PokerCard | null
  majorityCount: number
  nearestPocketCard: PokerCard | null
  stats: VoteStats | null
}

export function normalizeRoomState(state: ClientRoomState): ClientRoomState {
  const participantCount = state.participantCount ?? state.participants.length
  const maxParticipants = state.maxParticipants ?? 11
  const scrumMasterId = state.scrumMasterId ?? null
  const isCreator = state.isCreator ?? state.creatorId === state.you.id
  const isScrumMaster = state.isScrumMaster ?? scrumMasterId === state.you.id
  const creatorRole = isCreator ? (state.creatorRole ?? 'pending') : null
  const needsRoleSetup = isCreator && creatorRole === 'pending'
  const needsScrumMasterAssignment =
    isCreator && creatorRole === 'player' && scrumMasterId === null

  const withAvatar = (participant: Participant): Participant & { avatar: Avatar } => ({
    ...participant,
    avatar: participant.avatar ?? defaultAvatar(participant.name),
  })

  const you = withAvatar(state.you)
  const participants = state.participants.map(withAvatar)

  return {
    ...state,
    scrumMasterId,
    creatorRole,
    isCreator,
    isScrumMaster,
    needsRoleSetup,
    needsScrumMasterAssignment,
    canVote: state.canVote ?? scrumMasterId !== state.you.id,
    canReveal: state.canReveal ?? isScrumMaster,
    passwordProtected: Boolean(state.passwordProtected),
    participantCount,
    maxParticipants,
    you,
    participants,
  }
}

export function nearestPocketCard(value: number): PokerCard {
  let nearestValue = NUMERIC_VALUES['0']
  let minDiff = Infinity

  for (const numeric of Object.values(NUMERIC_VALUES)) {
    const diff = Math.abs(numeric - value)
    if (diff < minDiff) {
      minDiff = diff
      nearestValue = numeric
    }
  }

  for (const [card, numeric] of Object.entries(NUMERIC_VALUES)) {
    if (numeric === nearestValue) return card as PokerCard
  }

  return '0'
}

export function getVoteStats(participants: Participant[], revealed: boolean): VoteStats | null {
  if (!revealed) return null

  const numericVotes = participants
    .map((p) => p.vote)
    .filter((vote): vote is PokerCard => vote != null && vote in NUMERIC_VALUES)
    .map((vote) => NUMERIC_VALUES[vote])

  if (numericVotes.length === 0) return null

  const sum = numericVotes.reduce((acc, value) => acc + value, 0)
  const average = sum / numericVotes.length

  return {
    count: numericVotes.length,
    average: Number(average.toFixed(1)),
    min: Math.min(...numericVotes),
    max: Math.max(...numericVotes),
  }
}

export function getMajorityResult(participants: Participant[], revealed: boolean): MajorityResult {
  if (!revealed) {
    return {
      majorityCard: null,
      majorityCount: 0,
      nearestPocketCard: null,
      stats: null,
    }
  }

  const stats = getVoteStats(participants, true)
  const numericVotes = participants
    .map((p) => p.vote)
    .filter((vote): vote is PokerCard => vote != null && vote in NUMERIC_VALUES)

  if (numericVotes.length === 0) {
    return {
      majorityCard: null,
      majorityCount: 0,
      nearestPocketCard: null,
      stats,
    }
  }

  const counts = new Map<PokerCard, number>()
  for (const vote of numericVotes) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1)
  }

  let majorityCard: PokerCard | null = null
  let majorityCount = 0

  for (const [card, count] of counts) {
    if (count > majorityCount) {
      majorityCard = card
      majorityCount = count
    }
  }

  const pocketCard = stats ? nearestPocketCard(stats.average) : null

  return {
    majorityCard,
    majorityCount,
    nearestPocketCard: pocketCard,
    stats,
  }
}

export function getSeatStyle(index: number, total: number): CSSProperties {
  if (total === 1) {
    return { left: '50%', top: '4%', transform: 'translate(-50%, 0)' }
  }

  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  const radiusX = 42
  const radiusY = 38

  return {
    left: `${50 + radiusX * Math.cos(angle)}%`,
    top: `${50 + radiusY * Math.sin(angle)}%`,
    transform: 'translate(-50%, -50%)',
  }
}
