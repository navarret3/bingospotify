export type RoomStatus = "lobby" | "playing" | "finished";

export interface Track {
  spotifyId: string;
  name: string;
  artist: string;
  artistImageUrl?: string;
  imageUrl: string;
  previewUrl?: string;
}

export interface BingoCell {
  track: Track;
  marked: boolean;
}

export interface BingoCard {
  id: string;
  playerId: string;
  cells: BingoCell[][];
  markedCount: number;
  lastMarkedCellIndex?: [number, number];
}

export interface Player {
  id: string;
  roomId: string;
  name: string;
  isHost: boolean;
  joinedAt: string;
  connected: boolean;
  card?: BingoCard;
}

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  hostId: string;
  playlistId: string;
  playlistName: string;
  tracks: Track[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  winnerId?: string;
}

export interface PublicRoom extends Omit<Room, "tracks"> {
  trackCount: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string;
  trackCount: number;
}

export interface RoomSnapshot {
  room: PublicRoom;
  players: Player[];
  currentPlayer?: Player;
  winner?: Player;
}

export type GameEvent =
  | { type: "player_joined"; roomId: string; payload: { player: Player }; timestamp: string }
  | { type: "player_left"; roomId: string; payload: { playerId: string; name: string }; timestamp: string }
  | { type: "game_started"; roomId: string; payload: { room: PublicRoom; card?: BingoCard }; timestamp: string }
  | { type: "card_state"; roomId: string; payload: { card: BingoCard }; timestamp: string }
  | { type: "cell_marked"; roomId: string; payload: { playerId: string; row: number; col: number }; timestamp: string }
  | { type: "cell_unmarked"; roomId: string; payload: { playerId: string; row: number; col: number }; timestamp: string }
  | { type: "bingo_confirmed"; roomId: string; payload: { winnerId: string; winnerName: string }; timestamp: string }
  | { type: "bingo_denied"; roomId: string; payload: { playerId: string }; timestamp: string }
  | { type: "game_finished"; roomId: string; payload: { winnerId: string; winnerName: string }; timestamp: string }
  | { type: "game_reset"; roomId: string; payload: Record<string, never>; timestamp: string };

export type ClientGameEvent =
  | { type: "mark_cell"; row: number; col: number }
  | { type: "unmark_cell"; row: number; col: number }
  | { type: "claim_bingo" }
  | { type: "confirm_bingo" }
  | { type: "deny_bingo" };

export const ROOM_CODE_LENGTH = 6;
export const CARD_COLS = 3;
export const CARD_ROWS = 6;
export const CARD_CELL_COUNT = CARD_COLS * CARD_ROWS;
export const MAX_PLAYERS_PER_ROOM = 20;

export function toPublicRoom(room: Room): PublicRoom {
  const { tracks, ...rest } = room;
  return {
    ...rest,
    trackCount: tracks.length
  };
}

export function isBingoComplete(card: BingoCard): boolean {
  return card.cells.every((row) => row.every((cell) => cell.marked));
}

export function countMarkedCells(cells: BingoCell[][]): number {
  return cells.flat().filter((cell) => cell.marked).length;
}

export function markCell(card: BingoCard, row: number, col: number, marked: boolean): BingoCard {
  const cells = card.cells.map((cardRow, rowIndex) =>
    cardRow.map((cell, colIndex) =>
      rowIndex === row && colIndex === col ? { ...cell, marked } : cell
    )
  );

  return {
    ...card,
    cells,
    markedCount: countMarkedCells(cells),
    lastMarkedCellIndex: marked ? [row, col] : card.lastMarkedCellIndex
  };
}

export function unmarkLastCell(card: BingoCard): BingoCard {
  if (!card.lastMarkedCellIndex) {
    return card;
  }

  const [row, col] = card.lastMarkedCellIndex;
  return {
    ...markCell(card, row, col, false),
    lastMarkedCellIndex: undefined
  };
}

export function generateCard(tracks: Track[], idFactory: () => string, playerId: string): BingoCard {
  if (tracks.length < CARD_CELL_COUNT) {
    throw new Error("NOT_ENOUGH_TRACKS");
  }

  const shuffled = fisherYatesShuffle([...tracks]);
  const selected = shuffled.slice(0, CARD_CELL_COUNT);
  const cells: BingoCell[][] = [];

  for (let row = 0; row < CARD_ROWS; row += 1) {
    cells[row] = [];
    for (let col = 0; col < CARD_COLS; col += 1) {
      cells[row][col] = {
        track: selected[row * CARD_COLS + col],
        marked: false
      };
    }
  }

  return {
    id: idFactory(),
    playerId,
    cells,
    markedCount: 0
  };
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
