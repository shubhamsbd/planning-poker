import { JoinRoomPage } from './components/JoinRoomPage'
import { Lobby } from './components/Lobby'
import { PokerRoom } from './components/PokerRoom'
import { usePokerRoom } from './hooks/usePokerRoom'

export default function App() {
  const {
    connected,
    error,
    room,
    inviteRoomId,
    restoringSession,
    createRoom,
    joinRoom,
    castVote,
    revealVotes,
    resetVotes,
    killRoom,
    chooseRole,
    assignScrumMaster,
    updateAvatar,
    leaveRoom,
    clearError,
  } = usePokerRoom()

  if (room) {
    return (
      <PokerRoom
        room={room}
        onCastVote={castVote}
        onReveal={revealVotes}
        onReset={resetVotes}
        onKillRoom={killRoom}
        onChooseRole={chooseRole}
        onAssignScrumMaster={assignScrumMaster}
        onUpdateAvatar={updateAvatar}
        onLeave={leaveRoom}
      />
    )
  }

  if (restoringSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <p className="text-muted text-sm">Reconnecting to your room…</p>
      </div>
    )
  }

  if (inviteRoomId) {
    return (
      <JoinRoomPage
        roomId={inviteRoomId}
        connected={connected}
        error={error}
        onJoinRoom={joinRoom}
        onClearError={clearError}
      />
    )
  }

  return (
    <Lobby
      connected={connected}
      error={error}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      onClearError={clearError}
    />
  )
}
