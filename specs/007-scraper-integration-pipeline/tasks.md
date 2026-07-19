# Tasks: Scraper Integration Pipeline

**Input**: Design documents from `specs/007-scraper-integration-pipeline/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: TDD Mandatory per Constitution (Item 4). Tests MUST be written and FAIL before implementation. Tests use Vitest with mocked external services (fetch, Prisma).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to user story (US1, US2, US3, US4)
- Includes exact file paths

---

## Phase 1: Setup

**Purpose**: Install new dependencies and ensure foundational module exports

- [X] T001 Install `@nestjs/schedule` in `apps/api/package.json` (needed by scheduler rewrite in US2)
- [X] T002 [P] Add `exports: [AiProcessorService]` to `apps/api/src/features/ai-processor/ai-processor.module.ts`

**Checkpoint**: Dependency installed. AiProcessorService exportable from its module.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure changes that MUST be complete before user stories can function

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add `findActive()` method to `apps/api/src/features/groups/infrastructure/group.repository.ts` (query `where: { isActive: true }`)
- [X] T004 Add `findActive()` public method to `apps/api/src/features/groups/application/groups.service.ts` (delegates to repository)
- [X] T005 Import `AiProcessorModule` in `apps/api/src/features/scrape/scrape.module.ts` (needed by US1 for auto-chain)

**Checkpoint**: Foundation ready — US1, US2, US3, US4 can now proceed

---

## Phase 3: User Story 1 — Pipeline Automático Scrape → AI (Priority: P1) 🎯 MVP

**Goal**: Cuando se dispara un scrape, los posts se persisten en DB y el AI processing se encola automáticamente

**Independent Test**: `curl POST /api/scrape { groupId }` → verificar RawPost creados en DB, ScrapeLog creado, y job encolado en ai-process queue

### Tests for User Story 1 ⚠️ TDD — Write FIRST, ensure they FAIL

- [X] T006 [P] [US1] Test for `scrape-runner.ts` verifies `savePosts` and `saveScrapeLog` are called with correct args in `packages/scraper/src/services/scrape-runner.spec.ts`
- [X] T007 [P] [US1] Test for `scrape-runner.ts` verifies `savePosts` failure propagates as error (no SSE "complete") in `packages/scraper/src/services/scrape-runner.spec.ts`
- [X] T008 [P] [US1] Test for `scrape-runner.ts` verifies `metrics.postsNew` equals `savePosts` return value in `packages/scraper/src/services/scrape-runner.spec.ts`
- [X] T009 [P] [US1] Test for `scrape.service.ts` verifies `waitForJob` polls every 5s until "completed" in `apps/api/src/features/scrape/application/scrape.service.spec.ts`
- [X] T010 [P] [US1] Test for `scrape.service.ts` verifies `waitForJob` times out after 120s in `apps/api/src/features/scrape/application/scrape.service.spec.ts`
- [X] T011 [P] [US1] Test for `scrape.service.ts` verifies `chainAfterScrape` calls `AiProcessorService.triggerProcessing` when postsNew > 0 in `apps/api/src/features/scrape/application/scrape.service.spec.ts`
- [X] T012 [P] [US1] Test for `scrape.service.ts` verifies `chainAfterScrape` skips AI when postsNew === 0 in `apps/api/src/features/scrape/application/scrape.service.spec.ts`

### Implementation for User Story 1

- [X] T013 [US1] Modify `packages/scraper/src/services/scrape-runner.ts`: add `savePosts` and `saveScrapeLog` calls after `scrapeGroup()` returns, before `notifyClients("complete")` — update import from `"../index"` to include both functions, replace `postsNew: postsLen` with actual `savePosts` return
- [X] T014 [US1] Modify `notifyClients` ordering in `packages/scraper/src/services/scrape-runner.ts`: ensure SSE "complete" fires only after persistence succeeds (move persistence before `notifyClients`)
- [X] T015 [US1] Add `waitForJob()` private method to `apps/api/src/features/scrape/application/scrape.service.ts` — polls `GET /scrape/:jobId` every 5s, timeout 120s, returns job state
- [X] T016 [US1] Add `chainAfterScrape()` private method to `apps/api/src/features/scrape/application/scrape.service.ts` — calls `waitForJob`, checks `postsNew > 0`, calls `AiProcessorService.triggerProcessing()`
- [X] T017 [US1] Modify `triggerScrape()` in `apps/api/src/features/scrape/application/scrape.service.ts` to invoke `chainAfterScrape()` as background task (Promise without await, catch errors)
- [X] T018 [US1] Inject `AiProcessorService` into `ScrapeService` constructor in `apps/api/src/features/scrape/application/scrape.service.ts`

**Checkpoint**: Scrape → persistencia → AI chain funciona automáticamente. Sin scheduler, pero un POST /api/scrape manual completa el pipeline completo.

---

## Phase 4: User Story 2 — Scrapes Automáticos con Scheduler (Priority: P1)

**Goal**: El scheduler ejecuta scrapes automáticos según horario configurable, iterando grupos activos y encadenando AI

**Independent Test**: `PUT /api/schedule { intervalMinutes: 5 }` → esperar tick → verificar ScrapeLogs creados para cada grupo activo

### Tests for User Story 2 ⚠️ TDD

- [X] T019 [P] [US2] Test for `scheduler.service.ts` verifies `executeScrapeCycle` fetches active groups from `GroupsService.findActive()` in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`
- [X] T020 [P] [US2] Test for `scheduler.service.ts` verifies sequential HTTP calls to scraper with `wait=true` for each group in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`
- [X] T021 [P] [US2] Test for `scheduler.service.ts` verifies AI is enqueued after successful group scrape in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`
- [X] T022 [P] [US2] Test for `scheduler.service.ts` verifies error in one group does not stop iteration in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`
- [X] T023 [P] [US2] Test for `scheduler.service.ts` verifies cycle is skipped if previous still running in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`
- [X] T024 [P] [US2] Test for `scheduler.service.ts` verifies timeout (300s) per group in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`
- [X] T025 [P] [US2] Test for `scheduler.service.ts` verifies disabled state skips cycle in `apps/api/src/features/scheduler/application/scheduler.service.spec.ts`

### Implementation for User Story 2

- [X] T026 [US2] Rewrite `apps/api/src/features/scheduler/scheduler.module.ts`: remove `BullModule.registerQueue({ name: "scrape" })`, add `ScheduleModule.forRoot()` + `AiProcessorModule` to imports
- [X] T027 [US2] Rewrite `apps/api/src/features/scheduler/application/scheduler.service.ts`: replace `@InjectQueue("scrape")` with `SchedulerRegistry` from `@nestjs/schedule`, inject `ConfigService` for `SCRAPER_URL` and `SCRAPER_API_KEY`, inject `GroupsService` for `findActive()`, inject `AiProcessorService` for AI chaining
- [X] T028 [US2] Implement `registerSchedule()` in scheduler: delete existing cron if any, build cron expression from config, add dynamic CronJob via `SchedulerRegistry.addCronJob()`
- [X] T029 [US2] Implement `executeScrapeCycle()` in scheduler: check `isRunning` flag, fetch active groups, iterate with `POST /api/v1/scrape { groupId, maxPosts, wait: true }` and `AbortController` timeout of 300s, enqueue AI after each success
- [X] T030 [US2] Preserve existing `updateSchedule()` and `getSchedule()` API in scheduler — reject intervals < 30 min, validate hourStart/hourEnd, re-register cron on changes

**Checkpoint**: ✅ Scheduler funcional. Scrapes automáticos cada N minutos respetando ventana horaria.

---

## Phase 5: User Story 3 — Scrape de Grupo Individual desde Admin UI (Priority: P2)

**Goal**: El operador puede seleccionar un grupo específico desde el dashboard y scrapear grupos individuales desde la página de grupos

**Independent Test**: Abrir Admin UI → Dashboard → seleccionar grupo del dropdown → "Scrapear" → ver progreso SSE. Ir a Grupos → "Scrapear" en una fila → ver actualización de lastScraped.

### Tests for User Story 3 ⚠️ TDD

- [X] T031 [P] [US3] Test for `useScrape` mutation accepts optional `groupId` parameter — create `apps/admin/src/hooks/use-scrape.spec.ts` (or `.test.ts` — verify admin Vitest convention first)
- [X] T032 [P] [US3] Test for `ScrapeControls` renders group dropdown with active groups — create `apps/admin/src/components/dashboard/scrape-controls.spec.tsx` (or `.test.tsx`)

### Implementation for User Story 3

- [X] T033 [US3] Modify `apps/admin/src/hooks/use-scrape.ts`: change `mutationFn` to accept `(args?: { groupId?: string; maxPosts?: number })` and pass to `triggerScrape(args?.groupId, args?.maxPosts)`
- [X] T034 [P] [US3] Add `triggerScrapeForAllGroups()` method to `apps/api/src/features/scrape/application/scrape.service.ts`: fetches active groups via `GroupsService.findActive()`, iterates calling scraper with `{ url: group.url, maxPosts: group.maxPosts }` for each, returns array of jobIds
- [X] T035 [US3] Modify `apps/admin/src/components/dashboard/scrape-controls.tsx`: add `<select>` dropdown with active groups from `fetchGroups()`, default option "Todos los grupos". When "Todos" selected, call `triggerScrape()` without args (backend handles iteration). When single group selected, call with `{ url: group.url }` by looking up the selected group.
- [X] T036 [US3] Modify `apps/admin/src/pages/groups-page.tsx`: add "Scrapear" button per row, state `scrapingGroupId`, `handleScrapeGroup()` that calls `triggerScrape(group.url, group.maxPosts)`, polls `GET /api/scrape/status/:jobId` every 2s, invalidates query on completion

**Checkpoint**: Admin UI permite scrapear grupos individuales. Dashboard con selector. Grupos con botón por fila.

---

## Phase 6: User Story 4 — Limpieza Automática de Jobs (Priority: P3)

**Goal**: Jobs completados/fallidos se eliminan del Map en memoria después de 30 minutos

**Independent Test**: Disparar scrape, esperar 30 min (o TTL reducido para test), verificar job devuelve 404

### Tests for User Story 4 ⚠️ TDD

- [X] T037 [P] [US4] Test for `job-tracker.ts` verifies completed jobs are removed after TTL in `packages/scraper/src/services/job-tracker.spec.ts`
- [X] T038 [P] [US4] Test for `job-tracker.ts` verifies running jobs are NOT removed after TTL in `packages/scraper/src/services/job-tracker.spec.ts`
- [X] T039 [P] [US4] Test for `job-tracker.ts` verifies TTL interval runs cleanup correctly in `packages/scraper/src/services/job-tracker.spec.ts`

### Implementation for User Story 4

- [X] T040 [US4] Add TTL cleanup to `packages/scraper/src/services/job-tracker.ts`: start `setInterval` every 60s that iterates `jobs` Map and deletes entries where `status` is `"completed"` or `"failed"` and `createdAt + 30 min < now`
- [X] T041 [US4] Add `cleanupInterval` reference to `job-tracker.ts` to allow stopping interval on server shutdown (optional, for graceful shutdown)

**Checkpoint**: Memoria del scraper no crece indefinidamente. Jobs viejos se limpian automáticamente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final, tests de integración, build

- [X] T042 Run full scraper test suite: `pnpm --filter @fb-store/scraper test` — ✅ 55 passed (8 test files)
- [X] T043 Run full API test suite: `pnpm --filter @fb-store/api test` — ✅ 133 passed (17 test files)
- [X] T044 Run full Admin UI test suite: no test script in `apps/admin/package.json` — skipped
- [X] T045 Run full build: `pnpm build` — ✅ 5/5 packages built (fixed `tsconfig.app.json` exclude + `mutate()` call)
- [ ] T046 (manual) POST /api/scrape → verify RawPost + ScrapeLog + AI queue
- [ ] T047 (manual) PUT /api/schedule → verify scheduler executes cycle
- [ ] T048 (manual) Error scenarios (DB down, scraper down)
- [X] T049 Update research.md with implementation discoveries

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Blocks |
|-------|-----------|--------|
| 1. Setup | Nothing | Phase 2, 4 |
| 2. Foundational | Phase 1 | All user stories |
| 3. US1 — Pipeline Scrape→AI | Phase 2 | Nothing (standalone) |
| 4. US2 — Scheduler | Phase 1, 2 | Nothing (standalone) |
| 5. US3 — Admin UI | Phase 2 | Nothing (standalone — solo frontend) |
| 6. US4 — TTL Jobs | Phase 2 | Nothing (standalone — solo scraper) |
| 7. Polish | All | — |

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational. No deps on other stories.
- **US2 (P1)**: Can start after Foundational. Requires T001 (`@nestjs/schedule` installed). Independent of US1.
- **US3 (P2)**: Can start after Foundational. Frontend-only changes — no deps on US1 or US2.
- **US4 (P3)**: Can start after Foundational. Scraper-only changes — no deps on other stories.

### Parallel Opportunities

- All [P] tasks within a phase run in parallel (different files)
- US1, US2, US3, US4 can all run in parallel once Foundational is complete
- US3 and US4 are entirely independent (different packages: admin vs scraper)
- US1 and US2 touch different NestJS modules (ScrapeModule vs SchedulerModule) but both modify scrape.service.ts

### Parallel Example: US1 + US2 + US3 + US4

```bash
# Phase 2 Foundation tasks (parallel):
Task: T003 — GroupRepository.findActive()
Task: T004 — GroupsService.findActive()
Task: T005 — ScrapeModule imports AiProcessorModule
Task: T002 — AiProcessorModule exports service

