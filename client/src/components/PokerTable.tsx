import type { ClientRoomState } from '../types'
import { getMajorityResult, getSeatStyle } from '../types'
import { ParticipantCard } from './ParticipantCard'

interface PokerTableProps {
  room: ClientRoomState
}

export function PokerTable({ room }: PokerTableProps) {
  const votedCount = room.participants.filter((p) => p.hasVoted).length
  const votingParticipants = room.participants.filter((p) => p.id !== room.scrumMasterId)
  const majority = getMajorityResult(room.participants, room.revealed)

  return (
    <div className="poker-table-wrap relative mx-auto aspect-[4/3] w-full max-w-xl">
      <div className="poker-table-rail absolute inset-[6%] rounded-[50%] border border-slate-200/80" />
      <div className="poker-table-felt absolute inset-[14%] rounded-[50%] border-2 border-slate-600/40">
        <div className="absolute inset-2 rounded-[50%] border border-white/10" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
          {!room.revealed ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300/90">Round in progress</p>
              <p className="mt-2 text-2xl font-bold">
                {votedCount}
                <span className="text-lg font-normal text-slate-300/80">
                  {' '}
                  / {votingParticipants.length}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-300/80">votes cast</p>
              <p className="mt-2 text-[10px] text-slate-400/70">
                {room.participantCount}/{room.maxParticipants} in room
              </p>
              <p className="mt-3 max-w-[200px] text-[10px] leading-relaxed text-slate-400/80">
                Pick a card below — the scrum master reveals when everyone is ready
              </p>
            </>
          ) : majority.majorityCard || majority.nearestPocketCard ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300/90">Consensus</p>
              {majority.majorityCard && (
                <>
                  <p className="mt-2 text-3xl font-bold text-amber-200">{majority.majorityCard}</p>
                  <p className="text-xs text-slate-300/85">
                    majority ({majority.majorityCount} vote
                    {majority.majorityCount === 1 ? '' : 's'})
                  </p>
                </>
              )}
              {majority.nearestPocketCard && (
                <div className={majority.majorityCard ? 'mt-3' : 'mt-2'}>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400/80">
                    Nearest pocket size
                  </p>
                  <p className="text-2xl font-bold text-white">{majority.nearestPocketCard}</p>
                  {majority.stats && (
                    <p className="text-[10px] text-slate-400/70">avg {majority.stats.average}</p>
                  )}
                </div>
              )}
              {majority.stats && (
                <div className="mt-3 flex gap-5 text-xs">
                  <div>
                    <p className="text-[10px] uppercase text-slate-400/70">Low</p>
                    <p className="font-semibold">{majority.stats.min}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-400/70">High</p>
                    <p className="font-semibold">{majority.stats.max}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300/90">Revealed</p>
              <p className="mt-2 text-xs text-slate-300/85">No numeric votes this round</p>
            </>
          )}
        </div>
      </div>

      {room.participants.map((participant, index) => (
        <div
          key={participant.id}
          className="absolute z-10"
          style={getSeatStyle(index, room.participants.length)}
        >
          <ParticipantCard
            participant={participant}
            isYou={participant.id === room.you.id}
            isOwner={participant.id === room.creatorId}
            isScrumMaster={participant.id === room.scrumMasterId}
            revealed={room.revealed}
          />
        </div>
      ))}
    </div>
  )
}
