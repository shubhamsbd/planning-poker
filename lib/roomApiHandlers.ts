import type { VercelRequest, VercelResponse } from '@vercel/node'
import { emitRoomClosed, emitRoomState, subscribe } from './broadcast.js'
import { methodNotAllowed, readJsonBody } from './http.js'
import {
  assignScrumMaster,
  castVote,
  createRoom,
  destroyRoom,
  getRoom,
  getRoomPublicInfo,
  joinRoom,
  leaveRoom,
  resetVotes,
  revealVotes,
  serializeRoom,
  setCreatorRole,
  updateParticipantAvatar,
} from './rooms.js'
import { POKER_CARDS, type PokerCard, type SessionPayload } from './types.js'

const MIN_PASSWORD_LENGTH = 4

export async function handleCreateRoom(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    name?: string
    roomId?: string
    passwordProtected?: boolean
    password?: string
    avatar?: { emoji?: string; color?: string }
  }>(req)

  if (!body?.name?.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required' })
    return
  }

  const passwordProtected = Boolean(body.passwordProtected)
  const password = body.password?.trim() ?? ''

  if (passwordProtected && password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      ok: false,
      error: `Room password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
    return
  }

  const { room, participantId } = await createRoom(
    body.name,
    body.roomId,
    passwordProtected ? password : undefined,
    body.avatar,
  )
  const state = serializeRoom(room, participantId)
  emitRoomState(room.id)

  const payload: SessionPayload = { roomId: room.id, participantId, state }
  res.status(200).json({ ok: true, data: payload })
}

export async function handleJoinRoom(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    roomId?: string
    name?: string
    password?: string
    avatar?: { emoji?: string; color?: string }
  }>(req)

  if (!body?.roomId?.trim() || !body?.name?.trim()) {
    res.status(400).json({ ok: false, error: 'Room ID and name are required' })
    return
  }

  const room = await getRoom(body.roomId)
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  const passwordProtected = room.passwordHash !== null
  const password = body.password?.trim() ?? ''

  if (passwordProtected && !password) {
    res.status(400).json({ ok: false, error: 'Room password is required' })
    return
  }

  const result = await joinRoom(body.roomId, body.name, password || undefined, body.avatar)
  if (!result.ok) {
    const errors: Record<typeof result.reason, { status: number; message: string }> = {
      not_found: { status: 404, message: 'Room not found' },
      wrong_password: { status: 401, message: 'Incorrect room password' },
      duplicate_name: { status: 409, message: 'That name is already taken in this room' },
      room_full: { status: 403, message: 'This room is full (max 11 including host)' },
    }
    const { status, message } = errors[result.reason]
    res.status(status).json({ ok: false, error: message })
    return
  }

  const { room: joinedRoom, participantId } = result
  const state = serializeRoom(joinedRoom, participantId)
  emitRoomState(joinedRoom.id)

  const payload: SessionPayload = {
    roomId: joinedRoom.id,
    participantId,
    state,
  }
  res.status(200).json({ ok: true, data: payload })
}

export async function handleRoomInfo(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const info = await getRoomPublicInfo(roomId)
  if (!info) {
    res.status(404).json({ ok: false, error: 'Room not found' })
    return
  }

  res.status(200).json({ ok: true, data: info })
}

export async function handleRoomStream(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  const participantId = req.query.participantId
  if (typeof participantId !== 'string') {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  const room = await getRoom(roomId)
  if (!room || !room.participants.has(participantId)) {
    res.status(404).json({ ok: false, error: 'Room or participant not found' })
    return
  }

  subscribe(roomId, participantId, res)
}

export async function handleRoomAction(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
  action: string,
): Promise<void> {
  switch (action) {
    case 'vote':
      return handleVote(req, res, roomId)
    case 'reveal':
      return handleReveal(req, res, roomId)
    case 'reset':
      return handleReset(req, res, roomId)
    case 'role':
      return handleRole(req, res, roomId)
    case 'scrum-master':
      return handleScrumMaster(req, res, roomId)
    case 'leave':
      return handleLeave(req, res, roomId)
    case 'destroy':
      return handleDestroy(req, res, roomId)
    case 'avatar':
      return handleAvatar(req, res, roomId)
    default:
      res.status(404).json({ ok: false, error: 'Not found' })
  }
}

async function handleVote(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{ participantId?: string; value?: PokerCard }>(req)
  if (!body?.participantId || !body.value || !POKER_CARDS.includes(body.value)) {
    res.status(400).json({ ok: false, error: 'Valid participantId and vote are required' })
    return
  }

  if (!await castVote(roomId, body.participantId, body.value)) {
    res.status(400).json({ ok: false, error: 'Unable to cast vote' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleReveal(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{ participantId?: string }>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!await revealVotes(roomId, body.participantId)) {
    res.status(403).json({ ok: false, error: 'Only the scrum master can reveal votes' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleReset(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{ participantId?: string }>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!await resetVotes(roomId, body.participantId)) {
    res.status(403).json({ ok: false, error: 'Only the scrum master can reset votes' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleRole(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    participantId?: string
    role?: 'player' | 'scrum_master'
  }>(req)

  if (!body?.participantId || !body.role) {
    res.status(400).json({ ok: false, error: 'participantId and role are required' })
    return
  }

  if (!await setCreatorRole(roomId, body.participantId, body.role)) {
    res.status(403).json({ ok: false, error: 'Only the room owner can choose their role once' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleScrumMaster(
  req: VercelRequest,
  res: VercelResponse,
  roomId: string,
): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{ participantId?: string; scrumMasterId?: string }>(req)
  if (!body?.participantId || !body.scrumMasterId) {
    res.status(400).json({ ok: false, error: 'participantId and scrumMasterId are required' })
    return
  }

  if (!await assignScrumMaster(roomId, body.participantId, body.scrumMasterId)) {
    res.status(403).json({
      ok: false,
      error: 'Only the room owner can assign a scrum master while playing as a participant',
    })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleLeave(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{ participantId?: string }>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  await leaveRoom(body.participantId, roomId)
  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}

async function handleDestroy(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{ participantId?: string }>(req)
  if (!body?.participantId) {
    res.status(400).json({ ok: false, error: 'participantId is required' })
    return
  }

  if (!await destroyRoom(roomId, body.participantId)) {
    res.status(403).json({ ok: false, error: 'Only the room creator can close the room' })
    return
  }

  emitRoomClosed(roomId)
  res.status(200).json({ ok: true })
}

async function handleAvatar(req: VercelRequest, res: VercelResponse, roomId: string): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST'])
    return
  }

  const body = await readJsonBody<{
    participantId?: string
    avatar?: { emoji?: string; color?: string }
  }>(req)

  if (!body?.participantId || !body.avatar) {
    res.status(400).json({ ok: false, error: 'participantId and avatar are required' })
    return
  }

  if (!await updateParticipantAvatar(roomId, body.participantId, body.avatar)) {
    res.status(400).json({ ok: false, error: 'Unable to update avatar' })
    return
  }

  emitRoomState(roomId)
  res.status(200).json({ ok: true })
}
