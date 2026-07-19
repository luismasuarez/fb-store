# REST API Contracts: Scraper HTTP

> Base URL: `http://scraper:3001/api/v1`

## Authentication

All requests (except health/ready) MUST include a valid API key via the `x-api-key` header. The API key is configured via `SCRAPER_API_KEY` env var. Requests without a valid key receive HTTP 401.

```http
x-api-key: your-api-key
```

## Common Response Envelope

### Success
```json
{
  "data": { ... }
}
```

### Error
```json
{
  "error": {
    "code": "validation" | "business" | "unknown",
    "message": "Human-readable description",
    "requestId": "uuid"
  }
}
```

**Error codes**: `validation` (input inválido) | `business` (regla de negocio) | `unknown` (error interno del scraper)

---

## Scrape

### POST /api/v1/scrape

Trigger a scrape job.

**Request Body**:
```json
{
  "url": "https://facebook.com/groups/859317869284157",
  "groupId": "uuid-del-grupo-en-db",
  "maxPosts": 20,
  "profile": "cuenta-1",
  "wait": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `url` | string | no* | — | URL directa del grupo de Facebook |
| `groupId` | string | no* | — | UUID del grupo en la base de datos |
| `maxPosts` | number | no | group.maxPosts \|\| 20 | Máximo de posts a extraer |
| `profile` | string | no | "cuenta-1" | Nombre del perfil a usar |
| `wait` | boolean | no | false | true → bloquea hasta que termine y devuelve resultado |

*Se requiere exactamente uno de `url` o `groupId`.

**Response** (async, wait=false — 202 Accepted):
```json
{
  "data": {
    "jobId": "scrape_abc123"
  }
}
```

**Response** (sync, wait=true — 200 OK):
```json
{
  "data": {
    "jobId": "scrape_abc123",
    "status": "completed",
    "result": {
      "posts": [
        {
          "fbPostId": "fb_123456",
          "text": "Texto del post...",
          "images": ["data:image/jpeg;base64,..."],
          "author": "Juan Pérez",
          "authorUrl": "/user/123",
          "timestamp": "2 hrs",
          "postUrl": "/groups/123/posts/456"
        }
      ],
      "metrics": {
        "postsFound": 15,
        "postsNew": 12,
        "durationMs": 45000
      }
    }
  }
}
```

**Status Codes**: 202 (async accepted), 200 (sync completed), 400 (validation error), 409 (perfil ocupado)

---

### GET /api/v1/scrape/:jobId

Get job status and result.

**Response** (200):
```json
{
  "data": {
    "jobId": "scrape_abc123",
    "status": "running",
    "progress": {
      "phase": "downloading",
      "current": 5,
      "total": 12
    },
    "result": null,
    "failedReason": null
  }
}
```

| Field | Description |
|-------|-------------|
| `status` | `pending` \| `running` \| `completed` \| `failed` |
| `progress.phase` | `queued` \| `navigating` \| `scrolling` \| `extracting` \| `downloading` \| `saving` |
| `result` | Present solo cuando status=completed. Misma estructura que POST sync. |

**Status Codes**: 200, 404 (job not found)

---

### GET /api/v1/scrape/:jobId/events

SSE stream of progress events.

**Response**: `text/event-stream`

```text
event: progress
data: {"phase":"scrolling","current":3,"total":10,"message":"Scroll 3/10"}

event: log
data: {"message":"📦 5 posts extraídos"}

event: complete
data: {"posts":[...],"metrics":{"postsFound":15,"postsNew":12,"durationMs":45000}}

