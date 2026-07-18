# Quickstart: Spec 001 — Fundación API + Pipeline Automático

> Phase 1 output — how to get started developing this feature

## Prerequisites

- Node.js >=22.13.0
- pnpm 10.33.2
- Docker Compose (for PostgreSQL and Redis)
- A `.env` file with at minimum: `DATABASE_URL`, `REDIS_URL`, `FB_GROUPS`, `PROFILE_DIR`

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Ensure you're on the feature branch
git checkout 003-api-foundation-pipeline

# 3. Start dependencies (PostgreSQL + Redis)
docker compose up -d postgres redis

# 4. Run database migrations
pnpm db:migrate

# 5. Generate Prisma client
pnpm db:generate
```

## Development Workflow

### Run the API (with hot reload)

```bash
pnpm dev
```

This runs the NestJS API with Fastify on port 3000. Swagger docs at http://localhost:3000/docs.

### Build all packages

```bash
pnpm build
```

Runs `turbo build` — builds all packages and apps.

### Test the async pipeline

```bash
# Trigger a scrape (returns immediately with jobId)
curl -X POST http://localhost:3000/api/scrape -H "x-api-key: your-api-key"

# Check job status
curl http://localhost:3000/api/scrape/status/<jobId> -H "x-api-key: your-api-key"

# Trigger AI processing manually (optional)
curl -X POST http://localhost:3000/api/ai-process -H "x-api-key: your-api-key"

# View current schedule config
curl http://localhost:3000/api/schedule -H "x-api-key: your-api-key"

# Update schedule config
curl -X PUT http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"intervalMinutes": 120, "hourStart": 8, "hourEnd": 22, "enabled": true}'
```

## Implementation Order

Recommended order of implementation:

1. **Core infrastructure** (`core/`, `infrastructure/`, `common/`)
   - `core/filters/http-exception.filter.ts`
   - `core/interceptors/request-id.interceptor.ts`
   - `core/pipes/zod-validation.pipe.ts`
   - `infrastructure/config/app-config*`
   - `infrastructure/database/prisma/prisma*` (refactor existing)
   - `infrastructure/queue/queue*`
   - `common/dto/pagination.schema.ts`, `common/dto/api-response.ts`

2. **Refactor existing modules** into `features/` with 3-layer pattern
   - Listings: repository, refactor service, add envelope
   - Raw Posts: repository, refactor service, add envelope

3. **Scraper Worker** — convert CLI to BullMQ Worker
   - Add `worker.ts` entry point
   - Refactor `index.ts` to export scrape functions instead of `main()`
   - Add ScrapeLog writes

4. **AI Processor Worker** — convert CLI to BullMQ Worker
   - Add `worker.ts` entry point
   - Refactor `index.ts` to export process functions instead of `main()`

5. **Scrape + AI Processor modules** in API (refactored to use QueueService)
   - `features/scrape/` — controller, service that enqueues jobs
   - `features/ai-processor/` — controller, service that enqueues jobs

6. **Scheduler module** — repeatable jobs on scrape queue
   - `features/scheduler/` — controller, service

7. **Docker Compose** — update worker commands

## Directory Structure

After implementation, the API source should look like:

```
apps/api/src/
├── main.ts
├── app.module.ts
├── core/
│   ├── filters/
│   ├── interceptors/
│   └── pipes/
├── infrastructure/
│   ├── config/
│   ├── database/prisma/
│   └── queue/
├── common/
│   └── dto/
└── features/
    ├── listings/
    ├── raw-posts/
    ├── scrape/
    ├── ai-processor/
    └── scheduler/
```

## Key Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/core/filters/http-exception.filter.ts` | Global @Catch() exception filter |
| `apps/api/src/core/interceptors/request-id.interceptor.ts` | Request tracing + metrics |
| `apps/api/src/core/pipes/zod-validation.pipe.ts` | Global Zod validation pipe |
| `apps/api/src/infrastructure/config/app-config.module.ts` | Config module |
| `apps/api/src/infrastructure/config/app-config.service.ts` | Typed env config |
| `apps/api/src/infrastructure/queue/queue.module.ts` | BullMQ module |
| `apps/api/src/infrastructure/queue/queue.service.ts` | Queue wrapper service |
| `apps/api/src/common/dto/pagination.schema.ts` | Pagination Zod schema |
| `apps/api/src/common/dto/api-response.ts` | Response envelope helpers |
| `packages/scraper/src/worker.ts` | Scraper BullMQ worker entry point |
| `packages/ai-processor/src/worker.ts` | AI processor BullMQ worker entry point |

## Verification

After implementation, verify with:

```bash
# 1. API starts without errors
pnpm dev

# 2. Swagger docs load
open http://localhost:3000/docs

# 3. POST /api/scrape returns 202 with jobId
curl -X POST http://localhost:3000/api/scrape -H "x-api-key: your-api-key" -v

# 4. Error responses include requestId (no API key → 401)
curl http://localhost:3000/api/listings?page=-1 -v

# 5. Schedule endpoint works
curl http://localhost:3000/api/schedule -H "x-api-key: your-api-key"
```
