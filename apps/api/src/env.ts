import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

for (const path of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}

export function getSpotifyCredentials() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
  };
}

export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://127.0.0.1:8081";
}

export function getCorsOrigins(): true | string[] {
  const rawValue = process.env.CORS_ORIGIN?.trim();
  if (!rawValue) {
    return ["http://127.0.0.1:8081", "http://localhost:8081"];
  }
  if (rawValue === "*") {
    return true;
  }
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getSpotifyMarket(): string {
  return process.env.SPOTIFY_MARKET ?? "ES";
}

export function getMaxTracksPerRoom(): number {
  return Number(process.env.MAX_TRACKS_PER_ROOM ?? 200);
}

export function getSpotifyRedirectUri(): string {
  return process.env.SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:8081/spotify-callback";
}
