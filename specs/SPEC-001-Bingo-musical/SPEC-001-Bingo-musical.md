# Musical Bingo — Especificación Completa (SDD)

> Versión 1.0 · Metodología Spec-Driven Development

---

## Índice

1. [Visión del Producto](#1-visión-del-producto)
2. [Alcance y Límites](#2-alcance-y-límites)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Modelo de Datos](#4-modelo-de-datos)
5. [Autenticación y Sesión](#5-autenticación-y-sesión)
6. [Integración con Spotify](#6-integración-con-spotify)
7. [Flujos Principales (User Stories + Specs)](#7-flujos-principales)
8. [Pantallas y Componentes de UI](#8-pantallas-y-componentes-de-ui)
9. [Lógica de Negocio](#9-lógica-de-negocio)
10. [Tiempo Real (WebSockets)](#10-tiempo-real-websockets)
11. [API REST — Endpoints](#11-api-rest--endpoints)
12. [Manejo de Errores](#12-manejo-de-errores)
13. [Stack Tecnológico](#13-stack-tecnológico)
14. [Estructura de Carpetas](#14-estructura-de-carpetas)
15. [Fases de Implementación](#15-fases-de-implementación)

---

## 1. Visión del Producto

**Musical Bingo** es una aplicación móvil (y web responsive) que permite a un grupo de amigos reunidos físicamente jugar al bingo usando canciones de una playlist de Spotify como "números" del bombo.

### Propuesta de valor
- Sin necesidad de imprimir cartones físicos.
- La música la gestiona Spotify (el anfitrión reproduce la playlist; los jugadores marcan las canciones en su cartón).
- Se puede jugar en casa, en una fiesta o en cualquier reunión.
- Sin registro complicado: el anfitrión se conecta con Spotify, los invitados entran con un enlace.

### Actores del sistema
| Actor | Descripción |
|---|---|
| **Host** | Crea la sala, vincula la playlist, arranca el juego |
| **Player** | Se une a la sala mediante enlace o código, juega con su cartón |
| **Sistema** | Genera cartones, valida bingo, gestiona estado de la sala |

---

## 2. Alcance y Límites

### Incluido en v1.0
- Creación de sala con código de 6 caracteres e invitación por enlace/QR
- Autenticación del host via Spotify OAuth 2.0 (PKCE, sin backend secreto)
- Los guests entran con un nombre de usuario (sin cuenta, solo sesión)
- Selección de playlist de Spotify del host
- Generación de cartón 4×4 aleatorio por jugador
- Marcar/desmarcar casillas manualmente
- Detección de bingo completo con popup de confirmación
- Fin de juego y pantalla de resultados
- Rejugar con la misma sala y playlist

### Fuera de alcance (v1.0)
- Reproducción automática de música desde la app (requiere Spotify Premium SDK y permisos complejos)
- Chat entre jugadores
- Sistema de cuentas para los guests
- Soporte multi-bingo (varios ganadores antes de fin)
- Estadísticas históricas

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────┐
│         Cliente (React Native)       │
│  ┌──────────┐  ┌──────────────────┐ │
│  │  Host UI │  │   Player UI      │ │
│  └────┬─────┘  └────────┬─────────┘ │
│       │                 │           │
└───────┼─────────────────┼───────────┘
        │                 │
        ▼                 ▼
┌───────────────────────────────────┐
│        API Backend (Node.js)       │
│  ┌─────────┐  ┌─────────────────┐ │
│  │REST API │  │  WebSocket (WS) │ │
│  └────┬────┘  └────────┬────────┘ │
│       │                │          │
│  ┌────▼────────────────▼────────┐ │
│  │       Lógica de Dominio      │ │
│  │  (Rooms · Cards · Game)      │ │
│  └────────────┬─────────────────┘ │
│               │                   │
│  ┌────────────▼─────────────────┐ │
│  │         PostgreSQL            │ │
│  └──────────────────────────────┘ │
└───────────────────────────────────┘
        │
        ▼
┌───────────────────┐
│   Spotify Web API  │
│  (playlists/tracks)│
└───────────────────┘
```

### Principios de diseño
- El backend **nunca** almacena tokens de Spotify del host; el cliente los gestiona y los envía por petición.
- Las salas son efímeras: se eliminan 24 horas después de su creación.
- Los cartones se generan en el servidor para evitar trampas.

---

## 4. Modelo de Datos

### Room (Sala)
```typescript
interface Room {
  id: string;              // UUID
  code: string;            // "XK93PL" — 6 chars alfanumérico mayúscula
  status: 'lobby' | 'playing' | 'finished';
  hostId: string;          // PlayerId del host
  playlistId: string;      // ID de playlist de Spotify
  playlistName: string;    // Nombre de la playlist (cacheado)
  tracks: Track[];         // Canciones de la playlist (barajadas)
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  winnerId?: string;       // PlayerId del ganador
}
```

### Player (Jugador)
```typescript
interface Player {
  id: string;              // UUID
  roomId: string;
  name: string;            // Nombre elegido al unirse
  isHost: boolean;
  spotifyAccessToken?: string;  // Solo si es host (no persiste en BD)
  joinedAt: Date;
  card?: BingoCard;        // Null hasta que empieza el juego
}
```

### Track (Canción)
```typescript
interface Track {
  spotifyId: string;       // ID de Spotify
  name: string;
  artist: string;
  imageUrl: string;        // URL de portada del álbum (300×300)
  previewUrl?: string;     // URL preview 30s (puede ser null en Spotify)
}
```

### BingoCard (Cartón)
```typescript
interface BingoCard {
  id: string;
  playerId: string;
  cells: BingoCell[][];   // Array 4×4
  markedCount: number;     // Cache para detectar bingo rápido
  lastMarkedCellIndex?: [number, number]; // Fila, columna de la última marcada
}

interface BingoCell {
  track: Track;
  marked: boolean;
}
```

### GameEvent (Evento de juego — para WS)
```typescript
interface GameEvent {
  type: 'player_joined' | 'player_left' | 'game_started' | 
        'cell_marked' | 'cell_unmarked' | 'bingo_claimed' | 
        'bingo_confirmed' | 'bingo_denied' | 'game_finished';
  roomId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}
```

---

## 5. Autenticación y Sesión

### Host (Spotify OAuth 2.0 con PKCE)
```
1. Usuario pulsa "Conectar con Spotify"
2. App genera code_verifier + code_challenge (PKCE)
3. Redirect a accounts.spotify.com/authorize con:
   - client_id
   - redirect_uri
   - scope: "playlist-read-private playlist-read-collaborative"
   - code_challenge_method: S256
   - code_challenge
4. Spotify redirige a la app con ?code=...
5. App intercambia code por access_token + refresh_token
6. access_token se guarda en SecureStore (Expo) o Keychain
7. El token se refresca automáticamente con refresh_token antes de expirar
```

**Scopes requeridos:** `playlist-read-private playlist-read-collaborative`

### Guest (sin cuenta)
```
1. Guest abre enlace: musibingo.app/join/XK93PL
2. Pantalla pide nombre de usuario (máx. 20 caracteres)
3. Backend crea Player con nombre + roomId
4. Se devuelve un guestToken (JWT firmado, sin expiración mientras dure la sala)
5. El guestToken se guarda en AsyncStorage
```

---

## 6. Integración con Spotify

### Obtener playlists del usuario
```
GET https://api.spotify.com/v1/me/playlists?limit=50
Authorization: Bearer {access_token}

Response mapeado:
{
  id: item.id,
  name: item.name,
  imageUrl: item.images[0]?.url,
  trackCount: item.tracks.total
}
```

### Obtener canciones de una playlist
```
GET https://api.spotify.com/v1/playlists/{playlist_id}/tracks
  ?fields=items(track(id,name,artists,album))
  &limit=100

Filtros aplicados en backend:
- Excluir tracks locales (track.is_local === true)
- Excluir podcasts (track.type !== 'track')
- Excluir tracks sin id
- Mínimo requerido: 16 canciones (para llenar un cartón 4×4)
- Máximo almacenado: 200 canciones (playlists muy grandes se truncan aleatoriamente)
```

### Caché de tracks
Los tracks se almacenan en la tabla `rooms.tracks` al crear la sala. No se vuelven a consultar durante el juego para evitar dependencia en tiempo real de la API de Spotify.

---

## 7. Flujos Principales

### FLUJO 1: Crear Sala

**Precondición:** Host autenticado con Spotify

**Spec:**
```
GIVEN un host autenticado
WHEN pulsa "Nueva Partida"
THEN se muestra la lista de sus playlists de Spotify

GIVEN la lista de playlists visible
WHEN selecciona una playlist con < 16 canciones
THEN se muestra error "Esta playlist necesita al menos 16 canciones"

GIVEN la lista de playlists visible
WHEN selecciona una playlist válida
THEN el backend:
  1. Obtiene los tracks de la playlist via Spotify API
  2. Genera un código de sala único de 6 caracteres
  3. Crea la Room con status='lobby'
  4. Devuelve { roomId, code, inviteUrl, qrCodeBase64 }
THEN la app navega a la pantalla Lobby mostrando:
  - Código: XK93PL (en grande)
  - QR code
  - URL copiable: musibingo.app/join/XK93PL
  - Lista de jugadores (solo el host de momento)
  - Botón "Empezar Bingo" (desactivado si < 2 jugadores)
```

### FLUJO 2: Unirse a Sala

**Spec:**
```
GIVEN un guest que abre el enlace musibingo.app/join/XK93PL
WHEN la sala existe y está en status='lobby'
THEN se muestra pantalla de "Elige tu nombre"

WHEN el guest introduce un nombre y pulsa "Unirme"
THEN backend:
  1. Valida que la sala existe y está en lobby
  2. Valida que el nombre no está ya en uso en esa sala
  3. Crea el Player
  4. Emite evento WS player_joined a todos en la sala
  5. Devuelve { guestToken, playerId }
THEN el guest ve la pantalla Lobby esperando

WHEN la sala está en status='playing'
THEN se muestra "Esta partida ya ha comenzado. Pide al host que cree una nueva."

WHEN la sala no existe o ha expirado
THEN se muestra "Sala no encontrada o expirada."
```

### FLUJO 3: Empezar Bingo

**Spec:**
```
GIVEN el host en el Lobby con ≥ 2 jugadores
WHEN pulsa "Empezar Bingo"
THEN backend:
  1. Verifica que hay ≥ 2 jugadores
  2. Para cada jugador:
     a. Selecciona 16 canciones aleatorias (sin repetición entre sí dentro del cartón)
     b. Las distribuye en una matriz 4×4 aleatoria
     c. Crea BingoCard con todas las células marked=false
  3. Actualiza Room.status = 'playing', Room.startedAt = now()
  4. Emite evento WS game_started con { cards: { [playerId]: BingoCard } }
THEN cada jugador ve su propio cartón
THEN el host ve su cartón Y un panel de control lateral con la lista de jugadores

REGLA: Cada cartón tiene canciones distintas entre sí pero pueden coincidir 
       canciones entre cartones de distintos jugadores.
```

### FLUJO 4: Marcar/Desmarcar Celda

**Spec:**
```
GIVEN un jugador viendo su cartón
WHEN pulsa una celda no marcada
THEN la celda se marca visualmente (animación de check)
THEN se emite WS cell_marked { playerId, row, col }
THEN si markedCount == 16 → activar lógica de bingo (FLUJO 5)

WHEN pulsa una celda ya marcada
THEN la celda se desmarca visualmente
THEN se emite WS cell_unmarked { playerId, row, col }

NOTA: Las marcas son solo locales y visibles para el propio jugador.
      El servidor registra el estado para poder recargar si se pierde conexión.
```

### FLUJO 5: Reclamación de Bingo

**Spec:**
```
GIVEN un jugador que acaba de marcar su última casilla (celda 16)
WHEN markedCount alcanza 16
THEN aparece un Modal de confirmación:
  - Título: "¡Bingo!"
  - Subtítulo: "¿Has completado el cartón?"
  - Botón primario: "¡Sí, he ganado!"
  - Botón secundario: "Ops, me equivoqué"

WHEN pulsa "¡Sí, he ganado!"
THEN backend valida que todas las celdas del cartón están marcadas
THEN si válido:
  - Room.status = 'finished', Room.winnerId = playerId
  - Emit WS bingo_confirmed { winnerId, winnerName }
  - Todos los jugadores ven pantalla de "¡[Nombre] ha ganado!"
THEN si inválido (edge case — no debería ocurrir en condiciones normales):
  - Emit WS bingo_denied { playerId }
  - El modal se cierra, sin cambios

WHEN pulsa "Ops, me equivoqué"
THEN la última celda marcada se desmarca automáticamente
THEN markedCount = 15
THEN modal desaparece
THEN el juego continúa normalmente
```

### FLUJO 6: Fin de Juego y Rejugar

**Spec:**
```
GIVEN Room.status = 'finished'
THEN todos los jugadores ven pantalla de resultados:
  - Nombre y foto (inicial) del ganador
  - Cartón del ganador con todas las celdas marcadas
  - Botón "Jugar otra vez" (solo visible para el host)
  - Botón "Salir"

WHEN el host pulsa "Jugar otra vez"
THEN backend:
  1. Resetea la room: status='lobby', borra todos los BingoCards
  2. Mantiene los mismos tracks (misma playlist)
  3. Mantiene los mismos jugadores
  4. Emit WS game_reset
THEN todos los jugadores vuelven al Lobby
```

---

## 8. Pantallas y Componentes de UI

### Pantalla 1: Bienvenida / Home
- Logo + nombre de la app
- Botón "Crear partida" → Spotify Login si no autenticado
- Botón "Unirme a una partida" → Input de código de sala
- Si ya hay un guestToken guardado y la sala sigue activa → "Continuar partida"

### Pantalla 2: Autenticación Spotify (solo host)
- Pantalla en blanco con spinner mientras se hace el redirect
- En caso de error: "No pudimos conectar con Spotify. Inténtalo de nuevo."

### Pantalla 3: Selección de Playlist
- AppBar: "Elige una playlist"
- Lista scrollable de playlists con:
  - Imagen de portada (40×40, redondeada)
  - Nombre de playlist
  - Número de canciones
- Barra de búsqueda para filtrar por nombre
- Loading state con skeleton cards

### Pantalla 4: Lobby
**Para el host:**
- Código de sala grande (fuente monospace, 32px)
- QR Code (200×200)
- Botón "Copiar enlace"
- Lista de jugadores con avatares de inicial
- Chip de estado por jugador: "Conectado"
- Botón "Empezar Bingo" (disabled si < 2 jugadores)
- Badge con número de jugadores: "3 jugadores"

**Para el guest:**
- Mensaje: "Esperando a que el anfitrión inicie el juego..."
- Lista de jugadores presentes
- Indicador de conexión WebSocket

### Pantalla 5: Cartón de Bingo (pantalla principal del juego)
- AppBar: nombre de la sala + nombre del jugador
- Grid 4×4 de células
- Cada célula muestra:
  - Imagen del álbum (ocupa ~70% de la célula)
  - Nombre de la canción (truncado a 2 líneas, 10px)
  - Artista (truncado a 1 línea, 9px, color secundario)
- Célula marcada: overlay semitransparente verde con icono ✓
- Animación al marcar: scale bounce (0.9 → 1.1 → 1.0)
- Animación al desmarcar: fade del overlay
- Contador de marcas: "12/16" en el AppBar

**Componente BingoCell:**
```typescript
interface BingoCellProps {
  cell: BingoCell;
  onPress: () => void;
  disabled: boolean; // true cuando el juego ha terminado
}
```

### Pantalla 6: Modal de Confirmación de Bingo
- Fondo: blur semitransparente
- Card central con:
  - Emoji 🎉 (grande, 64px)
  - Título: "¡Bingo!"
  - Subtítulo: "¿Has completado todas las canciones?"
  - Botón primario verde: "¡Sí, he ganado!"
  - Botón secundario gris: "Ops, me equivoqué"

### Pantalla 7: Resultados
- Confetti animation (react-native-confetti-cannon)
- Nombre del ganador en grande
- Avatar (inicial en círculo grande)
- Mensaje: "[Nombre] ha hecho BINGO 🎵"
- Cartón del ganador (en miniatura, solo lectura)
- Botón "Jugar otra vez" (host only)
- Botón "Salir" (todos)

---

## 9. Lógica de Negocio

### Generación de Cartón
```typescript
function generateCard(tracks: Track[], seed?: string): BingoCell[][] {
  // 1. Mezclar tracks usando Fisher-Yates shuffle
  const shuffled = fisherYatesShuffle([...tracks], seed);
  
  // 2. Seleccionar las primeras 16
  const selected = shuffled.slice(0, 16);
  
  // 3. Construir matriz 4×4
  const cells: BingoCell[][] = [];
  for (let row = 0; row < 4; row++) {
    cells[row] = [];
    for (let col = 0; col < 4; col++) {
      cells[row][col] = {
        track: selected[row * 4 + col],
        marked: false
      };
    }
  }
  return cells;
}
```

### Detección de Bingo
```typescript
function isBingoComplete(card: BingoCard): boolean {
  // Bingo = todas las 16 casillas marcadas
  return card.cells.every(row => row.every(cell => cell.marked));
}

// En la v1.0 solo se valida cartón completo (no filas/columnas/diagonales)
// Extensible a líneas en v2.0
```

### Desmarcar última celda (Flujo 5 - "me equivoqué")
```typescript
function unmarkLastCell(card: BingoCard): BingoCard {
  if (!card.lastMarkedCellIndex) return card;
  const [row, col] = card.lastMarkedCellIndex;
  const newCard = deepClone(card);
  newCard.cells[row][col].marked = false;
  newCard.markedCount = Math.max(0, card.markedCount - 1);
  newCard.lastMarkedCellIndex = undefined;
  return newCard;
}
```

---

## 10. Tiempo Real (WebSockets)

### Conexión
```
ws://api.musibingo.app/ws?roomId={roomId}&token={guestToken|hostToken}
```

### Eventos del servidor → cliente

| Evento | Payload | Descripción |
|---|---|---|
| `player_joined` | `{ playerId, name }` | Nuevo jugador en la sala |
| `player_left` | `{ playerId, name }` | Jugador desconectado |
| `game_started` | `{ cards }` | Juego iniciado, incluye cartón de cada jugador |
| `bingo_confirmed` | `{ winnerId, winnerName }` | Bingo validado |
| `bingo_denied` | `{ playerId }` | Bingo inválido (edge case) |
| `game_finished` | `{ winnerId, winnerName }` | Pantalla de resultados |
| `game_reset` | `{}` | Host ha reiniciado la partida |
| `card_state` | `{ card }` | Re-sincronización al reconectar |

### Eventos del cliente → servidor
```typescript
// Marcar celda
{ type: 'mark_cell', row: number, col: number }

// Desmarcar celda
{ type: 'unmark_cell', row: number, col: number }

// Reclamar bingo
{ type: 'claim_bingo' }

// Respuesta a confirmación
{ type: 'confirm_bingo' }  // "sí, gané"
{ type: 'deny_bingo' }     // "me equivoqué"
```

### Reconexión
- Cliente intenta reconectar cada 2s con backoff exponencial (máx. 30s)
- Al reconectar, servidor envía `card_state` con el estado actual del cartón
- Si la sala ha terminado mientras el cliente estaba desconectado, se redirige a resultados

---

## 11. API REST — Endpoints

### Auth & Host
```
POST /api/auth/spotify/callback
  Body: { code: string, codeVerifier: string }
  Response: { accessToken, refreshToken, expiresIn }

POST /api/auth/spotify/refresh
  Body: { refreshToken: string }
  Response: { accessToken, expiresIn }
```

### Rooms
```
POST /api/rooms
  Auth: Host (Spotify token)
  Body: { playlistId: string, spotifyAccessToken: string }
  Response: { room: Room, inviteUrl: string, qrCodeBase64: string, hostToken: string }

GET /api/rooms/:code
  Response: { room: Room (sin tracks), playerCount: number }

POST /api/rooms/:code/join
  Body: { name: string }
  Response: { player: Player, guestToken: string }

POST /api/rooms/:roomId/start
  Auth: Host token
  Response: { ok: true }

POST /api/rooms/:roomId/reset
  Auth: Host token
  Response: { ok: true }
```

### Spotify (proxy del host)
```
GET /api/spotify/playlists
  Auth: Host (Spotify token en header)
  Response: { playlists: SpotifyPlaylist[] }

GET /api/spotify/playlists/:playlistId/tracks
  Auth: Host (Spotify token en header)
  Response: { tracks: Track[] }
```

---

## 12. Manejo de Errores

| Código | Significado | UI |
|---|---|---|
| `ROOM_NOT_FOUND` | Sala inexistente o expirada | Toast: "Sala no encontrada" |
| `ROOM_ALREADY_STARTED` | Sala en juego, no se puede unir | Pantalla de error con opción de volver |
| `ROOM_FULL` | Más de 20 jugadores (límite v1.0) | Toast: "La sala está llena" |
| `NAME_TAKEN` | Nombre ya en uso en esa sala | Inline error en el input |
| `NOT_ENOUGH_TRACKS` | Playlist con < 16 canciones válidas | Toast con instrucciones |
| `SPOTIFY_TOKEN_EXPIRED` | Token expirado | Auto-refresh; si falla → logout |
| `WS_DISCONNECTED` | Pérdida de conexión WS | Banner "Sin conexión, reconectando..." |

---

## 13. Stack Tecnológico

### Frontend (Mobile)
| Tech | Razón |
|---|---|
| **React Native** con **Expo** | Cross-platform iOS/Android, web incluido |
| **Expo Router** | File-based routing, deep links nativos |
| **Zustand** | Estado global sencillo (room, player, card) |
| **TanStack Query** | Fetching y caché de datos REST |
| **React Native Reanimated 3** | Animaciones de cartón (mark/unmark) |
| **expo-secure-store** | Almacén seguro de tokens |
| **react-native-qrcode-svg** | Generación de QR en lobby |
| **react-native-confetti-cannon** | Animación de victoria |

### Backend
| Tech | Razón |
|---|---|
| **Node.js + Fastify** | Rendimiento alto, WebSocket nativo |
| **@fastify/websocket** | Plugin WS integrado |
| **PostgreSQL** | Base de datos relacional persistente |
| **Prisma ORM** | Type-safe DB access |
| **Redis** | Estado de sala en memoria (fast reads para WS) |
| **JWT (jose)** | Tokens de guest y host |

### DevOps / Servicios
| Servicio | Uso |
|---|---|
| **Railway** o **Fly.io** | Hosting backend |
| **Expo EAS Build** | Build de la app |
| **Supabase** | Alternativa all-in-one (DB + Auth) si se prefiere |

---

## 14. Estructura de Carpetas

```
musical-bingo/
├── apps/
│   ├── mobile/                    # Expo React Native
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── spotify-callback.tsx
│   │   │   ├── (tabs)/
│   │   │   │   └── index.tsx      # Home
│   │   │   ├── room/
│   │   │   │   ├── create.tsx     # Selección de playlist
│   │   │   │   ├── [code]/
│   │   │   │   │   ├── lobby.tsx
│   │   │   │   │   ├── game.tsx   # Cartón
│   │   │   │   │   └── results.tsx
│   │   │   │   └── join.tsx       # Input nombre de guest
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── BingoCard/
│   │   │   │   ├── BingoCard.tsx
│   │   │   │   ├── BingoCell.tsx
│   │   │   │   └── BingoCard.styles.ts
│   │   │   ├── BingoConfirmModal.tsx
│   │   │   ├── PlayerList.tsx
│   │   │   ├── QRCode.tsx
│   │   │   └── ConnectionBanner.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useRoom.ts
│   │   │   ├── useCard.ts
│   │   │   └── useSpotifyAuth.ts
│   │   ├── store/
│   │   │   ├── roomStore.ts
│   │   │   ├── playerStore.ts
│   │   │   └── cardStore.ts
│   │   └── lib/
│   │       ├── api.ts             # Cliente REST
│   │       ├── spotify.ts         # Wrapper Spotify API
│   │       └── constants.ts
│   │
│   └── api/                       # Fastify backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── rooms.ts
│       │   │   └── spotify.ts
│       │   ├── websocket/
│       │   │   ├── handler.ts     # Lógica WS principal
│       │   │   └── events.ts      # Tipos de eventos
│       │   ├── services/
│       │   │   ├── roomService.ts
│       │   │   ├── cardService.ts
│       │   │   └── spotifyService.ts
│       │   ├── db/
│       │   │   └── prisma.ts
│       │   ├── redis/
│       │   │   └── client.ts
│       │   └── app.ts
│       └── prisma/
│           └── schema.prisma
│
├── packages/
│   └── shared/                    # Tipos compartidos (TypeScript)
│       └── types/
│           ├── room.ts
│           ├── player.ts
│           ├── card.ts
│           └── events.ts
│
├── package.json                   # Monorepo (pnpm workspaces)
└── pnpm-workspace.yaml
```

---

## 15. Fases de Implementación

### Fase 1 — Fundamentos (Semana 1-2)
- [ ] Setup del monorepo (pnpm workspaces)
- [ ] Schema de Prisma + migraciones iniciales
- [ ] Autenticación Spotify OAuth PKCE en el cliente
- [ ] Endpoints REST: crear sala, unirse a sala
- [ ] Pantallas: Home, Selección playlist, Lobby (sin WS)

### Fase 2 — Tiempo real (Semana 3)
- [ ] Setup WebSocket en Fastify
- [ ] Hook `useWebSocket` en el cliente
- [ ] Eventos: player_joined, player_left
- [ ] Lobby funcional con WS

### Fase 3 — Juego (Semana 4)
- [ ] Lógica de generación de cartones en el servidor
- [ ] Pantalla de cartón 4×4 (BingoCard + BingoCell)
- [ ] Marcar/desmarcar celdas con animaciones
- [ ] Detección de bingo completo
- [ ] Modal de confirmación de bingo
- [ ] Eventos WS: game_started, bingo_confirmed, game_finished

### Fase 4 — Polish (Semana 5)
- [ ] Pantalla de resultados con confetti
- [ ] Flujo "Jugar otra vez"
- [ ] Reconexión automática WS
- [ ] Manejo de errores y edge cases
- [ ] QR Code en el lobby
- [ ] Pruebas end-to-end con 2+ dispositivos

### Fase 5 — Deploy (Semana 6)
- [ ] Configurar Railway/Fly.io para el backend
- [ ] Variables de entorno de producción
- [ ] EAS Build para iOS y Android
- [ ] Pruebas de carga básicas (20 jugadores simultáneos)

---

## Notas de implementación importantes

1. **Sin reproducción automática de música**: La app NO reproduce música. El host pone la playlist en Spotify manualmente y los jugadores marcan las canciones que van oyendo. Esto evita complejidades con el Spotify SDK de reproducción y los requisitos de Premium.

2. **Validación de bingo en servidor**: Aunque el cliente detecta el bingo localmente, el servidor siempre re-valida antes de declarar ganador. El cliente no puede hacer trampa.

3. **Estado del cartón en Redis**: El estado `marked` de cada celda se replica en Redis para reconexiones instantáneas sin consultar PostgreSQL.

4. **Límite de jugadores**: 20 por sala en v1.0. Ajustable via variable de entorno `MAX_PLAYERS_PER_ROOM`.

5. **Expiración de salas**: Un cron job limpia salas con `createdAt > 24h` cada hora.

6. **Imágenes de Spotify**: Las URLs de imágenes de Spotify pueden expirar. Cachear localmente en el cliente con React Query (`staleTime: Infinity` para la sesión actual).
```