event: error
data: {"message":"No se pudo conectar con Facebook"}
```

**Event types**:
| Event | Payload | Description |
|-------|---------|-------------|
| `progress` | `{ phase, current, total, message? }` | Progreso de la fase actual |
| `log` | `{ message }` | Mensaje de log arbitrario |
| `complete` | `{ posts, metrics }` | Scrape finalizado exitosamente |
| `error` | `{ message }` | Error fatal durante el scrape |

**Status Codes**: 200 (SSE stream), 404 (job not found)

---

## Profiles

### GET /api/v1/profiles

List all profiles.

**Response** (200):
```json
{
  "data": {
    "profiles": [
      {
        "name": "cuenta-1",
        "createdAt": "2026-07-19T12:00:00.000Z",
        "lastUsedAt": "2026-07-19T14:30:00.000Z",
        "loginStatus": "unknown"
      }
    ]
  }
}
```

---

### POST /api/v1/profiles

Create a new profile directory.

**Request Body**:
```json
{
  "name": "cuenta-2"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Solo alfanumérico + guiones (`^[a-zA-Z0-9_-]+$`) |

**Response** (201):
```json
{
  "data": {
    "name": "cuenta-2",
    "path": "/app/profiles/cuenta-2"
  }
}
```

**Status Codes**: 201 (created), 400 (validation), 409 (already exists)

---

### DELETE /api/v1/profiles/:name

Delete a profile.

**Status Codes**: 204 (deleted), 404 (not found), 409 (profile in use)

---

### GET /api/v1/profiles/:name/check

Check if profile's Facebook session is still alive.

**Response** (200):
```json
{
  "data": {
    "profile": "cuenta-1",
    "alive": true,
    "reason": "feed-visible",
    "checkedAt": "2026-07-19T15:00:00.000Z"
  }
}
```

| Field | Description |
|-------|-------------|
| `alive` | true si la sesión de Facebook es válida |
| `reason` | `feed-visible` \| `redirected-to-login` \| `network-error` \| `chrome-error` |

**Status Codes**: 200, 404 (profile not found)

---

## Login

### POST /api/v1/login

Start an interactive login session for a profile.

**Request Body**:
```json
{
  "profile": "cuenta-1"
}
```

**Response** (201):
```json
{
  "data": {
    "profile": "cuenta-1",
    "vncUrl": "http://scraper:6080/vnc.html?password=fbstore",
    "expiresIn": 300
  }
}
```

| Field | Description |
|-------|-------------|
| `vncUrl` | URL para abrir en el navegador y ver el display de Chrome |
| `expiresIn` | Segundos antes de que la sesión VNC expire por inactividad |

**Flow**:
1. POST /login → scraper lanza Chromium en Xvfb :99 apuntando a facebook.com
2. El operador abre `vncUrl` en su navegador
3. Ve la pantalla de Facebook, hace login manualmente
4. Cuando termina, cierra la pestaña de Chrome o hace POST /login/:profile/complete
5. El perfil persiste en `/app/profiles/{name}/`
6. Cualquier sesión VNC previa se cancela automáticamente

**Status Codes**: 201, 400 (validation), 409 (ya hay un login en progreso para este perfil)

---

### GET /api/v1/login/:profile/status

Check login session status.

**Response** (200):
```json
{
  "data": {
    "profile": "cuenta-1",
    "state": "login-in-progress",
    "vncUrl": "http://scraper:6080/vnc.html?password=fbstore"
  }
}
```

| State | Description |
|-------|-------------|
| `idle` | No hay login activo para este perfil |
| `login-in-progress` | Chrome está abierto esperando login del operador |
| `logged-in` | Login completado, perfil guardado |

**Status Codes**: 200

---

## Health

### GET /api/v1/health

**Response** (200):
```json
{
  "data": {
    "status": "ok",
    "uptime": 3600,
    "profiles": 2,
    "chrome": true,
    "display": true
  }
}
```

| Field | Description |
|-------|-------------|
| `uptime` | Segundos desde que arrancó el servidor |
| `profiles` | Cantidad de perfiles disponibles |
| `chrome` | true si Chromium está accesible |
| `display` | true si Xvfb está corriendo |

**Status Codes**: 200, 503 (chrome/display no disponible)

---

### GET /api/v1/ready

Readiness probe (para Docker healthcheck).

**Response** (200):
```json
{ "ready": true }
```

**Status Codes**: 200 (ready), 503 (not ready)
