# Musical Bingo

Aplicación web mobile-first para jugar al bingo musical con una playlist pública de Spotify.

## Desarrollo local

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env` en la raíz copiando `.env.example` y rellena:

```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8081/spotify-callback
SPOTIFY_MARKET=ES
MAX_TRACKS_PER_ROOM=200
PORT=4000
```

OAuth es opcional como respaldo. Si quieres usarlo, en Spotify Dashboard añade exactamente esta Redirect URI:

```text
http://127.0.0.1:8081/spotify-callback
```

3. Arranca API y web:

```bash
npm run dev
```

La web queda en `http://localhost:8081` y la API en `http://localhost:4000`.

## Spotify

El flujo principal no requiere login: el host pega una URL pública de Spotify y el backend intenta leerla con la API oficial de Spotify usando las credenciales de la app. Si Spotify bloquea ese acceso o faltan credenciales, cae automáticamente a la vista pública embebida.

Si Spotify limita la vista pública de alguna playlist, el host puede conectar Spotify con OAuth PKCE como respaldo. En ese caso el token de usuario se guarda localmente en el navegador y se envía al backend solo para importar las canciones al crear la sala.

## Estado actual

- Crear sala desde playlist pública de Spotify.
- Unirse por código o enlace `/join/:code`.
- Lobby con QR, código y lista de jugadores.
- WebSocket para lobby, inicio de partida, estado de cartón y final.
- Cartón 4x4 por jugador, marcado/desmarcado y validación de bingo completo.
- Resultados y volver a jugar con la misma sala.
