# Tasks: Scraper como Microservicio HTTP Autónomo

**Input**: Design documents from `specs/006-scraper-microservicio-http/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: TDD Mandatory per Constitution (Item 4). Tests MUST be written and FAIL before implementation. Tests use Vitest with mocked dependencies.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to user story (US1, US2, US3, US4)
- Includes exact file paths

---

## Phase 1: Setup

**Purpose**: Install dependencies and create directory structure

- [ ] T001 Install Hono and Zod in `packages/scraper/package.json`
- [ ] T002 [P] Create directory structure: `routes/`, `services/`, `middleware/`, `static/`, `scripts/` in `packages/scraper/src/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create Hono server entry point in `packages/scraper/src/server.ts` (bootstrap Hono, register routes, start on PORT env var default 3001)
- [ ] T004 [P] Create error handling middleware in `packages/scraper/src/middleware/error-handler.ts` (consistent error envelope with code, message, requestId — generate requestId via `crypto.randomUUID()` for each request)
- [ ] T005 [P] Create API key auth middleware in `packages/scraper/src/middleware/auth.ts` — validate `x-api-key` header against `SCRAPER_API_KEY` env var on all routes except health/ready
- [ ] T006 [P] Create Zod schemas for all request validation in `packages/scraper/src/` (ScrapeRequest, CreateProfileRequest, LoginRequest schemas)
- [ ] T007 [P] Create job tracker service in `packages/scraper/src/services/job-tracker.ts` (in-memory Map<id, JobState> with CRUD + SSE client set)
- [ ] T008 [P] Create health route in `packages/scraper/src/routes/health.ts` (GET /health, GET /ready)
- [ ] T009 [P] Update `packages/scraper/package.json` scripts: add `"start": "node dist/server.js"`, update `build`

**Checkpoint**: Foundation ready — Hono server starts, responds to health checks, validates input, error handling works

---

## Phase 3: User Story 1 — Scrape via API HTTP (Priority: P1) 🎯 MVP

**Goal**: Enviar POST /api/v1/scrape con URL de grupo y recibir posts extraídos

**Independent Test**: `curl -X POST http://localhost:3001/api/v1/scrape -H 'Content-Type: application/json' -d '{"url":"https://facebook.com/groups/123"}'` → 202 { jobId }. `curl http://localhost:3001/api/v1/scrape/:jobId` → { status: "completed", result: { posts: [...] } }

### Tests for User Story 1 ⚠️ TDD — Write FIRST, ensure they FAIL

- [ ] T010 [P] [US1] Test for POST /api/v1/scrape with valid URL returns 202 in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T011 [P] [US1] Test for POST /api/v1/scrape with groupId returns 202 in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T012 [P] [US1] Test for POST /api/v1/scrape with missing url/groupId returns 400 in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T013 [P] [US1] Test for POST /api/v1/scrape with wait=true returns 200 with posts in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T014 [P] [US1] Test for GET /api/v1/scrape/:jobId returns job state in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T015 [P] [US1] Test for GET /api/v1/scrape/:jobId with unknown job returns 404 in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T016 [P] [US1] Test for POST /api/v1/scrape with profile already scraping returns 409 in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T017 [P] [US1] Test for scrape-runner wraps scrapeGroup and calls onProgress in `packages/scraper/src/services/scrape-runner.spec.ts`
- [ ] T018 [US1] Test for existing savePosts and saveScrapeLog still work after refactor in `packages/scraper/src/index.spec.ts`

### Implementation for User Story 1

- [ ] T019 [P] [US1] Refactor `packages/scraper/src/index.ts`: add `onProgress` callback parameter to `scrapeGroup()`, emit phase events
- [ ] T020 [P] [US1] Create scrape runner service in `packages/scraper/src/services/scrape-runner.ts` (calls scrapeGroup with progress callback, returns posts + metrics)
- [ ] T021 [US1] Create scrape route in `packages/scraper/src/routes/scrape.ts` (POST /scrape — validates input, creates job, runs scrape-runner async, returns jobId or result)
- [ ] T022 [US1] Create job status endpoint in `packages/scraper/src/routes/scrape.ts` (GET /scrape/:jobId — returns job state from job-tracker)
- [ ] T023 [US1] Wire scrape route into server in `packages/scraper/src/server.ts`

