import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { ClientGameEvent, GameEvent } from "@musical-bingo/shared";
import Fastify from "fastify";
import { z } from "zod";
import { getCorsOrigins } from "./env.js";
import { AppError } from "./errors.js";
import { exchangeSpotifyCode, getSpotifyAuthConfig, refreshSpotifyToken } from "./spotifyService.js";
import {
  confirmBingo,
  createRoom,
  denyBingo,
  findSnapshotByCode,
  findSnapshotByRoomId,
  joinRoom,
  leaveRoom,
  resetRoom,
  resolveToken,
  setConnected,
  startRoom,
  updateCell
} from "./store.js";

const app = Fastify({ logger: true });
const clients = new Map<string, Set<{ token: string; send: (event: GameEvent) => void }>>();

await app.register(cors, {
  origin: getCorsOrigins(),
  credentials: true
});
await app.register(websocket);

app.get("/health", async () => ({ ok: true }));

app.get("/api/spotify/auth-config", async () => getSpotifyAuthConfig());

app.post("/api/spotify/token", async (request) => {
  const body = z.object({
    code: z.string().min(1),
    codeVerifier: z.string().min(43),
    redirectUri: z.string().url().optional()
  }).parse(request.body);
  return exchangeSpotifyCode(body);
});

app.post("/api/spotify/refresh", async (request) => {
  const body = z.object({ refreshToken: z.string().min(1) }).parse(request.body);
  return refreshSpotifyToken(body.refreshToken);
});

app.post("/api/rooms", async (request) => {
  const body = z.object({
    playlistUrl: z.string(),
    hostName: z.string().min(1).max(20).optional(),
    spotifyAccessToken: z.string().min(1).optional()
  }).parse(request.body);
  return createRoom(body.playlistUrl, body.hostName, body.spotifyAccessToken);
});

app.get("/api/rooms/:code", async (request) => {
  const params = z.object({ code: z.string() }).parse(request.params);
  return findSnapshotByCode(params.code, getBearerToken(request.headers.authorization));
});

app.get("/api/rooms/id/:roomId", async (request) => {
  const params = z.object({ roomId: z.string() }).parse(request.params);
  return findSnapshotByRoomId(params.roomId, getBearerToken(request.headers.authorization));
});

app.post("/api/rooms/:code/join", async (request) => {
  const params = z.object({ code: z.string() }).parse(request.params);
  const body = z.object({ name: z.string().min(1).max(20) }).parse(request.body);
  const result = joinRoom(params.code, body.name.trim());
  broadcast(result.room.id, {
    type: "player_joined",
    roomId: result.room.id,
    payload: { player: result.currentPlayer! },
    timestamp: new Date().toISOString()
  });
  return result;
});

app.post("/api/rooms/:roomId/start", async (request) => {
  const params = z.object({ roomId: z.string() }).parse(request.params);
  const token = requireBearerToken(request.headers.authorization);
  const snapshot = startRoom(params.roomId, token);
  broadcast(snapshot.room.id, {
    type: "game_started",
    roomId: snapshot.room.id,
    payload: { room: snapshot.room },
    timestamp: new Date().toISOString()
  });
  broadcastCardStates(snapshot.room.id);
  return snapshot;
});

app.post("/api/rooms/:roomId/reset", async (request) => {
  const params = z.object({ roomId: z.string() }).parse(request.params);
  const token = requireBearerToken(request.headers.authorization);
  const snapshot = resetRoom(params.roomId, token);
  broadcast(snapshot.room.id, {
    type: "game_reset",
    roomId: snapshot.room.id,
    payload: {},
    timestamp: new Date().toISOString()
  });
  return snapshot;
});

app.post("/api/rooms/:roomId/leave", async (request) => {
  const params = z.object({ roomId: z.string() }).parse(request.params);
  const token = requireBearerToken(request.headers.authorization);
  const result = leaveRoom(params.roomId, token);
  broadcast(result.roomId, {
    type: "player_left",
    roomId: result.roomId,
    payload: { playerId: result.playerId, name: result.name },
    timestamp: new Date().toISOString()
  });
  return { ok: true };
});

