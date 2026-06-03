import {
  generateCard,
  isBingoComplete,
  markCell,
  MAX_PLAYERS_PER_ROOM,
  normalizeRoomCode,
  type BingoCard,
  type Player,
  type PublicRoom,
  type Room,
  type RoomSnapshot,
  toPublicRoom,
  unmarkLastCell
} from "@musical-bingo/shared";
import { customAlphabet, nanoid } from "nanoid";
import { getAppBaseUrl } from "./env.js";
import { AppError } from "./errors.js";
import { importSpotifyPlaylist } from "./spotifyService.js";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

interface RoomRecord {
  room: Room;
  players: Player[];
}

const rooms = new Map<string, RoomRecord>();
const tokenIndex = new Map<string, { roomId: string; playerId: string }>();

export async function createRoom(
  playlistUrl: string,
  hostName = "Anfitrión",
  spotifyAccessToken?: string
): Promise<RoomSnapshot & { hostToken: string; inviteUrl: string }> {
  const playlist = await importSpotifyPlaylist(playlistUrl, spotifyAccessToken);
  let code = makeCode();
  while ([...rooms.values()].some((record) => record.room.code === code)) {
    code = makeCode();
  }

  const roomId = nanoid();
  const hostId = nanoid();
  const now = new Date().toISOString();
  const room: Room = {
    id: roomId,
    code,
    status: "lobby",
    hostId,
    playlistId: playlist.playlistId,
    playlistName: playlist.playlistName,
    tracks: playlist.tracks,
    createdAt: now
  };

  const host: Player = {
    id: hostId,
    roomId,
    name: hostName,
    isHost: true,
    joinedAt: now,
    connected: true
  };

  rooms.set(roomId, { room, players: [host] });
  const hostToken = issueToken(roomId, hostId);

  return {
    room: toPublicRoom(room),
    players: [host],
    currentPlayer: host,
    hostToken,
    inviteUrl: new URL(`/join/${code}`, getAppBaseUrl()).toString()
  };
}

export function findSnapshotByCode(code: string, token?: string): RoomSnapshot {
  const normalized = normalizeRoomCode(code);
  const record = [...rooms.values()].find((item) => item.room.code === normalized);
  if (!record) {
    throw new AppError("ROOM_NOT_FOUND", "Sala no encontrada o expirada", 404);
  }

  return makeSnapshot(record, token);
}

export function findSnapshotByRoomId(roomId: string, token?: string): RoomSnapshot {
  const record = getRecord(roomId);
  return makeSnapshot(record, token);
}

export function joinRoom(code: string, name: string): RoomSnapshot & { guestToken: string } {
  const normalized = normalizeRoomCode(code);
  const record = [...rooms.values()].find((item) => item.room.code === normalized);
  if (!record) {
    throw new AppError("ROOM_NOT_FOUND", "Sala no encontrada o expirada", 404);
  }
  if (record.room.status !== "lobby") {
    throw new AppError("ROOM_ALREADY_STARTED", "Esta partida ya ha comenzado", 409);
  }
  if (record.players.length >= MAX_PLAYERS_PER_ROOM) {
    throw new AppError("ROOM_FULL", "La sala está llena", 409);
  }
  if (record.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    throw new AppError("NAME_TAKEN", "Ese nombre ya está en uso", 409);
  }

  const player: Player = {
    id: nanoid(),
    roomId: record.room.id,
    name,
    isHost: false,
    joinedAt: new Date().toISOString(),
    connected: true
  };

  record.players.push(player);
  const guestToken = issueToken(record.room.id, player.id);

  return {
    ...makeSnapshot(record, guestToken),
    guestToken
  };
}

