import type { Track } from "@musical-bingo/shared";
import { getMaxTracksPerRoom, getSpotifyCredentials, getSpotifyMarket, getSpotifyRedirectUri } from "./env.js";
import { AppError } from "./errors.js";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

let cachedToken: { accessToken: string; expiresAt: number } | undefined;

interface SpotifyPlaylistPayload {
  id: string;
  name: string;
  images?: Array<{ url?: string }>;
  tracks?: { total?: number };
}

interface SpotifyPlaylistItemsPayload {
  items?: Array<{
    track?: {
      id?: string;
      name?: string;
      type?: string;
      is_local?: boolean;
      artists?: Array<{ id?: string; name?: string }>;
      album?: { images?: Array<{ url?: string; width?: number; height?: number }> };
      preview_url?: string | null;
    } | null;
  }>;
  total?: number;
}

interface SpotifyArtistsPayload {
  artists?: Array<{
    id?: string;
    images?: Array<{ url?: string; width?: number; height?: number }>;
  }>;
}

interface ImportedTrack extends Track {
  artistId?: string;
}

export interface SpotifyPlaylistImport {
  playlistId: string;
  playlistName: string;
  tracks: Track[];
}

export async function importSpotifyPlaylist(input: string, userAccessToken?: string): Promise<SpotifyPlaylistImport> {
  const playlistId = parseSpotifyPlaylistId(input);
  if (userAccessToken) {
    return importSpotifyApiPlaylist(playlistId, userAccessToken);
  }

  try {
    const accessToken = await getSpotifyAccessToken();
    console.log("[spotify] usando API oficial con credenciales de app");
    const result = await importSpotifyApiPlaylist(playlistId, accessToken);
    const withImages = result.tracks.filter((t) => t.artistImageUrl).length;
    console.log(`[spotify] ${result.tracks.length} tracks, ${withImages} con imagen de artista`);
    return result;
  } catch (error) {
    if (!shouldFallbackToEmbed(error)) {
      throw error;
    }

    console.warn("[spotify] fallback a embed:", error instanceof Error ? error.message : error);
    const embedResult = await importSpotifyEmbedPlaylist(playlistId);
    const withImages = embedResult.tracks.filter((t) => t.artistImageUrl).length;
    console.log(`[spotify] embed+hydrate: ${embedResult.tracks.length} tracks, ${withImages} con imagen de artista`);
    return embedResult;
  }
}

async function importSpotifyApiPlaylist(playlistId: string, accessToken: string): Promise<SpotifyPlaylistImport> {
  const playlist = await getPlaylist(playlistId, accessToken);
  const tracks = await getPlaylistTracks(playlistId, accessToken);

  if (tracks.length < 16) {
    throw new AppError("NOT_ENOUGH_TRACKS", "Esta playlist necesita al menos 18 canciones válidas", 422);
  }

  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    tracks: shuffle(tracks).slice(0, getMaxTracksPerRoom())
  };
}

async function importSpotifyEmbedPlaylist(playlistId: string): Promise<SpotifyPlaylistImport> {
  const response = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
    }
  });

  if (response.status === 404) {
    throw new AppError("PLAYLIST_NOT_FOUND", "Playlist no encontrada o no pública", 404);
  }
  if (!response.ok) {
    throw new AppError("SPOTIFY_EMBED_FAILED", "No pudimos leer la playlist pública de Spotify", 502);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new AppError("SPOTIFY_EMBED_FORMAT_CHANGED", "Spotify no expuso las canciones en la vista pública", 502);
  }

  const payload = JSON.parse(match[1]) as {
    props?: {
      pageProps?: {
        state?: {
          data?: {
            entity?: {
              id?: string;
              title?: string;
              name?: string;
              coverArt?: { sources?: Array<{ url?: string }> };
              visualIdentity?: { image?: Array<{ url?: string }> };
              trackList?: Array<{
                uri?: string;
                title?: string;
                subtitle?: string;
                entityType?: string;
                isPlayable?: boolean;
                audioPreview?: { url?: string };
              }>;
            };
          };
        };
      };
    };
  };

  const entity = payload.props?.pageProps?.state?.data?.entity;
  const playlistImage = entity?.coverArt?.sources?.[0]?.url ?? entity?.visualIdentity?.image?.[0]?.url ?? "";
  const tracks = (entity?.trackList ?? [])
    .filter((track) => track.entityType === "track" && track.uri && track.title)
    .map((track, index) => ({
      spotifyId: track.uri?.split(":").pop() ?? `${playlistId}-${index}`,
      name: track.title ?? "Canción sin título",
      artist: normalizeArtistText(track.subtitle),
      artistImageUrl: undefined,
      imageUrl: "",
      previewUrl: track.audioPreview?.url
    }));

  if (tracks.length < 16) {
    throw new AppError("NOT_ENOUGH_TRACKS", "Esta playlist necesita al menos 18 canciones visibles", 422);
  }

  const selectedTracks = shuffle(tracks).slice(0, getMaxTracksPerRoom());
  const hydratedTracks = await hydrateEmbedTracks(selectedTracks);

  return {
    playlistId: entity?.id ?? playlistId,
    playlistName: entity?.title ?? entity?.name ?? "Playlist de Spotify",
    tracks: hydratedTracks
  };
}