**Checkpoint**: Scraper recibe requests HTTP, procesa grupos de Facebook, devuelve posts. Funciona sin DB (URL directa).

---

## Phase 4: User Story 2 — Progreso en Tiempo Real (Priority: P1)

**Goal**: Suscribirse a SSE y ver progreso del scrape en tiempo real

**Independent Test**: `curl -N http://localhost:3001/api/v1/scrape/:jobId/events` → recibe eventos progress, log, complete

### Tests for User Story 2 ⚠️ TDD

- [ ] T024 [P] [US2] Test for GET /scrape/:jobId/events returns SSE content-type in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T025 [P] [US2] Test for SSE stream receives progress events in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T026 [P] [US2] Test for SSE stream receives complete event with posts in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T027 [P] [US2] Test for SSE stream receives error event on failure in `packages/scraper/src/routes/scrape.spec.ts`
- [ ] T028 [P] [US2] Test for job-tracker registers and notifies SSE clients in `packages/scraper/src/services/job-tracker.spec.ts`

### Implementation for User Story 2

- [ ] T029 [P] [US2] Add SSE client registration to job-tracker in `packages/scraper/src/services/job-tracker.ts` (`registerSSE(jobId, stream)` + `notifyClients(jobId, event)`)
- [ ] T030 [US2] Implement SSE endpoint in `packages/scraper/src/routes/scrape.ts` (GET /scrape/:jobId/events — registers SSE client, streams events using `hono/streaming`)
- [ ] T031 [US2] Integrate progress emission in scrape-runner in `packages/scraper/src/services/scrape-runner.ts` (emit progress via job-tracker.notifyClients on each phase change)

**Checkpoint**: Clientes SSE reciben progreso del scrape en tiempo real con fases y métricas.

---

## Phase 5: User Story 3 — Gestión de Perfiles (Priority: P2)

**Goal**: Listar, crear, eliminar perfiles y verificar sesión de Facebook

**Independent Test**: `curl http://localhost:3001/api/v1/profiles` → lista. `curl -X POST -d '{"name":"cuenta-2"}' http://localhost:3001/api/v1/profiles` → 201. `curl http://localhost:3001/api/v1/profiles/cuenta-2/check` → { alive }

### Tests for User Story 3 ⚠️ TDD

- [ ] T032 [P] [US3] Test for GET /profiles returns profile list in `packages/scraper/src/routes/profiles.spec.ts`
- [ ] T033 [P] [US3] Test for POST /profiles creates profile directory in `packages/scraper/src/routes/profiles.spec.ts`
- [ ] T034 [P] [US3] Test for POST /profiles with invalid name returns 400 in `packages/scraper/src/routes/profiles.spec.ts`
- [ ] T035 [P] [US3] Test for POST /profiles with existing name returns 409 in `packages/scraper/src/routes/profiles.spec.ts`
- [ ] T036 [P] [US3] Test for DELETE /profiles/:name removes profile in `packages/scraper/src/routes/profiles.spec.ts`
- [ ] T037 [P] [US3] Test for GET /profiles/:name/check returns session status in `packages/scraper/src/routes/profiles.spec.ts`
- [ ] T038 [P] [US3] Test for profile-manager listProfiles reads filesystem in `packages/scraper/src/services/profile-manager.spec.ts`
- [ ] T039 [P] [US3] Test for profile-manager checkSession detects feed vs login in `packages/scraper/src/services/profile-manager.spec.ts`

### Implementation for User Story 3

- [ ] T040 [P] [US3] Create profile manager service in `packages/scraper/src/services/profile-manager.ts` (listProfiles, createProfile, deleteProfile, checkSession — all filesystem-based with .meta.json metadata)
- [ ] T041 [P] [US3] Create profiles route in `packages/scraper/src/routes/profiles.ts` (GET /profiles, POST /profiles, DELETE /profiles/:name)
- [ ] T042 [US3] Create session check logic in `packages/scraper/src/services/profile-manager.ts` (Chrome headless → navigate to facebook.com → detect feed vs redirect to /login/)
- [ ] T043 [US3] Create session check endpoint in `packages/scraper/src/routes/profiles.ts` (GET /profiles/:name/check)
- [ ] T044 [US3] Wire profiles route into server in `packages/scraper/src/server.ts`

