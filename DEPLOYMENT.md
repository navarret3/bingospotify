# Deployment

## Arquitectura recomendada

- Frontend web en Vercel.
- Backend API y WebSocket en Railway usando el `Dockerfile` del repositorio.
- Código versionado en GitHub.
- Dominio con dos subdominios: `app.tudominio.com` para Vercel y `api.tudominio.com` para Railway.

## Qué está preparado en este repo

- Build del monorepo: `npm run build`
- Export web para Vercel: `npm run build:web`
- Build del backend y paquete compartido: `npm run build:api`
- CI en GitHub Actions: `.github/workflows/ci.yml`
- Configuración de Vercel: `vercel.json`
- Configuración de Railway por Docker: `railway.json` y `Dockerfile`

## Variables de entorno

### Frontend en Vercel

- `EXPO_PUBLIC_API_BASE_URL=https://api.tudominio.com`

### Backend en Railway

- `HOST=0.0.0.0`
- `PORT=4000`
- `APP_BASE_URL=https://app.tudominio.com`
- `CORS_ORIGIN=https://app.tudominio.com`
- `SPOTIFY_CLIENT_ID=...`
- `SPOTIFY_CLIENT_SECRET=...`
- `SPOTIFY_REDIRECT_URI=https://app.tudominio.com/spotify-callback`
- `SPOTIFY_MARKET=ES`
- `MAX_TRACKS_PER_ROOM=200`

## Flujo de despliegue recomendado

1. Crea un repositorio nuevo en GitHub.
2. Sube este código a la rama `main`.
3. En Vercel, importa el repositorio y despliega usando la configuración del archivo `vercel.json`.
4. En Railway, crea un proyecto nuevo desde el mismo repositorio y despliega con Docker.
5. Configura el dominio y apunta los DNS de `app` a Vercel y `api` a Railway.
6. Añade en Spotify Dashboard la redirect URI pública del paso anterior.
7. Lanza una primera prueba real con varios móviles.

## Pruebas reales mínimas

1. Crear una sala desde `app.tudominio.com`.
2. Entrar desde 3 a 5 móviles con el QR o enlace.
3. Verificar que la sala se actualiza en tiempo real.
4. Empezar una partida y comprobar que cada jugador recibe su cartón.
5. Forzar una reconexión apagando y encendiendo Wi-Fi en un móvil.
6. Probar el callback de Spotify con la URL pública.

## Limitación actual importante

El estado de las salas sigue en memoria en el backend. Si Railway reinicia el contenedor, las salas activas se perderán. Para una producción más robusta, el siguiente paso es persistir salas, jugadores y tokens en base de datos o Redis.

## Railway: error de build típico

Si Railway muestra un log parecido a este:

```text
Railpack could not determine how to build the app
The app contents that Railpack analyzed contains:
./
└── README.md
```

significa que el servicio está apuntando al directorio equivocado o que Railway no está usando el `Dockerfile` del repo.

### Qué revisar en Railway

1. Abre el servicio.
2. Ve a `Settings` o `Build & Deploy`.
3. Comprueba que el `Root Directory` esté vacío o apunte a la raíz del repo.
4. Asegúrate de que el builder sea `Dockerfile` y que el path sea `Dockerfile`.
5. Si Railway sigue usando `Railpack`, crea el servicio otra vez desde GitHub y selecciona el builder por Dockerfile.

### Qué no debería pasar

- No debería analizar solo `README.md`.
- No debería intentar usar `start.sh`.
- No debería ignorar el `package.json` ni el `Dockerfile` que están en la raíz.
