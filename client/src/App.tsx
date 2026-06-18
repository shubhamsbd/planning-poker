import { Analytics } from '@vercel/analytics/react'
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
      <>
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
        <Analytics />
      </>
    )
  }

  if (inviteRoomId) {
    return (
      <>
        <JoinRoomPage
          roomId={inviteRoomId}
          connected={connected}
          error={error}
          onJoinRoom={joinRoom}
          onClearError={clearError}
        />
        <Analytics />
      </>
    )
  }

  return (
    <>
      <Lobby
        connected={connected}
        error={error}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onClearError={clearError}
      />
      <Analytics />
    </>
  )
}