**Checkpoint**: Perfiles gestionables via API. Sesión de Facebook verificable.

---

## Phase 6: User Story 4 — Login Containerizado (Priority: P2)

**Goal**: Iniciar sesión en Facebook via VNC desde el navegador

**Independent Test**: `POST /api/v1/login { profile: "cuenta-2" }` → 201 { vncUrl }. Abrir vncUrl en navegador → ver Chrome con Facebook. Hacer login. Verificar perfil → alive: true

### Tests for User Story 4 ⚠️ TDD

- [ ] T045 [P] [US4] Test for POST /login returns VNC URL in `packages/scraper/src/routes/login.spec.ts`
- [ ] T046 [P] [US4] Test for POST /login with non-existent profile returns 400 in `packages/scraper/src/routes/login.spec.ts`
- [ ] T047 [P] [US4] Test for POST /login when already in progress returns 409 in `packages/scraper/src/routes/login.spec.ts`
- [ ] T048 [P] [US4] Test for GET /login/:profile/status returns state in `packages/scraper/src/routes/login.spec.ts`
- [ ] T049 [P] [US4] Test for login-manager launches and tracks Chrome process in `packages/scraper/src/services/login-manager.spec.ts`

### Implementation for User Story 4

- [ ] T050 [P] [US4] Create login manager service in `packages/scraper/src/services/login-manager.ts` (startLogin — launches Chromium in Xvfb display :99 pointing to facebook.com, tracks process; getStatus; completeLogin — closes browser, persists profile)
- [ ] T051 [P] [US4] Create login route in `packages/scraper/src/routes/login.ts` (POST /login, GET /login/:profile/status)
- [ ] T050b [P] [US4] Create login complete endpoint in `packages/scraper/src/routes/login.ts` (POST /login/:profile/complete — closes Chromium, persists profile, marks login as complete)
- [ ] T052 [US4] Wire login route into server in `packages/scraper/src/server.ts`

**Checkpoint**: Login de Facebook funciona dentro del container via VNC.

---

## Phase 7: Dashboard UI

**Purpose**: Interfaz web para gestionar perfiles y scraping

**Independent Test**: Abrir `http://localhost:3001/dashboard` → ver lista de perfiles, botones de verificar/login, formulario de scrape rápido

- [ ] T053 [P] Create dashboard HTML with htmx in `packages/scraper/src/static/dashboard.html` (profile list, check-session buttons, login button that opens noVNC, quick scrape form)
- [ ] T054 Register static file serving in `packages/scraper/src/server.ts` (serve `static/` directory at `/dashboard`)

**Checkpoint**: Dashboard funcional en el navegador.

---

## Phase 8: Docker & Container

**Purpose**: Containerizar el scraper con Xvfb + noVNC