function normalizeArtistText(value: string | undefined): string {
  return value?.replace(/\u00a0/g, " ").trim() || "Artista desconocido";
}

export function getSpotifyAuthConfig() {
  const { clientId } = getSpotifyCredentials();
  if (!clientId) {
    throw new AppError("SPOTIFY_CLIENT_ID_MISSING", "Configura SPOTIFY_CLIENT_ID en el backend", 500);
  }

  return {
    clientId,
    redirectUri: getSpotifyRedirectUri(),
    scopes: "playlist-read-private playlist-read-collaborative"
  };
}

export async function exchangeSpotifyCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}) {
  const { clientId } = getSpotifyCredentials();
  if (!clientId) {
    throw new AppError("SPOTIFY_CLIENT_ID_MISSING", "Configura SPOTIFY_CLIENT_ID en el backend", 500);
  }

  return spotifyTokenRequest({
    client_id: clientId,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri ?? getSpotifyRedirectUri(),
    code_verifier: input.codeVerifier
  });
}

export async function refreshSpotifyToken(refreshToken: string) {
  const { clientId } = getSpotifyCredentials();
  if (!clientId) {
    throw new AppError("SPOTIFY_CLIENT_ID_MISSING", "Configura SPOTIFY_CLIENT_ID en el backend", 500);
  }

  return spotifyTokenRequest({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
}

export function parseSpotifyPlaylistId(input: string): string {
  const value = input.trim();

  if (!value) {
    throw new AppError("INVALID_PLAYLIST_URL", "Pega una URL de playlist de Spotify", 400);
  }

  const spotifyUriMatch = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(value);
  if (spotifyUriMatch) {
    return spotifyUriMatch[1];
  }

  const rawIdMatch = /^[A-Za-z0-9]{16,64}$/.exec(value);
  if (rawIdMatch) {
    return value;
  }

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const playlistIndex = segments.findIndex((segment) => segment === "playlist");
    const playlistId = playlistIndex >= 0 ? segments[playlistIndex + 1] : undefined;
    if (url.hostname.includes("spotify.com") && playlistId && /^[A-Za-z0-9]+$/.test(playlistId)) {
      return playlistId;
    }
  } catch {
    throw new AppError("INVALID_PLAYLIST_URL", "La URL de Spotify no es válida", 400);
  }

  throw new AppError("INVALID_PLAYLIST_URL", "La URL debe ser de una playlist de Spotify", 400);
}

async function getSpotifyAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getSpotifyCredentials();
  if (!clientId || !clientSecret) {
    throw new AppError(
      "SPOTIFY_CREDENTIALS_MISSING",
      "Configura SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en el backend para leer playlists públicas",
      500
    );
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "client_credentials" })
  });

  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) {
    throw new AppError("SPOTIFY_AUTH_FAILED", "Spotify no aceptó las credenciales de la aplicación", 502);
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 60) * 1000
  };

  return cachedToken.accessToken;
}

async function spotifyTokenRequest(params: Record<string, string>) {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new AppError(
      "SPOTIFY_TOKEN_EXCHANGE_FAILED",
      payload.error_description ?? "Spotify no devolvió un token válido",
      401
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? 3600,
    scope: payload.scope,
    tokenType: payload.token_type
  };
}

async function getPlaylist(playlistId: string, accessToken: string): Promise<SpotifyPlaylistPayload> {
  const fields = "id,name,images(url),tracks(total)";
  return spotifyGet<SpotifyPlaylistPayload>(
    `/playlists/${playlistId}?market=${getSpotifyMarket()}&fields=${encodeURIComponent(fields)}`,
    accessToken
  );
}

async function getPlaylistTracks(playlistId: string, accessToken: string): Promise<Track[]> {
  const tracks: ImportedTrack[] = [];
  const maxTracks = getMaxTracksPerRoom();
  const fields = "items(track(id,name,type,is_local,artists(id,name),album(images(url,width,height)),preview_url)),total";
  let offset = 0;

  while (tracks.length < maxTracks) {
    const payload = await spotifyGet<SpotifyPlaylistItemsPayload>(
      `/playlists/${playlistId}/items?market=${getSpotifyMarket()}&limit=50&offset=${offset}&fields=${encodeURIComponent(fields)}`,
      accessToken
    );

    const items = payload.items ?? [];
    for (const item of items) {
      const track = item.track;
      if (!track?.id || track.type !== "track" || track.is_local) {
        continue;
      }

      const primaryArtistId = track.artists?.find((artist) => artist.id)?.id;

      tracks.push({
        spotifyId: track.id,
        name: track.name ?? "Canción sin título",
        artist: track.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Artista desconocido",
        artistId: primaryArtistId,
        imageUrl: selectAlbumImage(track.album?.images),
        previewUrl: track.preview_url ?? undefined
      });
    }

    offset += items.length;
    if (!items.length || offset >= (payload.total ?? 0)) {
      break;
    }
  }

  return hydrateArtistImages(tracks, accessToken);
}