app.get("/ws", { websocket: true }, (socket: any, request) => {
  const query = z.object({ roomId: z.string(), token: z.string() }).safeParse(request.query);
  if (!query.success || !resolveToken(query.data.token)) {
    socket.close();
    return;
  }

  const { roomId, token } = query.data;
  setConnected(token, true);
  const client = {
    token,
    send: (event: GameEvent) => socket.send(JSON.stringify(event))
  };

  if (!clients.has(roomId)) {
    clients.set(roomId, new Set());
  }
  clients.get(roomId)!.add(client);

  const snapshot = findSnapshotByRoomId(roomId, token);
  if (snapshot.currentPlayer?.card) {
    client.send({
      type: "card_state",
      roomId,
      payload: { card: snapshot.currentPlayer.card },
      timestamp: new Date().toISOString()
    });
  }

  socket.on("message", (message: Buffer) => {
    try {
      handleClientEvent(roomId, token, JSON.parse(message.toString()) as ClientGameEvent);
    } catch (error) {
      app.log.error(error);
    }
  });

  socket.on("close", () => {
    clients.get(roomId)?.delete(client);
    setConnected(token, false);
  });
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({ code: error.code, message: error.message });
    return;
  }
  if (error instanceof z.ZodError) {
    reply.status(400).send({ code: "VALIDATION_ERROR", message: "Datos inválidos", issues: error.issues });
    return;
  }
  app.log.error(error);
  reply.status(500).send({ code: "INTERNAL_ERROR", message: "Error interno" });
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });

function handleClientEvent(roomId: string, token: string, event: ClientGameEvent) {
  if (event.type === "mark_cell" || event.type === "unmark_cell") {
    const card = updateCell(roomId, token, event.row, event.col, event.type === "mark_cell");
    const auth = resolveToken(token)!;
    broadcast(roomId, {
      type: event.type === "mark_cell" ? "cell_marked" : "cell_unmarked",
      roomId,
      payload: { playerId: auth.playerId, row: event.row, col: event.col },
      timestamp: new Date().toISOString()
    });
    sendToToken(roomId, token, {
      type: "card_state",
      roomId,
      payload: { card },
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (event.type === "deny_bingo") {
    const card = denyBingo(roomId, token);
    sendToToken(roomId, token, {
      type: "card_state",
      roomId,
      payload: { card },
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (event.type === "confirm_bingo") {
    try {
      const { winner } = confirmBingo(roomId, token);
      broadcast(roomId, {
        type: "bingo_confirmed",
        roomId,
        payload: { winnerId: winner.id, winnerName: winner.name },
        timestamp: new Date().toISOString()
      });
      broadcast(roomId, {
        type: "game_finished",
        roomId,
        payload: { winnerId: winner.id, winnerName: winner.name },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const auth = resolveToken(token);
      if (auth) {
        sendToToken(roomId, token, {
          type: "bingo_denied",
          roomId,
          payload: { playerId: auth.playerId },
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

function broadcast(roomId: string, event: GameEvent) {
  clients.get(roomId)?.forEach((client) => client.send(event));
}

function sendToToken(roomId: string, token: string, event: GameEvent) {
  clients.get(roomId)?.forEach((client) => {
    if (client.token === token) {
      client.send(event);
    }
  });
}

function broadcastCardStates(roomId: string) {
  clients.get(roomId)?.forEach((client) => {
    const snapshot = findSnapshotByRoomId(roomId, client.token);
    if (snapshot.currentPlayer?.card) {
      client.send({
        type: "card_state",
        roomId,
        payload: { card: snapshot.currentPlayer.card },
        timestamp: new Date().toISOString()
      });
    }
  });
}

function requireBearerToken(value: string | undefined): string {
  const token = getBearerToken(value);
  if (!token) {
    throw new AppError("UNAUTHORIZED", "Falta token", 401);
  }
  return token;
}

function getBearerToken(value: string | undefined): string | undefined {
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : undefined;
}
