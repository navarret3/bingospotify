import type { RoomSnapshot } from "@musical-bingo/shared";
import { API_BASE_URL } from "./constants";

export interface CreateRoomResponse extends RoomSnapshot {
  hostToken: string;
  inviteUrl: string;
}

export interface JoinRoomResponse extends RoomSnapshot {
  guestToken: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function createRoom(playlistUrl: string, hostName: string, spotifyAccessToken?: string) {
  return request<CreateRoomResponse>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ playlistUrl, hostName, spotifyAccessToken })
  });
}

export function joinRoom(code: string, name: string) {
  return request<JoinRoomResponse>(`/api/rooms/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function getRoomByCode(code: string, token?: string) {
  return request<RoomSnapshot>(`/api/rooms/${code}`, { token });
}

export function getRoomById(roomId: string, token?: string) {
  return request<RoomSnapshot>(`/api/rooms/id/${roomId}`, { token });
}

export function startRoom(roomId: string, token: string) {
  return request<RoomSnapshot>(`/api/rooms/${roomId}/start`, {
    method: "POST",
    token
  });
}

export function resetRoom(roomId: string, token: string) {
  return request<RoomSnapshot>(`/api/rooms/${roomId}/reset`, {
    method: "POST",
    token
  });
}

export function leaveRoom(roomId: string, token: string) {
  return request<{ ok: true }>(`/api/rooms/${roomId}/leave`, {
    method: "POST",
    token
  });
}

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.code ?? "REQUEST_FAILED", payload.message ?? "No se pudo completar la petición");
  }
  return payload as T;
}
