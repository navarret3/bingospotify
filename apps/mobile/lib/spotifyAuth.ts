import { API_BASE_URL } from "./constants";

const AUTH_STORAGE_KEY = "musical-bingo.spotify-auth";
const PKCE_STORAGE_KEY = "musical-bingo.spotify-pkce";

interface SpotifyAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string;
}

export interface SpotifyAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

interface SpotifyTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
}

export async function startSpotifyLogin() {
  const config = await fetchJson<SpotifyAuthConfig>("/api/spotify/auth-config");
  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(32);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  localStorage.setItem(
    PKCE_STORAGE_KEY,
    JSON.stringify({
      codeVerifier,
      state,
      redirectUri: config.redirectUri
    })
  );

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: config.scopes,
    redirect_uri: config.redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge
  }).toString();

  window.location.href = authUrl.toString();
}

export async function completeSpotifyLogin(code: string, state: string) {
  const stored = JSON.parse(localStorage.getItem(PKCE_STORAGE_KEY) ?? "null") as
    | { codeVerifier: string; state: string; redirectUri: string }
    | null;

  if (!stored || stored.state !== state) {
    throw new Error("La sesión de Spotify no coincide. Vuelve a conectar Spotify.");
  }

  const token = await fetchJson<SpotifyTokenResponse>("/api/spotify/token", {
    method: "POST",
    body: JSON.stringify({
      code,
      codeVerifier: stored.codeVerifier,
      redirectUri: stored.redirectUri
    })
  });

  const tokens = saveSpotifyTokens(token);
  localStorage.removeItem(PKCE_STORAGE_KEY);
  return tokens;
}

export async function getValidSpotifyAuth(): Promise<SpotifyAuthTokens | undefined> {
  const current = getStoredSpotifyAuth();
  if (!current) {
    return undefined;
  }

  if (current.expiresAt > Date.now() + 60_000) {
    return current;
  }

  if (!current.refreshToken) {
    clearSpotifyAuth();
    return undefined;
  }

  const refreshed = await fetchJson<SpotifyTokenResponse>("/api/spotify/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: current.refreshToken })
  });

  return saveSpotifyTokens({
    ...refreshed,
    refreshToken: refreshed.refreshToken ?? current.refreshToken
  });
}

export function getStoredSpotifyAuth(): SpotifyAuthTokens | undefined {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as SpotifyAuthTokens;
  } catch {
    clearSpotifyAuth();
    return undefined;
  }
}

export function clearSpotifyAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(PKCE_STORAGE_KEY);
}

function saveSpotifyTokens(token: SpotifyTokenResponse): SpotifyAuthTokens {
  const tokens: SpotifyAuthTokens = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + Math.max(0, token.expiresIn - 60) * 1000,
    scope: token.scope
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
  return tokens;
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? "No se pudo conectar con Spotify");
  }
  return payload as T;
}

function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, value) => acc + possible[value % possible.length], "");
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
