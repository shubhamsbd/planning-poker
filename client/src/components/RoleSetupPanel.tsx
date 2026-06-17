import type { ClientRoomState } from '../types'
import { UserAvatar } from './UserAvatar'

interface RoleSetupPanelProps {
  room: ClientRoomState
  onChooseRole: (role: 'player' | 'scrum_master') => Promise<void>
  onAssignScrumMaster: (scrumMasterId: string) => Promise<void>
}

export function RoleSetupPanel({ room, onChooseRole, onAssignScrumMaster }: RoleSetupPanelProps) {
  const otherParticipants = room.participants.filter((p) => p.id !== room.you.id)

  if (room.needsRoleSetup) {
    return (
      <div className="panel-accent mb-6 rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-brand-black">Choose your role</h2>
        <p className="text-muted mt-1 text-sm">
          As the room owner, decide whether you&apos;ll vote with the team or facilitate as scrum
          master.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void onChooseRole('scrum_master')}
            className="btn-primary rounded-xl px-5 py-3"
          >
            Scrum master (reveal cards)
          </button>
          <button
            type="button"
            onClick={() => void onChooseRole('player')}
            className="btn-secondary rounded-xl px-5 py-3"
          >
            Player (vote with team)
          </button>
        </div>
      </div>
    )
  }

  if (room.needsScrumMasterAssignment) {
    return (
      <div className="panel-accent mb-6 rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-brand-black">Assign scrum master</h2>
        <p className="text-muted mt-1 text-sm">
          You&apos;re playing as a participant. Pick someone else to reveal cards each round.
        </p>
        {otherParticipants.length === 0 ? (
          <p className="text-muted mt-4 text-sm">
            Invite teammates first — you&apos;ll assign the scrum master once someone joins.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {otherParticipants.map((participant) => (
              <button
                key={participant.id}
                type="button"
                onClick={() => void onAssignScrumMaster(participant.id)}
                className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                {participant.avatar && <UserAvatar avatar={participant.avatar} size="sm" />}
                Make {participant.name} scrum master
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}
