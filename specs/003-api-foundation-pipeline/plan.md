# Implementation Plan: Fundación API + Pipeline Automático

**Branch**: `003-api-foundation-pipeline` | **Date**: 2026-07-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-api-foundation-pipeline/spec.md`

## Summary

Convert the scraper and AI processor from blocking CLI scripts (`child_process.fork()`) to asynchronous BullMQ workers with automatic pipeline chaining. Add core API infrastructure: global error filter (categorized exceptions + requestId), request-id interceptor (tracing + metrics), Zod validation pipe (whitelist + transform), AppConfigService (typed env validation at startup), PrismaModule/PrismaService (global, lifecycle-managed), QueueModule/QueueService (BullMQ wrapper), pagination schema, and API response envelope. Add a scheduler module with configurable repeatable jobs. Refactor existing listings and raw-posts controllers to use repository pattern and the new envelope format. Update Docker Compose to run workers as long-running services with healthchecks and automatic restart.

## Technical Context

**Language/Version**: TypeScript 6.0, Node.js >=22.13

**Primary Dependencies**: NestJS 11.1 + Fastify 5.8, BullMQ 5.77, Redis 7 (BullMQ backend), Zod 4.4, Prisma 7 + @prisma/adapter-pg, @nestjs/bullmq 11.0

**Storage**: PostgreSQL 18 (via Prisma ORM), Redis 7 (BullMQ queue storage)

**Testing**: Vitest (via NestJS TestingModule with mocked repositories)

**Target Platform**: Linux (Docker containers), Node.js runtime

**Project Type**: Web service (NestJS API) + background workers (BullMQ)

**Performance Goals**: POST /api/scrape and POST /api/ai-process respond in <1s (non-blocking). Full scrape-to-listing pipeline completes within 30 minutes.

**Constraints**: Jobs must persist and survive Redis restarts (BullMQ with Redis persistence). Failed AI processing must not lose raw data (raw_post remains pending). No stack traces in production error responses. Critical env var validation must fail fast before HTTP server starts.

**Scale/Scope**: Single-admin operation targeting a handful of Facebook groups (5-20), hundreds of posts per scrape, tens of thousands of listings total.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First Development | ✅ PASS (post-design) | Spec committed + plan follows speckit workflow |
| II. Feature-Based Modularity | ✅ PASS (post-design) | 3-layer pattern designed: `api/` → `application/` → `infrastructure/` |
| III. Zod-First Validation | ✅ PASS (post-design) | Custom ZodValidationPipe with whitelist + transform |
| IV. Async Pipeline | ✅ PASS (post-design) | BullMQ workers, job chaining, auto-pipeline |
| V. Error Observability | ✅ PASS (post-design) | Global @Catch() filter + requestId interceptor |

**Gate Verdict**: ✅ PASS (post-design) — All constitution principles verified. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-api-foundation-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rest-api.md
│   └── queue-jobs.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
apps/api/src/
├── main.ts                           # REFACTOR: add env validation, CORS, pipe registration
├── app.module.ts                     # REFACTOR: import new modules
│
├── core/                             # NEW: cross-cutting concerns
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   └── request-id.interceptor.ts
│   └── pipes/
│       └── zod-validation.pipe.ts
│
├── infrastructure/                   # NEW: technical adapters
│   ├── config/
│   │   ├── app-config.module.ts
│   │   └── app-config.service.ts
│   ├── database/
│   │   └── prisma/
│   │       ├── prisma.module.ts      # REFACTOR: @Global(), lifecycle hooks
│   │       └── prisma.service.ts     # REFACTOR: extend PrismaClient
│   └── queue/
│       ├── queue.module.ts
│       └── queue.service.ts
│
├── common/                           # NEW: shared intra-API
│   └── dto/
│       ├── pagination.schema.ts
│       └── api-response.ts
│
├── features/                         # NEW: feature-based modules
│   ├── listings/                     # REFACTOR: into features/ with 3-layer
│   │   ├── listings.module.ts
│   │   ├── api/
│   │   │   ├── listings.controller.ts
│   │   │   └── dto/
│   │   ├── application/
│   │   │   └── listings.service.ts
│   │   └── infrastructure/
│   │       └── listing.repository.ts
│   ├── raw-posts/                    # REFACTOR: into features/ with 3-layer
│   │   ├── raw-posts.module.ts
│   │   ├── api/
│   │   │   ├── raw-posts.controller.ts
│   │   │   └── dto/
│   │   ├── application/
│   │   │   └── raw-posts.service.ts
│   │   └── infrastructure/
│   │       └── raw-post.repository.ts
│   ├── scrape/                       # REFACTOR: into features/ + BullMQ
│   │   ├── scrape.module.ts
│   │   ├── api/
│   │   │   ├── scrape.controller.ts
│   │   │   └── scrape-status.controller.ts
│   │   ├── application/
│   │   │   └── scrape.service.ts
│   │   └── infrastructure/
│   │       └── scrape-log.repository.ts
│   ├── ai-processor/                 # REFACTOR: into features/ + BullMQ
│   │   ├── ai-processor.module.ts
│   │   ├── api/
│   │   │   └── ai-processor.controller.ts
│   │   └── application/
│   │       └── ai-processor.service.ts
│   └── scheduler/                    # NEW
│       ├── scheduler.module.ts
│       ├── api/
│       │   └── scheduler.controller.ts
│       └── application/
│           └── scheduler.service.ts

packages/scraper/src/
├── index.ts                          # REFACTOR: from CLI to BullMQ Worker
├── worker.ts                         # NEW: worker entry point (imports index)
├── browser.ts                        # KEEP: unchanged
└── extractor.ts                      # KEEP: unchanged

packages/ai-processor/src/
├── index.ts                          # REFACTOR: from CLI to BullMQ Worker
├── worker.ts                         # NEW: worker entry point (imports index)
├── config.ts                         # KEEP: unchanged
├── extractor.ts                      # KEEP: unchanged
├── mapper.ts                         # KEEP: unchanged
├── image-downloader.ts               # KEEP: unchanged
└── db.ts                             # KEEP: unchanged

docker-compose.yml                    # REFACTOR: add Redis, worker services configs
```

**Structure Decision**: Feature-based modules with 3 internal layers (`api/` → `application/` → `infrastructure/`) per Constitution Principle II. Existing flat modules (scraper/, listings/, raw-posts/, ai-processor/) are migrated into `features/` as part of this spec. Core cross-cutting concerns live in `core/`. Technical adapters (config, database, queue) live in `infrastructure/`. Shared DTOs live in `common/dto/`.

## Complexity Tracking

*No Constitution violations — complexity tracking not required.*