# Then all 4 stories in parallel:
# US1 (scraper persistence + API polling):
Task: T013-T018 — scrape-runner + scrape.service

# US2 (scheduler rewrite):
Task: T026-T030 — scheduler.module + scheduler.service

# US3 (admin UI):
Task: T033-T036 — use-scrape + triggerScrapeForAllGroups + ScrapeControls + GroupsPage

# US4 (TTL):
Task: T040-T041 — job-tracker.ts
```

---

## Implementation Strategy

### MVP First (Phases 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 — Pipeline Scrape → AI
4. **STOP and VALIDATE**: POST /api/scrape → RawPost creado → ScrapeLog creado → AI job encolado
5. The pipeline scrape → AI ya funciona automáticamente (core problem solved!)

### Incremental Delivery

1. **MVP** (Phases 1-3): Pipeline scrape → persistencia → AI funcional
2. **+ Scheduler** (Phase 4): Scrapes automáticos sin intervención
3. **+ Admin UX** (Phase 5): Scrape por grupo individual desde UI
4. **+ TTL** (Phase 6): Limpieza automática de memoria
5. **+ Polish** (Phase 7): Tests, validación, build

### Total Effort

| Phase | Tasks | Est. files modified |
|-------|-------|---------------------|
| 1: Setup | 2 | 2 |
| 2: Foundational | 3 | 3 |
| 3: US1 — Pipeline | 13 | 3 (scraper-runner, scrape.service, scrape.module) |
| 4: US2 — Scheduler | 12 | 3 (scheduler.module, scheduler.service, package.json) |
| 5: US3 — Admin UI | 6 | 4 (scrape.service, use-scrape, scrape-controls, groups-page) |
| 6: US4 — TTL | 5 | 1 (job-tracker.ts) |
| 7: Polish | 8 | — (tests + validation) |
| **Total** | **49** | **16** |

## Notes

- Tests are MANDATORY per Constitution Item 4 (TDD). Write tests first, ensure they FAIL, then implement.
- [P] tasks = different files, no dependencies — can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Stop at any checkpoint to validate story independently
- After Phase 3 (US1), the pipeline scrape → AI is restored — the core problem is solved
