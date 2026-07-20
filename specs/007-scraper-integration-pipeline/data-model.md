# Data Model: Scraper Integration Pipeline

## Entities

### ScrapeJob (in-memory — job-tracker.ts)

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID generado por el scraper |
| status | JobStatus | pending → running → completed/failed |
| config.url | string? | URL directa del grupo (opcional) |
| config.groupId | string? | UUID del grupo en DB (opcional) |
| config.maxPosts | number | Máximo de posts a extraer |
| config.profile | string | Nombre del perfil usado |
| progress.phase | JobPhase | Fase actual: queued, navigating, scrolling, extracting, downloading, saving |
| progress.current | number | Items procesados en la fase actual |
| progress.total | number | Total de items en la fase actual |
| result.posts | RawPost[] | Posts extraídos (en memoria) |
| result.metrics | ScrapeMetrics | Métricas de la ejecución |
| failedReason | string? | Mensaje de error si falló |
| createdAt | Date | Timestamp de creación |
| sseClients | Set<SSEClient> | Clientes SSE suscritos |

**Lifecycle**: create → pending → running → completed|failed → [TTL 30 min] → deleted

### ScrapeMetrics

| Field | Type | Source |
|-------|------|--------|
| groupId | string | ID del grupo |
| postsFound | number | Total extraído por scrapeGroup() |
| postsNew | number | Retornado por savePosts() (excluye duplicados P2002) |
| durationMs | number | Tiempo total del scrape |

### JobStatus (enum)

`pending` → `running` → `completed` | `failed`

### JobPhase (enum)

`queued` → `navigating` → `scrolling` → `extracting` → `downloading` → `saving`

### ScheduleConfig (in-memory — scheduler.service.ts)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| intervalMinutes | number | 240 | Intervalo entre ejecuciones |
| hourStart | number | 8 | Hora de inicio de ventana (0-23) |
| hourEnd | number | 22 | Hora de fin de ventana (1-24) |
| enabled | boolean | true | Si el scheduler está activo |

### CronJob (dinámico — SchedulerRegistry)

| Property | Description |
|----------|-------------|
| name | "auto-scrape" |
| cronExpression | Generado por buildCron(interval, hourStart, hourEnd) |
| callback | executeScrapeCycle() — itera grupos activos |

## Data Flow Diagrams

### Flow 1: Scrape Manual (Admin UI → API → Scraper)

```
Admin UI                 API (NestJS)                   Scraper                    DB
   │                         │                             │                        │
   │ 1. POST /api/scrape     │                             │                        │
   │   { groupId }           │                             │                        │
   │────────────────────────▶│                             │                        │
   │                         │ 2. POST /api/v1/scrape      │                        │
   │                         │   { groupId, wait: false }  │                        │
   │                         │────────────────────────────▶│                        │
   │                         │                             │ 3. scrapeGroup()        │
   │                         │   202 { jobId }             │    ─► extrae posts     │
   │                         │◀────────────────────────────│    ─► savePosts() ────▶│ RawPost
   │                         │                             │    ─► saveScrapeLog() ▶│ ScrapeLog
   │ 4. SSE: /api/scrape/:jobId/events                      │                        │
   │◀────────────────────────│◀──── progress events ───────│                        │
   │                         │                             │                        │
   │                         │ 5. Polling (background)     │                        │
   │                         │   GET /scrape/:jobId        │                        │
   │                         │   cada 5s hasta "completed" │                        │
   │                         │────────────────────────────▶│                        │
   │                         │◀── { status: completed } ───│                        │
   │                         │                             │                        │
   │                         │ 6. Auto-chain AI            │                        │
   │                         │   POST /api/ai-process      │                        │
   │                         │   (via AiProcessorService)  │                        │
   │                         │─────────────────────────────┼───────────────────────▶│
   │                         │                             │                        │
   │ 7. SSE "complete"       │                             │                        │
   │◀────────────────────────│                             │                        │
```

### Flow 2: Scheduler Automático

```
Scheduler (@Cron cada N min)
   │
   ├─ 1. Check if previous cycle is still running
   │      └─ If busy → skip this tick (FR-019)
   │
   ├─ 2. Fetch active groups from DB (GroupRepository.findActive())
   │
   ├─ 3. For each active group (sequential):
   │      ├─ POST /api/v1/scrape { groupId, wait: true, maxPosts }
   │      │     └─ scraper: scrapeGroup → savePosts → saveScrapeLog → return result
   │      ├─ If success → POST /api/ai-process (enqueue AI)
   │      └─ If failure → log error, continue to next group
   │
   └─ 4. Log cycle completion
```

### Flow 3: Dashboard — Scrape con selector de grupo

```
Admin UI: ScrapeControls
   │
   ├─ fetchGroups() → populate <select> with active groups
   │
   ├─ User selects group + clicks "Scrapear"
   │     └─ mutate({ groupId }) → POST /api/scrape { groupId }
   │
   ├─ User selects "Todos los grupos"
   │     └─ mutate() → POST /api/scrape {} (sin groupId)
   │           └─ API interpreta "todos" → itera grupos (o delega en scheduler)
   │
   └─ SSE shows progress via /api/scrape/:jobId/events (proxy)
```

## State Transitions

### ScrapeJob (in-memory)

```
              createJob()
                  │
                  ▼
              [pending]
                  │
           runScrape() starts
                  │
                  ▼
             [running]
                  │
         ┌────────┴────────┐
         ▼                  ▼
    [completed]        [failed]
         │                  │
         │ TTL 30 min       │ TTL 30 min
         ▼                  ▼
      (deleted)         (deleted)
```

### Scheduler Cycle

```
     ┌──────────────┐
     │   idle       │
     └──────┬───────┘
            │ cron fires
            ▼
     ┌──────────────┐
     │  running     │─── if busy → skip
     └──────┬───────┘
            │ all groups processed
            ▼
     ┌──────────────┐
     │   idle       │
     └──────────────┘
```