- [ ] T055 Create entrypoint script in `packages/scraper/scripts/entrypoint.sh` (start Xvfb :99, start x11vnc, start websockify/noVNC on :6080, clean Chrome locks, start Node server)
- [ ] T056 Update Dockerfile in `docker/Dockerfile.scraper` (add xvfb, x11vnc, novnc packages; copy entrypoint; expose 3001 and 6080; VOLUME /app/profiles; change CMD to entrypoint)
- [ ] T057 [P] Update docker-compose in `docker-compose.yml` (scraper service: ports 3001:3001, 6080:6080; environment PORT=3001; keep volumes; remove REDIS_URL)
- [ ] T058 [P] Add healthcheck to scraper service in `docker-compose.yml` (curl http://localhost:3001/api/v1/ready)

**Checkpoint**: `docker compose up scraper` → container arranca con Xvfb, noVNC, Node server. Login + scrape funcionan dentro del container.

---

## Phase 9: Integración con NestJS API

**Purpose**: NestJS API llama al scraper via HTTP en vez de BullMQ

- [ ] T059 Update `apps/api/src/features/scrape/application/scrape.service.ts` — `triggerScrape()` calls `POST http://scraper:3001/api/v1/scrape` instead of `queueService.addScrapeJob()`
- [ ] T060 Update `apps/api/src/features/scrape/application/scrape.service.ts` — `getJobStatus()` calls `GET http://scraper:3001/api/v1/scrape/:jobId` instead of BullMQ
- [ ] T061 Update `apps/api/src/infrastructure/queue/queue.service.ts` — remove `scrapeQueue` and `addScrapeJob()`, keep only `aiQueue` and `addAiProcessJob()`
- [ ] T062 [P] Remove BullMQ scrape queue registration from `apps/api/src/infrastructure/queue/queue.module.ts` (unregister `'scrape'` queue)
- [ ] T063 Add `SCRAPER_URL` env var to `.env` and `docker-compose.yml` for the API service

**Checkpoint**: POST /api/scrape en NestJS API dispara scraping via HTTP al scraper, no via BullMQ.

---

## Phase 10: Integración con Admin UI

**Purpose**: Admin UI muestra progreso real via SSE

- [ ] T064 Update `apps/admin/src/lib/api.ts` — `triggerScrape()` now calls NestJS API (unchanged) but expects immediate jobId
- [ ] T065 Update `apps/admin/src/hooks/use-scrape.ts` — add SSE subscription to `http://scraper:3001/api/v1/scrape/:jobId/events` for real progress
- [ ] T066 Update `apps/admin/src/components/dashboard/scrape-controls.tsx` — replace spinner with real progress bar showing phase and counts; show SSE log messages; show complete notification with metrics
- [ ] T067 Add SSE proxy route in NestJS API (`apps/api/src/features/scrape/`) or configure CORS headers on scraper — Admin UI cannot connect directly to scraper from browser (different container/CORS). Option A: add `GET /api/scrape/:jobId/events` proxy in NestJS that forwards to scraper SSE. Option B: configure CORS on scraper and point Admin UI to `http://scraper:3001/api/v1/scrape/:jobId/events`

**Checkpoint**: Admin UI "Scrapear ahora" muestra progreso real con fases y notificación al completar.

---

## Phase 11: DB Mode (groupId)

**Purpose**: Soportar scrape via groupId con configuración desde la base de datos

- [ ] T068 Add Prisma group lookup in `packages/scraper/src/services/scrape-runner.ts` when request has groupId instead of url (use `@fb-store/shared` Prisma client)
- [ ] T069 Load Group config (maxPosts, name) from DB and use as defaults in `packages/scraper/src/services/scrape-runner.ts`
- [ ] T070 Update scrape route to validate that exactly one of url or groupId is present in `packages/scraper/src/routes/scrape.ts`

**Checkpoint**: POST /scrape { groupId } funciona con config de la DB.

---

## Phase 12: Cleanup & Polish

**Purpose**: Remover BullMQ, actualizar tests, documentación

- [ ] T069b Implement edge case handling across scrape route in `packages/scraper/src/routes/scrape.ts`: network errors, empty results (0 posts), invalid URLs, expired login sessions, DB connection failures in groupId mode. Each must return appropriate error with clear message.
- [ ] T071 Remove `packages/scraper/src/worker.ts` — delete file (no longer needed)
- [ ] T072 Remove `packages/scraper/src/login.ts` — delete file (replaced by login-manager + VNC)
- [ ] T073 Remove bullmq and ioredis from `packages/scraper/package.json`
- [ ] T074 Update existing tests in `packages/scraper/src/index.spec.ts` for refactored scrapGroup (with onProgress callback)
- [ ] T075 Run full test suite: `pnpm --filter @fb-store/scraper test` — all pass
- [ ] T076 Run full build: `pnpm build` — no errors
- [ ] T077 Verify SC-002: SSE events arrive at least every 5 seconds during active scrape in `specs/006-scraper-microservicio-http/quickstart.md` (manual timing test)
- [ ] T078 Verify SC-006: health/status/profile endpoints respond in under 500ms (manual timing test with `time curl`)
- [ ] T079 Run full validation per quickstart.md scenarios in `specs/006-scraper-microservicio-http/quickstart.md`

**Checkpoint**: Todo el feature completo, testeado, build sin errores.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Blocks |
|-------|-----------|--------|
| 1. Setup | Nothing | Phase 2 |
| 2. Foundational | Phase 1 | All user stories |
| 3. US1 — Scrape API | Phase 2 | Nothing (standalone) |
| 4. US2 — SSE | Phase 3 | Nothing (adds to US1) |
| 5. US3 — Profiles | Phase 2 | Phase 6 |
| 6. US4 — Login | Phase 5 | Nothing |
| 7. Dashboard | Phase 5, 6 | Nothing |
| 8. Docker | Phase 6 | Phase 9 |
| 9. NestJS Integration | Phase 8 | Phase 10 |
| 10. Admin UI | Phase 9 | Nothing |
| 11. DB Mode | Phase 2 | Nothing (parallel to US3) |
| 12. Polish | All | — |

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational. No deps on other stories.
- **US2 (P1)**: Depends on US1 (adds SSE to the scrape endpoint). Should be implemented immediately after US1.
- **US3 (P2)**: Can start after Foundational. Independent of US1/US2.
- **US4 (P2)**: Depends on US3 (login works on a profile). Independent of US1/US2.

### Parallel Opportunities

- All [P] tasks within a phase run in parallel (different files)
- US1 and US3 can run in parallel once Foundational is done
- Docker phase and Integration phase can overlap with Dashboard
- DB Mode (Phase 11) can run in parallel with US3/US4

### Parallel Example: User Story 1

```bash
# Tests first (TDD):
Task: T010-T018 — run all test files

# Then implementation:
Task: T020 — refactor index.ts (onProgress)
Task: T021 — create scrape-runner.ts
# T021 depends on T020, sequential
Task: T021 — create route scrape.ts
Task: T022 — add status endpoint
Task: T023 — wire into server.ts
```

---

## Implementation Strategy

### MVP First (Phases 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 — Scrape API HTTP
4. **STOP and VALIDATE**: `curl POST /api/v1/scrape { url }` → 202 → GET /status → posts
5. The scraper ya es consultable vía HTTP (core problem solved!)

### Incremental Delivery

1. **MVP** (Phases 1-3): Scraper HTTP funcional, recibe requests, extrae posts
2. **+ SSE** (Phase 4): Progreso en tiempo real
3. **+ Perfiles** (Phase 5): Múltiples cuentas gestionables
4. **+ Login** (Phase 6): Login containerizado con VNC
5. **+ Dashboard** (Phase 7): UI web interna
6. **+ Docker** (Phase 8): Container listo para producción
7. **+ Integración** (Phases 9-10): NestJS API + Admin UI actualizados
8. **+ DB Mode** (Phase 11): Scrape con groupId desde configuración

### Total Effort

| Phase | Tasks | Est. time |
|-------|-------|-----------|
| 1: Setup | 2 | 15 min |
| 2: Foundational | 6 | 1 hr |
| 3: US1 — Scrape API | 14 | 3 hr |
| 4: US2 — SSE | 8 | 2 hr |
| 5: US3 — Profiles | 13 | 3 hr |
| 6: US4 — Login | 9 | 2.5 hr |
| 7: Dashboard | 2 | 1 hr |
| 8: Docker | 4 | 2 hr |
| 9: NestJS Integration | 5 | 1.5 hr |
| 10: Admin UI | 4 | 2 hr |
| 11: DB Mode | 3 | 1 hr |
| 12: Polish | 10 | 2 hr |
| **Total** | **81** | **~21.5 hr** |

## Notes

- Tests are MANDATORY per Constitution Item 4 (TDD). Write tests first, ensure they FAIL, then implement.
- [P] tasks = different files, no dependencies — can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Stop at any checkpoint to validate story independently
- After Phase 3 (US1), the scraper is already a consultable HTTP microservice — the core problem is solved