export function startRoom(roomId: string, token: string): RoomSnapshot {
  const record = getRecord(roomId);
  const actor = requirePlayer(record, token);
  if (!actor.isHost) {
    throw new AppError("FORBIDDEN", "Solo el anfitrión puede empezar la partida", 403);
  }
  if (record.players.length < 2) {
    throw new AppError("NOT_ENOUGH_PLAYERS", "Necesitas al menos 2 jugadores", 422);
  }

  record.players = record.players.map((player) => ({
    ...player,
    card: generateCard(record.room.tracks, nanoid, player.id)
  }));
  record.room.status = "playing";
  record.room.startedAt = new Date().toISOString();
  record.room.finishedAt = undefined;
  record.room.winnerId = undefined;

  return makeSnapshot(record, token);
}

export function resetRoom(roomId: string, token: string): RoomSnapshot {
  const record = getRecord(roomId);
  const actor = requirePlayer(record, token);
  if (!actor.isHost) {
    throw new AppError("FORBIDDEN", "Solo el anfitrión puede reiniciar", 403);
  }

  record.room.status = "lobby";
  record.room.startedAt = undefined;
  record.room.finishedAt = undefined;
  record.room.winnerId = undefined;
  record.players = record.players.map((player) => ({ ...player, card: undefined }));

  return makeSnapshot(record, token);
}

export function updateCell(roomId: string, token: string, row: number, col: number, marked: boolean): BingoCard {
  const record = getRecord(roomId);
  const player = requirePlayer(record, token);
  if (record.room.status !== "playing" || !player.card) {
    throw new AppError("ROOM_NOT_PLAYING", "La partida no está en curso", 409);
  }

  player.card = markCell(player.card, row, col, marked);
  return player.card;
}

export function denyBingo(roomId: string, token: string): BingoCard {
  const record = getRecord(roomId);
  const player = requirePlayer(record, token);
  if (!player.card) {
    throw new AppError("CARD_NOT_FOUND", "Cartón no encontrado", 404);
  }

  player.card = unmarkLastCell(player.card);
  return player.card;
}

export function confirmBingo(roomId: string, token: string): { winner: Player; snapshot: RoomSnapshot } {
  const record = getRecord(roomId);
  const player = requirePlayer(record, token);
  if (!player.card || !isBingoComplete(player.card)) {
    throw new AppError("BINGO_DENIED", "El cartón no está completo", 422);
  }

  record.room.status = "finished";
  record.room.winnerId = player.id;
  record.room.finishedAt = new Date().toISOString();

  return {
    winner: player,
    snapshot: makeSnapshot(record, token)
  };
}

export function resolveToken(token: string) {
  return tokenIndex.get(token);
}

export function setConnected(token: string, connected: boolean) {
  const auth = tokenIndex.get(token);
  if (!auth) {
    return;
  }
  const record = rooms.get(auth.roomId);
  const player = record?.players.find((item) => item.id === auth.playerId);
  if (player) {
    player.connected = connected;
  }
}

function getRecord(roomId: string): RoomRecord {
  const record = rooms.get(roomId);
  if (!record) {
    throw new AppError("ROOM_NOT_FOUND", "Sala no encontrada o expirada", 404);
  }
  return record;
}

function requirePlayer(record: RoomRecord, token: string): Player {
  const auth = tokenIndex.get(token);
  const player = auth ? record.players.find((item) => item.id === auth.playerId) : undefined;
  if (!player) {
    throw new AppError("UNAUTHORIZED", "Token inválido", 401);
  }
  return player;
}

function makeSnapshot(record: RoomRecord, token?: string): RoomSnapshot {
  const currentPlayer = token ? tokenIndex.get(token) : undefined;
  const winner = record.room.winnerId
    ? record.players.find((player) => player.id === record.room.winnerId)
    : undefined;

  return {
    room: toPublicRoom(record.room) as PublicRoom,
    players: record.players,
    currentPlayer: currentPlayer
      ? record.players.find((player) => player.id === currentPlayer.playerId)
      : undefined,
    winner
  };
}

function issueToken(roomId: string, playerId: string): string {
  const token = nanoid(32);
  tokenIndex.set(token, { roomId, playerId });
  return token;
}
