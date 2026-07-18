---
description: "Task list for Spec 001 — Fundación API + Pipeline Automático"
---

# Tasks: Fundación API + Pipeline Automático

**Input**: Design documents from `/specs/003-api-foundation-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Path Conventions

- **API**: `apps/api/src/`
- **Scraper**: `packages/scraper/src/`
- **AI Processor**: `packages/ai-processor/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure for new modules and verify existing tooling works

- [ ] T001 Create directory structure: apps/api/src/core/filters/, core/interceptors/, core/pipes/, infrastructure/config/, infrastructure/database/prisma/, infrastructure/queue/, common/dto/, features/listings/api/dto/, features/listings/application/, features/listings/infrastructure/, features/raw-posts/api/dto/, features/raw-posts/application/, features/raw-posts/infrastructure/, features/scrape/api/, features/scrape/application/, features/scrape/infrastructure/, features/ai-processor/api/, features/ai-processor/application/, features/scheduler/api/, features/scheduler/application/
- [ ] T002 [P] Verify pnpm install works and all workspace packages resolve (`pnpm install`)
- [ ] T003 [P] Verify existing tests pass (`pnpm --filter @fb-store/api test` or `vitest run`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create AppConfigService in apps/api/src/infrastructure/config/app-config.service.ts — typed wrapper over ConfigService with getString, getNumber, getBoolean, getRequiredString, validateRequired
- [ ] T005 Create AppConfigModule in apps/api/src/infrastructure/config/app-config.module.ts — @Global() module that imports ConfigModule and provides AppConfigService
- [ ] T006 Refactor PrismaService in apps/api/src/infrastructure/database/prisma/prisma.service.ts — extend PrismaClient with OnModuleInit/OnModuleDestroy lifecycle hooks, use @prisma/adapter-pg
- [ ] T007 Refactor PrismaModule in apps/api/src/infrastructure/database/prisma/prisma.module.ts — @Global() module exporting PrismaService
- [ ] T008 Create QueueService in apps/api/src/infrastructure/queue/queue.service.ts — injects @InjectQueue('scrape') and @InjectQueue('ai-process'), exposes addScrapeJob(data), addAiProcessJob(data), getJob(queueName, jobId)
- [ ] T009 Create QueueModule in apps/api/src/infrastructure/queue/queue.module.ts — @Global() module using BullModule.forRootAsync (reads Redis connection from AppConfigService) and BullModule.registerQueue for 'scrape' and 'ai-process' queues
- [ ] T010 [P] Create pagination schema in apps/api/src/common/dto/pagination.schema.ts — Zod schema for page (coerce, int, >=1, default 1), limit (coerce, int, 1-100, default 20), and PaginationMeta interface
- [ ] T011 [P] Create API response helpers in apps/api/src/common/dto/api-response.ts — wrapSuccessList(data, pagination) returning { data, pagination }, wrapSuccessItem(data) returning { data }, wrapError(code, message, requestId) returning { error: { code, message, requestId, timestamp } }
- [ ] T012 Create ZodValidationPipe in apps/api/src/core/pipes/zod-validation.pipe.ts — PipeTransform that calls schema.safeParse() with whitelist + transform behavior, throws BadRequestException with formatted errors on failure
- [ ] T013 Create global exception filter in apps/api/src/core/filters/http-exception.filter.ts — @Catch() with HttpAdapterHost, categorizes exceptions into validation/authorization/rate_limit/business/unknown, returns { error: { code, message, requestId, timestamp } }, never exposes stack traces
- [ ] T014 Create RequestId interceptor in apps/api/src/core/interceptors/request-id.interceptor.ts — NestInterceptor that ensures x-request-id header on every response, logs method/URL/controller/handler/duration/status, accumulates rejection metrics
- [ ] T014b Create ApiKeyGuard in apps/api/src/core/guards/api-key.guard.ts — CanActivate that validates x-api-key header against AppConfigService API_KEY, returns 401 on mismatch. Add a `@SkipAuth()` decorator (setMetadata) and `Reflector` check in the guard so routes like health can be excluded
- [ ] T015 Update AppModule in apps/api/src/app.module.ts — remove old imports (PrismaModule from old path, ScraperModule, AiProcessorModule), import new infrastructure modules (AppConfigModule, PrismaModule from infrastructure, QueueModule), register ZodValidationPipe via APP_PIPE, register HttpExceptionFilter globally, register RequestIdInterceptor globally, register ApiKeyGuard via APP_GUARD with health-endpoint exclusion (apply `@SkipAuth()` to health controller)
- [ ] T016 Update main.ts in apps/api/src/main.ts — call AppConfigService.validateRequired() before listen(), fail fast with clear message if DATABASE_URL, REDIS_URL, or other critical vars are missing

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Scrape y Procesamiento Automático (Priority: P1) 🎯 MVP

**Goal**: Un administrador puede disparar un scrape desde la API y recibe confirmación inmediata. El scraper procesa en background, encadena automáticamente el AI processor, y el estado es consultable.

**Independent Test**: `POST /api/scrape` → 202 con `{ jobId }` → `GET /api/scrape/status/:jobId` → status completed → raw_posts creados → listings creados automáticamente

### Scraper Worker — packages/scraper/src/

- [ ] T017 [US1] Refactor packages/scraper/src/index.ts — extract scrapeGroup(), savePosts(), saveScrapeLog() as exported async functions (remove main()), accept job data params, return metrics { postsFound, postsNew, durationMs }
- [ ] T018 [US1] Create packages/scraper/src/worker.ts — BullMQ Worker that listens on 'scrape' queue, calls exported functions from index.ts, on success with new posts enqueues 'ai-process' job, saves ScrapeLog with metrics, handles errors gracefully
- [ ] T019 [US1] Add saveScrapeLog() to packages/scraper/src/index.ts — writes ScrapeLog records with groupId, postsFound, postsNew, postsErrors, startedAt, finishedAt, durationMs after each group scrape

### AI Processor Worker — packages/ai-processor/src/

- [ ] T020 [US1] Refactor packages/ai-processor/src/index.ts — extract processPost(), processBatch(), getPendingPosts() as exported async functions (remove main()), accept job data params, return metrics { processed, created, errors }
- [ ] T021 [US1] Create packages/ai-processor/src/worker.ts — BullMQ Worker that listens on 'ai-process' queue, calls exported functions from index.ts, if specific rawPostIds provided processes only those, otherwise processes all pending, handles errors leaving raw_posts as pending

### API Scrape Module — apps/api/src/features/scrape/

- [ ] T022 [US1] Create ScrapeService in apps/api/src/features/scrape/application/scrape.service.ts — injects QueueService, exposes triggerScrape(groupId?, maxPosts?) → queue.add('scrape', data) returns jobId + getJobStatus(jobId)
- [ ] T023 [US1] Create ScrapeController in apps/api/src/features/scrape/api/scrape.controller.ts — POST /api/scrape accepts optional { groupId, maxPosts }, returns 202 { jobId }
- [ ] T024 [US1] Create ScrapeStatusController in apps/api/src/features/scrape/api/scrape-status.controller.ts — GET /api/scrape/status/:jobId returns { data: { jobId, status, progress, result, failedReason, timestamp } }
- [ ] T025 [US1] Create ScrapeModule in apps/api/src/features/scrape/scrape.module.ts — imports QueueModule, registers ScrapeController + ScrapeStatusController + ScrapeService

### API AI Processor Module — apps/api/src/features/ai-processor/

- [ ] T026 [US1] Create AiProcessorService in apps/api/src/features/ai-processor/application/ai-processor.service.ts — injects QueueService, exposes triggerProcessing(rawPostIds?) → queue.add('ai-process', data) returns jobId
- [ ] T027 [US1] Create AiProcessorController in apps/api/src/features/ai-processor/api/ai-processor.controller.ts — POST /api/ai-process accepts optional { rawPostIds }, returns 202 { jobId }
- [ ] T028 [US1] Create AiProcessorModule in apps/api/src/features/ai-processor/ai-processor.module.ts — imports QueueModule, registers AiProcessorController + AiProcessorService

### Docker Compose

- [ ] T029 [US1] Update docker-compose.yml — scraper service command to `["node", "packages/scraper/dist/worker.js"]`, ai-processor service command to `["node", "packages/ai-processor/dist/worker.js"]`, add healthchecks for both workers (Redis ping or worker health endpoint), ensure restart: unless-stopped
- [ ] T029b [US1] Verify auto-restart: kill scraper worker container, confirm Docker restarts it automatically — document in quickstart.md validation steps

**Checkpoint**: Async pipeline working end-to-end. POST /api/scrape → background scraping → auto AI processing → listings created. MVP ready.

---

## Phase 4: User Story 2 — Programación Automática de Scrapes (Priority: P2)

**Goal**: El scraper se ejecuta automáticamente según horario configurable sin intervención manual.

**Independent Test**: API inicia → scheduler registrado → `GET /api/schedule` muestra config → `PUT /api/schedule` actualiza → scrapes se ejecutan automáticamente al intervalo configurado

- [ ] T030 [P] [US2] Create SchedulerService in apps/api/src/features/scheduler/application/scheduler.service.ts — implements OnModuleInit, uses queue.upsertJobScheduler() to register repeatable job on 'scrape' queue, exposes getSchedule() and updateSchedule(intervalMinutes, hourStart, hourEnd, enabled), validates time window
- [ ] T031 [US2] Create SchedulerController in apps/api/src/features/scheduler/api/scheduler.controller.ts — GET /api/schedule returns current config in envelope, PUT /api/schedule accepts { intervalMinutes, hourStart, hourEnd, enabled } and reconfigures scheduler
- [ ] T032 [US2] Create SchedulerModule in apps/api/src/features/scheduler/scheduler.module.ts — imports QueueModule, registers SchedulerController + SchedulerService

**Checkpoint**: Automatic scraping with configurable schedule. Full pipeline automation achieved.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Refactor existing modules to use repository pattern, response envelope, and the new 3-layer structure. Wire everything together.

- [ ] T033 [P] Create ListingRepository in apps/api/src/features/listings/infrastructure/listing.repository.ts — wraps PrismaService listing queries: findAll(query) with filters + pagination, findById(id), count(query)
- [ ] T034 [P] Create RawPostRepository in apps/api/src/features/raw-posts/infrastructure/raw-post.repository.ts — wraps PrismaService rawPost queries: findAll(query) with status/groupId/date filters + pagination, findById(id)
- [ ] T035 Refactor ListingsService in apps/api/src/features/listings/application/listings.service.ts — injects ListingRepository instead of PrismaService, uses api-response helpers for envelope format, maintains backward-compatible data shape
- [ ] T036 Refactor RawPostsService in apps/api/src/features/raw-posts/application/raw-posts.service.ts — injects RawPostRepository instead of PrismaService, uses api-response helpers, supports new filter params (status, groupId, date range)
- [ ] T037 [P] Create listings DTO in apps/api/src/features/listings/api/dto/listings-query.dto.ts — Zod schema for listing query filters (reuses RealEstateListingQuerySchema from shared, but validates in-app)
- [ ] T038 [P] Create raw-posts DTO in apps/api/src/features/raw-posts/api/dto/raw-posts-query.dto.ts — Zod schema for raw-posts query with status enum, groupId, date range
- [ ] T039 Refactor ListingsController in apps/api/src/features/listings/api/listings.controller.ts — wraps responses in envelope, uses new ListingsService, maintains existing GET /api/listings and GET /api/listings/:id routes
- [ ] T040 Refactor RawPostsController in apps/api/src/features/raw-posts/api/raw-posts.controller.ts — wraps responses in envelope, uses new RawPostsService, maintains existing GET /api/raw-posts and GET /api/raw-posts/:id routes
- [ ] T041 [P] Create ListingsModule in apps/api/src/features/listings/listings.module.ts — registers controller, service, repository
- [ ] T042 [P] Create RawPostsModule in apps/api/src/features/raw-posts/raw-posts.module.ts — registers controller, service, repository
- [ ] T043 Update AppModule in apps/api/src/app.module.ts — import ListingsModule, RawPostsModule, ScrapeModule, AiProcessorModule, SchedulerModule from features/ (remove old flat module imports)
- [ ] T044 Run pnpm build and fix any TypeScript compilation errors
- [ ] T045 Run quickstart.md validation: verify POST /api/scrape → jobId, error responses include requestId, schedule endpoints work, paginated lists use envelope format
- [ ] T046 Delete old flat module files: apps/api/src/scraper/, apps/api/src/ai-processor/, apps/api/src/listings/, apps/api/src/raw-posts/, apps/api/src/prisma/ (⚠️ only after confirming features/ versions work AND no remaining direct imports of PrismaService from old paths)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — directories and verification
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 Scrape Pipeline (Phase 3)**: Depends on Foundational (needs QueueService, AppConfigService)
- **US2 Scheduler (Phase 4)**: Depends on Foundational (needs QueueService), independent from US1
- **Polish (Phase 5)**: Depends on US1 and US2 (needs new modules registered)

### User Story Dependencies

- **US1 (P1) — Async Pipeline**: Can start after Foundational. Independent of US2.
- **US2 (P2) — Scheduler**: Can start after Foundational. Independent of US1.
- **US3 (P3) is absorbed into Foundational + Polish**: Core infrastructure (error filter, requestId, Zod pipe, envelope) is Phase 2. Response envelope integration on existing endpoints is Phase 5.

### Within Each Phase

- Tests before implementation
- Services before controllers
- Core implementation before integration
- Story complete before moving to next phase

### Parallel Opportunities

| Task IDs | Why parallel |
|----------|-------------|
| T002, T003 | Verification tasks — no file conflicts |
| T004-T016 (all Phase 2) | Mostly independent files, sequential ordering by dependency |
| T017-T029 (US1) | Scraper worker (T017-T019) parallel with AI worker (T020-T021), API modules (T022-T028) parallel with Docker (T029) |
| T030-T032 (US2) | Self-contained scheduler module — fully parallel with US1 |
| T033-T034 | Both repositories — no file conflicts |
| T037-T038 | Both DTO files — no file conflicts |
| T041-T042 | Both modules — no file conflicts |

### Parallel Example: User Story 1

```bash
# Scraper worker tasks can run in parallel:
Task: "Refactor scraper index.ts to export functions" (T017)
Task: "Create scraper worker.ts entry point" (T018)

# AI processor worker tasks can run in parallel:
Task: "Refactor AI processor index.ts to export functions" (T020)
Task: "Create AI processor worker.ts entry point" (T021)

# API modules can run in parallel:
Task: "Create ScrapeService + ScrapeController" (T022, T023)
Task: "Create AiProcessorService + AiProcessorController" (T026, T027)
```

### Parallel Example: Polish Phase

```bash
# Repositories in parallel:
Task: "Create ListingRepository" (T033)
Task: "Create RawPostRepository" (T034)

# DTOs in parallel:
Task: "Create listings query DTO" (T037)
Task: "Create raw-posts query DTO" (T038)

# Modules in parallel:
Task: "Create ListingsModule" (T041)
Task: "Create RawPostsModule" (T042)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T016) — CRITICAL, blocks everything
3. Complete Phase 3: US1 — Async Pipeline (T017-T029)
4. **STOP and VALIDATE**: Test US1 independently
   - `POST /api/scrape` returns 202 with jobId
   - `GET /api/scrape/status/:jobId` returns job status
   - Scraper processes in background, enqueues AI
   - Listings are created automatically
5. Docker Compose workers restart automatically

### Incremental Delivery

1. Phase 1 + 2 → **Foundation ready** (env validation, error handling, request tracing, queue infra)
2. + Phase 3 → **MVP ready** (async pipeline works end-to-end)
3. + Phase 4 → **Full automation** (scheduler + auto-scraping)
4. + Phase 5 → **Production polish** (repository pattern, envelope, clean architecture)

### Key Technical Decisions

- Scraper and AI-processor packages use raw BullMQ `Worker` (not NestJS decorators) — they are standalone Node.js processes
- API uses `@nestjs/bullmq` decorators for Queue producers
- Custom ZodValidationPipe replaces the current @anatine/zod-nestjs usage
- Global exception filter uses HttpAdapterHost for platform-agnostic response handling
- Scheduler uses BullMQ `upsertJobScheduler()` for CRUD-friendly job scheduling
- All paginated responses use `{ data, pagination }` envelope format
- Error responses use `{ error: { code, message, requestId, timestamp } }` format

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Old flat modules (apps/api/src/scraper/, apps/api/src/ai-processor/, etc.) should only be deleted after new features/ versions are verified working