async function hydrateArtistImages(tracks: ImportedTrack[], accessToken: string): Promise<Track[]> {
  const artistIds = [...new Set(tracks.map((track) => track.artistId).filter(isDefined))];
  if (!artistIds.length) {
    return tracks.map(({ artistId: _artistId, ...track }) => track);
  }

  const imageByArtistId = new Map<string, string>();

  for (let index = 0; index < artistIds.length; index += 50) {
    const batchIds = artistIds.slice(index, index + 50);
    const payload = await spotifyGet<SpotifyArtistsPayload>(
      `/artists?ids=${encodeURIComponent(batchIds.join(","))}`,
      accessToken
    );

    for (const artist of payload.artists ?? []) {
      if (!artist.id) {
        continue;
      }

      const imageUrl = selectArtistImage(artist.images);
      if (imageUrl) {
        imageByArtistId.set(artist.id, imageUrl);
      }
    }
  }

  return tracks.map((track) => ({
    ...withoutArtistId(track),
    artistImageUrl: track.artistId ? imageByArtistId.get(track.artistId) : undefined
  }));
}

/**
 * Después de obtener track IDs del embed, hidrata las portadas de álbum
 * usando el API oEmbed de Spotify (no requiere autenticación).
 */
async function hydrateEmbedTracks(tracks: Track[]): Promise<Track[]> {
  // Filtra solo IDs reales de Spotify (22 chars alfanuméricos)
  const realIds = tracks.map((t) => t.spotifyId).filter((id) => /^[A-Za-z0-9]{16,}$/.test(id));
  if (!realIds.length) return tracks;
  console.log(`[spotify] hydrateEmbedTracks: ${realIds.length} IDs reales de ${tracks.length} tracks`);

  // oEmbed: paralelo, sin autenticación, devuelve thumbnail_url (portada de álbum)
  const results = await Promise.allSettled(
    realIds.map(async (id) => {
      const res = await fetch(
        `https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F${id}`,
        { headers: { "user-agent": "Mozilla/5.0" } }
      );
      if (!res.ok) return { id, imageUrl: "" };
      const data = (await res.json()) as { thumbnail_url?: string };
      return { id, imageUrl: data.thumbnail_url ?? "" };
    })
  );

  const imageMap = new Map<string, string>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.imageUrl) {
      imageMap.set(result.value.id, result.value.imageUrl);
    }
  }

  const withImages = imageMap.size;
  console.log(`[spotify] hydrateEmbedTracks: ${withImages} portadas obtenidas via oEmbed`);

  return tracks.map((track) => ({
    ...track,
    imageUrl: imageMap.get(track.spotifyId) || track.imageUrl
  }));
}

async function spotifyGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const body = await response.text();

  if (response.status === 404) {
    throw new AppError("PLAYLIST_NOT_FOUND", "Playlist no encontrada o no pública", 404);
  }
  if (response.status === 401) {
    if (body.toLowerCase().includes("valid user authentication required")) {
      throw new AppError(
        "SPOTIFY_USER_AUTH_REQUIRED",
        "Spotify permite ver la playlist, pero exige login de usuario para leer sus canciones",
        401
      );
    }
    throw new AppError("SPOTIFY_AUTH_FAILED", "Spotify rechazó el token de la aplicación", 401);
  }
  if (response.status === 403) {
    if (body.toLowerCase().includes("premium subscription required")) {
      throw new AppError(
        "SPOTIFY_PREMIUM_REQUIRED",
        "Spotify exige Premium activo en la cuenta propietaria de la app para usar estas credenciales",
        403
      );
    }
    throw new AppError("PLAYLIST_FORBIDDEN", "No se puede leer esta playlist sin acceso de usuario", 403);
  }
  if (!response.ok) {
    throw new AppError("SPOTIFY_REQUEST_FAILED", "Spotify no devolvió la playlist correctamente", 502);
  }

  return JSON.parse(body) as T;
}

function selectAlbumImage(images: Array<{ url?: string; width?: number; height?: number }> | undefined): string {
  const image = images?.find((candidate) => candidate.width === 300) ?? images?.[0];
  return image?.url ?? "";
}

function selectArtistImage(images: Array<{ url?: string; width?: number; height?: number }> | undefined): string {
  const image = images?.find((candidate) => candidate.width === 320) ?? images?.[0];
  return image?.url ?? "";
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function withoutArtistId(track: ImportedTrack): Track {
  const { artistId: _artistId, ...cleanTrack } = track;
  return cleanTrack;
}

function shouldFallbackToEmbed(error: unknown): boolean {
  return (
    error instanceof AppError &&
    [
      "SPOTIFY_CREDENTIALS_MISSING",
      "SPOTIFY_AUTH_FAILED",
      "SPOTIFY_REQUEST_FAILED",
      "SPOTIFY_USER_AUTH_REQUIRED",
      "SPOTIFY_PREMIUM_REQUIRED",
      "PLAYLIST_FORBIDDEN"
    ].includes(error.code)
  );
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}
