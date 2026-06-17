import type { Participant, PokerCard } from './types.js'

export const NUMERIC_CARDS: PokerCard[] = ['0', '½', '1', '2', '3', '5', '8', '13', '21']

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

const VALUE_TO_CARD = new Map<number, PokerCard>(
  Object.entries(NUMERIC_VALUES).map(([card, value]) => [value, card as PokerCard]),
)

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

export function getNumericValue(vote: PokerCard): number | null {
  return vote in NUMERIC_VALUES ? NUMERIC_VALUES[vote] : null
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

  return VALUE_TO_CARD.get(nearestValue) ?? '0'
}

export function getVoteStats(participants: Participant[]): VoteStats | null {
  const numericVotes = participants
    .map((p) => p.vote)
    .filter((vote): vote is PokerCard => vote != null)
    .map(getNumericValue)
    .filter((value): value is number => value !== null)

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

export function getMajorityResult(participants: Participant[]): MajorityResult {
  const stats = getVoteStats(participants)
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

  const average = stats?.average ?? 0
  const nearestPocketCard = nearestPocketCardFromAverage(average)

  return {
    majorityCard,
    majorityCount,
    nearestPocketCard,
    stats,
  }
}

function nearestPocketCardFromAverage(average: number): PokerCard {
  return nearestPocketCard(average)
}
