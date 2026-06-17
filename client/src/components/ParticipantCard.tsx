import type { Participant } from '../types'
import { defaultAvatar } from '../lib/avatars'
import { UserAvatar } from './UserAvatar'

interface ParticipantCardProps {
  participant: Participant
  isYou: boolean
  isOwner: boolean
  isScrumMaster: boolean
  revealed: boolean
}

export function ParticipantCard({
  participant,
  isYou,
  isOwner,
  isScrumMaster,
  revealed,
}: ParticipantCardProps) {
  const showVote = revealed && participant.vote
  const waiting = !revealed && participant.hasVoted

  return (
    <div className="seat-card flex w-[68px] flex-col items-center gap-1 sm:w-[76px]">
      <div className="relative">
        <UserAvatar
          avatar={participant.avatar ?? defaultAvatar(participant.name)}
          size="md"
          ring
          className="-mb-2 relative z-10"
        />
        <div
          className={`playing-card mx-auto flex h-[56px] w-[44px] items-center justify-center rounded-lg border-2 text-base font-bold shadow-md sm:h-[62px] sm:w-[48px] sm:text-lg ${
            showVote
              ? 'border-brand-yellow bg-card-face text-brand-black'
              : waiting
                ? 'border-brand-yellow/70 bg-amber-50 text-brand-yellow-dark'
                : 'border-black/10 bg-card-back text-zinc-300 shadow-sm'
          }`}
        >
          {showVote ? participant.vote : waiting ? '✓' : isScrumMaster ? '☕' : '?'}
        </div>
      </div>
      <div className="text-center">
        <p className="max-w-[76px] truncate text-xs font-medium text-brand-black">
          {participant.name}
          {isYou && <span className="text-brand-yellow-dark"> · you</span>}
        </p>
        {isScrumMaster ? (
          <span className="text-subtle mt-0.5 block text-[10px] uppercase tracking-wide">
            Scrum master
          </span>
        ) : isOwner ? (
          <span className="text-subtle mt-0.5 block text-[10px] uppercase tracking-wide">Owner</span>
        ) : (
          <p className="text-subtle text-[10px]">
            {!revealed && (participant.hasVoted ? 'Voted' : '…')}
            {revealed && !participant.vote && '—'}
          </p>
        )}
      </div>
    </div>
  )
}
