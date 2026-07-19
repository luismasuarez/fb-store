# Quickstart: Scraper HTTP Microservice

> Guía de validación rápida para el scraper como microservicio HTTP

## Prerrequisitos

- Node.js >=22.13, pnpm 10.33.2
- Docker Compose (para probar el container completo)
- Playwright Chromium instalado (local): `npx playwright install chromium`

## 1. Verificación: Scraper Standalone (local)

```bash
# 1. Build shared + scraper
pnpm --filter @fb-store/shared build
pnpm --filter @fb-store/scraper build

# 2. Arrancar server (modo local, sin Xvfb)
#    Solo para probar endpoints HTTP — el login no funcionará sin display
PROFILE_DIR=./profiles/cuenta-1 node packages/scraper/dist/server.js
# → Server escuchando en http://localhost:3001

# 3. Set API key for subsequent requests
API_KEY="dev-key"
export SCRAPER_API_KEY="$API_KEY"

# 4. Health check (sin auth)
curl http://localhost:3001/api/v1/health
# → {"data":{"status":"ok","uptime":...,"profiles":1,...}}

# 5. Listar perfiles (con auth)
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/v1/profiles
# → {"data":{"profiles":[{"name":"cuenta-1","loginStatus":"unknown"}]}}
```

## 2. Verificación: Scrape via URL Directa

Requiere un perfil con sesión activa de Facebook (ejecutar `pnpm setup:login` primero, o ver paso 5).

```bash
# Scrape async
curl -X POST http://localhost:3001/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"url":"https://facebook.com/groups/859317869284157","maxPosts":10}'
# → 202 {"data":{"jobId":"scrape_abc"}}

# Ver estado
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/v1/scrape/scrape_abc
# → {"data":{"status":"running","progress":{"phase":"scrolling","current":3,"total":10}}}

# Esperar y ver resultado
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/v1/scrape/scrape_abc
# → {"data":{"status":"completed","result":{"posts":[...],"metrics":{...}}}}
```

## 3. Verificación: SSE Progreso

```bash
# Terminal 1: Disparar scrape
curl -X POST http://localhost:3001/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"url":"https://facebook.com/groups/859317869284157","maxPosts":10}'
# → {"data":{"jobId":"scrape_def"}}

# Terminal 2: Suscribirse a SSE
curl -N -H "x-api-key: $API_KEY" http://localhost:3001/api/v1/scrape/scrape_def/events
# → event: progress
#    data: {"phase":"navigating","current":0,"total":1}
# → event: progress
#    data: {"phase":"scrolling","current":1,"total":10}
# → event: progress
#    data: {"phase":"extracting","current":5,"total":0}
# → event: progress
#    data: {"phase":"downloading","current":2,"total":5}
# → event: log
#    data: {"message":"📦 5 posts extraídos"}
# → event: complete
#    data: {"posts":[...],"metrics":{...}}
```

## 4. Verificación: Scrape via groupId (DB mode)

Requiere PostgreSQL corriendo y un grupo registrado en la DB.

```bash
# Crear un grupo via Admin UI o API
# Luego:
curl -X POST http://localhost:3001/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"groupId":"uuid-del-grupo","maxPosts":20}'
# → 202 {"data":{"jobId":"scrape_ghi"}}
```

## 5. Verificación: Perfiles + Sesión

```bash
# Crear perfil
curl -X POST http://localhost:3001/api/v1/profiles \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"name":"cuenta-2"}'
# → 201 {"data":{"name":"cuenta-2","path":"/app/profiles/cuenta-2"}}

# Verificar sesión (sin login previo → dead)
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/v1/profiles/cuenta-2/check
# → {"data":{"profile":"cuenta-2","alive":false,"reason":"redirected-to-login"}}
```

## 6. Verificación: Login via VNC (requiere Docker)

```bash
# Build y up del scraper
SCRAPER_API_KEY="dev-key" docker compose up --build scraper -d

# Iniciar login
curl -X POST http://localhost:3001/api/v1/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"profile":"cuenta-2"}'
# → 201 {"data":{"profile":"cuenta-2","vncUrl":"http://scraper:6080/vnc.html?password=fbstore"}}

# Abrir http://scraper:6080 en el navegador
# Se ve Chrome con facebook.com cargado
# Hacer login manual → cerrar Chrome

# Verificar sesión
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/v1/profiles/cuenta-2/check
# → {"data":{"profile":"cuenta-2","alive":true,"reason":"feed-visible","checkedAt":"..."}}
```

## 7. Verificación: Dashboard UI

```bash
# Abrir en el navegador
open http://localhost:3001/dashboard
# → Lista perfiles, botones de verificar/login, scrape rápido
```

## 8. Verificación: Integración con NestJS API + Admin UI

```bash
# Toda la stack:
docker compose up --build -d

# 1. Login en Admin UI: http://localhost:3000
# 2. Ir a Dashboard → "Scrapear ahora"
# 3. Ver barra de progreso real con fases
# 4. Ver notificación cuando termina
# 5. Verificar que los posts aparecen en RawPosts
```

## Lista de verificación rápida

| Paso | Comando | Esperado |
|------|---------|----------|
| Server arranca | `SCRAPER_API_KEY=dev node dist/server.js` | `Server listening on :3001` |
| Health check | `GET /api/v1/health` | `status: "ok"` |
| Auth requerida | `GET /api/v1/profiles` (sin x-api-key) | 401 |
| List profiles | `GET /api/v1/profiles` con x-api-key | Array de perfiles |
| Crear profile | `POST /api/v1/profiles` con x-api-key | 201 Created |
| Scrape URL | `POST /api/v1/scrape { url }` con x-api-key | 202 + jobId |
| SSE events | `GET /api/v1/scrape/:id/events` con x-api-key | Stream de eventos |
| Sync scrape | `POST /api/v1/scrape { url, wait:true }` con x-api-key | 200 + posts |
| Session check | `GET /api/v1/profiles/:name/check` con x-api-key | alive true/false |
| Login VNC | `POST /api/v1/login` con x-api-key | 201 + vncUrl |
| Dashboard | `GET /dashboard` | HTML con perfiles |
| Sin Redis | Verificar que Redis no corre | Scraper funciona igual |
