# Communication Contracts: Scraper Integration Pipeline

## Overview

Este documento describe los patrones de comunicación entre los componentes del sistema. Cada patrón especifica el protocolo, la dirección, la autenticación y el comportamiento esperado.

---

## 1. API NestJS → Scraper (REST + x-api-key)

| Aspect | Detail |
|--------|--------|
| **Protocol** | HTTP/1.1 |
| **Auth** | Header `x-api-key` |
| **URL base** | `http://scraper:3001/api/v1` |
| **Timeout** | 120s para polling, 300s para wait=true |
| **Acoplamiento** | Débil (solo URL + API key) |

### POST /api/v1/scrape (async — trigger)

```
Request:
  POST /api/v1/scrape
  x-api-key: <SCRAPER_API_KEY>
  Content-Type: application/json

  {
    "groupId": "uuid-del-grupo",
    "maxPosts": 20,
    "wait": false
  }

Response (202):
  { "jobId": "scrape_uuid" }
```

### GET /api/v1/scrape/:jobId (polling — status)

```
Request:
  GET /api/v1/scrape/:jobId
  x-api-key: <SCRAPER_API_KEY>

Response (200):
  {
    "id": "scrape_uuid",
    "status": "completed"|"running"|"failed"|"pending",
    "progress": { "phase": "saving", "current": 5, "total": 12 },
    "result": { "posts": [...], "metrics": { "postsFound": 15, "postsNew": 12, "durationMs": 45000 } },
    "createdAt": "2026-07-19T12:00:00.000Z"
  }

Response (404):
  { "error": { "code": "not_found", "message": "Job not found" } }
```

### POST /api/v1/scrape (sync — scheduler con wait=true)

```
Request:
  POST /api/v1/scrape
  x-api-key: <SCRAPER_API_KEY>
  Content-Type: application/json

  {
    "groupId": "uuid-del-grupo",
    "maxPosts": 20,
    "wait": true
  }

Response (200):
  {
    "posts": [...],
    "metrics": { "postsFound": 15, "postsNew": 12, "durationMs": 45000 }
  }

Response (4xx/5xx):
  { "error": { "code": "db_error"|"session_expired"|"network_error"|"business", "message": "...", "requestId": "uuid" } }
```

---

## 2. API NestJS → Scraper (SSE — proxy para Admin UI)

| Aspect | Detail |
|--------|--------|
| **Protocol** | HTTP Streaming (text/event-stream) |
| **Auth** | `x-api-key` (scraper) + JWT Bearer (Admin UI → API) |
| **Proxy** | NestJS usa `reply.hijack()` + `Readable.fromWeb()` |

### GET /api/v1/scrape/:jobId/events

```
Request:
  GET /api/v1/scrape/:jobId/events
  x-api-key: <SCRAPER_API_KEY>

Response (200):
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive

Stream:
  event: progress
  data: {"phase":"scrolling","current":3,"total":10}

  event: log
  data: {"message":"5 posts extraídos"}

  event: complete
  data: {"posts":[...],"metrics":{...}}

  event: error
  data: {"message":"Error description"}
```

---

## 3. API NestJS → AI Processor (BullMQ — existente)

| Aspect | Detail |
|--------|--------|
| **Protocol** | BullMQ via Redis |
| **Queue** | `{fb-store}:ai-process` |
| **Patrón** | Producer/Consumer |
| **Retry** | Exponential backoff, 3 attempts |

### Enqueue (desde AiProcessorService)

```typescript
await queueService.addAiProcessJob({ rawPostIds: ["uuid-1", "uuid-2"] });
```

### Job data

```typescript
interface AiProcessJobData {
  rawPostIds?: string[];   // undefined = process all pending
}
```

---

## 4. Scraper → PostgreSQL (Prisma — directo)

| Aspect | Detail |
|--------|--------|
| **Protocol** | PostgreSQL wire protocol via Prisma ORM |
| **URL** | `DATABASE_URL` env var |
| **Auth** | Usuario/contraseña en connection string |
| **Client** | `getPrismaClient()` de `@fb-store/shared` |

### Operaciones

| Operación | Tabla | Cuándo |
|-----------|-------|--------|
| `rawPost.create` | RawPost | Después de scrapeGroup, por cada post nuevo |
| `scrapeLog.create` | ScrapeLog | Después de savePosts, con métricas |
| `group.findUnique` | Group | Durante groupId mode (existente) |
| `group.findMany({ where: { isActive: true } })` | Group | Durante ciclo del scheduler |

---

## 5. Admin UI → API NestJS (REST + JWT — existente)

| Aspect | Detail |
|--------|--------|
| **Protocol** | HTTP/1.1 via Axios |
| **Auth** | Bearer JWT (access token + refresh token rotation) |
| **Base URL** | `/api` (proxy por el mismo servidor NestJS) |

### Endpoints relevantes a esta spec

| Método | Path | Body | Uso |
|--------|------|------|-----|
| POST | `/api/scrape` | `{ groupId?, maxPosts? }` | Disparar scrape (acepta groupId opcional) |
| GET | `/api/scrape/:jobId/events` | — | SSE de progreso (proxy al scraper) |
| GET | `/api/scrape/status/:jobId` | — | Estado del job |
| GET | `/api/groups` | `?page=1&limit=100` | Listar grupos para el selector |
| POST | `/api/ai-process` | `{ rawPostIds? }` | Procesar con IA |

---

## 6. Scheduler Interno (NestJS @nestjs/schedule)

| Aspect | Detail |
|--------|--------|
| **Mecanismo** | `SchedulerRegistry.addCronJob()` |
| **Nombre** | `"auto-scrape"` |
| **Cron** | Generado por `buildCron(intervalMinutes, hourStart, hourEnd)` |
| **Callback** | `executeScrapeCycle()` — método privado del servicio |

### Ciclo de ejecución

```
executeScrapeCycle()
  1. Verificar que no hay otro ciclo en ejecución (flag isRunning)
  2. Obtener grupos activos de DB
  3. Para cada grupo secuencialmente:
     a. POST /api/v1/scrape { groupId, maxPosts, wait: true }
        con AbortController timeout 300s
     b. Si éxito: POST /api/ai-process (via AiProcessorService)
     c. Si error: log y continuar
  4. Liberar flag isRunning
```

---

## 7. Scraper Job Tracker (in-memory TTL)

| Aspect | Detail |
|--------|--------|
| **Estructura** | `Map<string, JobState>` |
| **TTL** | 30 minutos para jobs completed/failed |
| **Verificación** | `setInterval` cada 60s que recorre el Map |
| **Exclusión** | Jobs en estado pending/running NO se eliminan |
