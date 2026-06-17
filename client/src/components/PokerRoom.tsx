import { useState } from 'react'
import { getRoomInviteUrl } from '../lib/urls'
import { defaultAvatar, type Avatar } from '../lib/avatars'
import type { ClientRoomState, PokerCard } from '../types'
import { AvatarPicker } from './AvatarPicker'
import { PokerTable } from './PokerTable'
import { RoleSetupPanel } from './RoleSetupPanel'
import { UserAvatar } from './UserAvatar'
import { VoteDeck } from './VoteDeck'

interface PokerRoomProps {
  room: ClientRoomState
  onCastVote: (value: PokerCard) => void
  onReveal: () => void
  onReset: () => void
  onKillRoom: () => Promise<boolean>
  onChooseRole: (role: 'player' | 'scrum_master') => Promise<void>
  onAssignScrumMaster: (scrumMasterId: string) => Promise<void>
  onUpdateAvatar: (avatar: Avatar, displayName: string) => Promise<void>
  onLeave: () => void
}

export function PokerRoom({
  room,
  onCastVote,
  onReveal,
  onReset,
  onKillRoom,
  onChooseRole,
  onAssignScrumMaster,
  onUpdateAvatar,
  onLeave,
}: PokerRoomProps) {
  const [confirmKill, setConfirmKill] = useState(false)
  const [killing, setKilling] = useState(false)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [showAvatarEditor, setShowAvatarEditor] = useState(false)
  const [draftAvatar, setDraftAvatar] = useState<Avatar>(
    () => room.you.avatar ?? defaultAvatar(room.you.name),
  )
  const votedCount = room.participants.filter((p) => p.hasVoted).length
  const setupIncomplete = room.needsRoleSetup || room.needsScrumMasterAssignment

  function copyRoomCode() {
    void navigator.clipboard.writeText(room.roomId)
    setCopied('code')
    setTimeout(() => setCopied(null), 2000)
  }

  function copyInviteLink() {
    void navigator.clipboard.writeText(getRoomInviteUrl(room.roomId))
    setCopied('link')
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleKillRoom() {
    if (!confirmKill) {
      setConfirmKill(true)
      return
    }
    setKilling(true)
    await onKillRoom()
    setKilling(false)
    setConfirmKill(false)
  }

  async function saveAvatarChoice() {
    await onUpdateAvatar(draftAvatar, room.you.name)
    setShowAvatarEditor(false)
  }

  const youAvatar = room.you.avatar ?? defaultAvatar(room.you.name)
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-subtle text-sm uppercase tracking-[0.2em]">Planning poker</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-brand-black">
              Room <span className="text-brand-yellow-dark">{room.roomId}</span>
            </h1>
            <button
              type="button"
              onClick={copyRoomCode}
              className="btn-secondary rounded-lg px-3 py-1 text-xs font-medium transition"
            >
              {copied === 'code' ? 'Copied!' : 'Copy code'}
            </button>
            <button
              type="button"
              onClick={copyInviteLink}
              className="btn-secondary rounded-lg px-3 py-1 text-xs font-medium transition"
            >
              {copied === 'link' ? 'Link copied!' : 'Copy invite link'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftAvatar(youAvatar)
              setShowAvatarEditor((open) => !open)
            }}
            className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1 pl-1 pr-3 text-xs transition hover:border-brand-yellow/40"
            title="Customize avatar"
          >
            <UserAvatar avatar={youAvatar} size="sm" />
            <span className="text-muted">Edit avatar</span>
          </button>
          {room.isCreator && (            <span className="rounded-full border border-brand-yellow/40 bg-amber-50 px-3 py-1 text-xs font-medium text-brand-yellow-dark">
              Room owner
            </span>
          )}
          {room.isScrumMaster && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              Scrum master
            </span>
          )}
          <span className="rounded-full border border-black/10 bg-brand-gray px-3 py-1 text-xs text-muted">
            {room.participantCount}/{room.maxParticipants}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              room.revealed
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-black/10 bg-brand-gray text-muted'
            }`}
          >
            {room.revealed ? 'Cards face up' : 'Cards hidden'}
          </span>
          <button
            type="button"
            onClick={onLeave}
            className="btn-secondary rounded-xl px-4 py-2 text-sm transition"
          >
            Leave
          </button>
        </div>
      </header>

      {showAvatarEditor && (
        <div className="panel-accent mb-4 rounded-3xl p-5">
          <AvatarPicker avatar={draftAvatar} onChange={setDraftAvatar} compact />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void saveAvatarChoice()} className="btn-primary rounded-xl px-4 py-2 text-sm">
              Save avatar
            </button>
            <button
              type="button"
              onClick={() => setShowAvatarEditor(false)}
              className="btn-secondary rounded-xl px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(room.needsRoleSetup || room.needsScrumMasterAssignment) && (        <RoleSetupPanel
          room={room}
          onChooseRole={onChooseRole}
          onAssignScrumMaster={onAssignScrumMaster}
        />
      )}

      {room.isCreator && !setupIncomplete && (
        <p className="text-muted mb-4 text-sm">
          {room.passwordProtected
            ? 'Share the invite link with your team and give them the room password separately.'
            : 'Share the invite link with your team — no password needed for this room.'}
        </p>
      )}

      <section className="panel mb-6 overflow-hidden rounded-3xl p-4 sm:p-6">
        <PokerTable room={room} />
      </section>

      {!room.revealed && room.canVote && !setupIncomplete && (
        <VoteDeck
          selected={room.you.vote}
          disabled={room.revealed}
          onSelect={(value) => onCastVote(value)}
        />
      )}

      {!room.revealed && !room.canVote && room.isScrumMaster && !setupIncomplete && (
        <p className="text-muted panel rounded-3xl p-4 text-sm">
          You&apos;re facilitating this round as scrum master — waiting for the team to vote.
        </p>
      )}

      {room.canReveal && !setupIncomplete && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!room.revealed ? (
            <button
              type="button"
              onClick={onReveal}
              disabled={votedCount === 0}
              className="btn-primary rounded-xl px-5 py-3 transition disabled:cursor-not-allowed"
            >
              Reveal cards
            </button>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className="btn-primary rounded-xl px-5 py-3 transition"
            >
              Next round
            </button>
          )}
        </div>
      )}

      {room.isCreator && (
        <div className={`flex flex-wrap items-center gap-3 ${room.canReveal ? 'mt-3' : 'mt-6'}`}>
          <button
            type="button"
            onClick={handleKillRoom}
            disabled={killing}
            className={`rounded-xl border px-5 py-3 text-sm font-medium transition disabled:opacity-50 ${
              confirmKill
                ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-red-200 bg-white text-red-600 hover:border-red-400 hover:bg-red-50'
            }`}
          >
            {killing ? 'Closing…' : confirmKill ? 'Confirm — close room?' : 'Close room'}
          </button>
          {confirmKill && !killing && (
            <button
              type="button"
              onClick={() => setConfirmKill(false)}
              className="btn-secondary rounded-xl px-4 py-3 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
