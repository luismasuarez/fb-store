# Tasks: Autenticación + Administración de Grupos

**Input**: Design documents from `/specs/005-auth-group-admin/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (TDD mandatory per constitution). Tests MUST be written first and fail before implementation.

**Organization**: Tasks grouped by phase. Phase 3 combines US1 (Login) + US4 (Endpoint Protection) as interconnected auth stories.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to user story phase label (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies needed for this feature

- [ ] T001 Install `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt` in `apps/api`
- [ ] T002 [P] Install `@tanstack/react-query` in `apps/admin`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, config, and seed infrastructure that must be ready before any auth/group logic

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `User` model (id, email, passwordHash, displayName, createdAt, updatedAt) and `AuthSession` model (id, userId FK, tokenHash, expiresAt, revokedAt, createdAt) to `packages/shared/prisma/schema.prisma`
- [ ] T004 Run Prisma migration: `pnpm --filter shared prisma:migrate --name add_user_auth_session`
- [ ] T005 [P] Add `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` env vars to `apps/api/src/infrastructure/config/app-config.service.ts` with validation at startup
- [ ] T006 Add env vars to `.env.example` and `docker-compose.yml`

**Checkpoint**: Foundation ready — User/AuthSession tables exist, JWT config validated at startup

---

## Phase 3: User Story 1 + 4 — Auth Module + Endpoint Protection (Priority: P1) 🎯 MVP

**Goal**: Admin can log in with email/password, receive dual JWT tokens, refresh sessions, log out, and protected endpoints reject unauthenticated requests.

**Independent Test**: `POST /api/auth/login` with valid credentials → `{ accessToken, refreshToken, expiresIn }`. Use access token on `POST /api/scrape` → 202. Use on `POST /api/scrape` without token → 401.

### Tests for Auth

> **NOTE**: Write these tests FIRST, ensure they FAIL before implementation

- [ ] T007 [P] [US1] Write auth.service unit tests (login validation, refresh rotation, logout revocation) in `apps/api/src/features/auth/application/auth.service.spec.ts`
- [ ] T008 [P] [US1] Write JwtAuthGuard integration test (token missing, expired, invalid) in `apps/api/src/features/auth/api/jwt-auth.guard.spec.ts`
- [ ] T009 [US4] Write endpoint protection integration test (scrape, ai-process, schedule without token → 401; listings, health without token → 200) in `apps/api/test/endpoint-protection.spec.ts`

### Implementation for Auth

- [ ] T010 [P] [US1] Create `login.dto.ts` (Zod: email, password), `auth-response.dto.ts` (Zod: accessToken, refreshToken, expiresIn), `refresh.dto.ts` (Zod: refreshToken) in `apps/api/src/features/auth/api/dto/`
- [ ] T011 [P] [US1] Create `token.service.ts` with SHA-256 `hashToken()` in `apps/api/src/features/auth/application/token.service.ts`
- [ ] T012 [P] [US1] Create `auth-session.repository.ts` with CRUD (findByTokenHash, create, revoke, findActiveByUser) in `apps/api/src/features/auth/infrastructure/auth-session.repository.ts`
- [ ] T013 [US1] Create `auth.service.ts` with scrypt password hashing, JWT issuance (access + refresh), refresh rotation, logout, and audit logging of all auth attempts in `apps/api/src/features/auth/application/auth.service.ts`
- [ ] T014 [P] [US1] Create `jwt.strategy.ts` (Bearer token, validates `typ === "access"`) and `refresh-jwt.strategy.ts` (body.refreshToken, validates `typ === "refresh"`) in `apps/api/src/features/auth/strategies/`
- [ ] T015 [US1] Create `jwt-auth.guard.ts` extending `AuthGuard('jwt')` in `apps/api/src/features/auth/api/jwt-auth.guard.ts`
- [ ] T016 [US1] Create `auth.controller.ts` with `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` in `apps/api/src/features/auth/api/auth.controller.ts`
- [ ] T017 [US1] Create `auth.module.ts` importing PassportModule, JwtModule, and all auth components; register in `apps/api/src/app.module.ts`
- [ ] T018 [US4] Add `@UseGuards(JwtAuthGuard)` to `POST /api/scrape` in `apps/api/src/features/scrape/api/scrape.controller.ts`, `POST /api/ai-process` in `apps/api/src/features/ai-processor/api/ai-processor.controller.ts`, and `PUT /api/schedule` in `apps/api/src/features/scheduler/api/scheduler.controller.ts`
- [ ] T019 [US1] Create seed script `apps/api/src/seed.ts` that reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars, creates User with scrypt hash, and logs result; integrate into `apps/api/package.json` as `"seed"` script

**Checkpoint**: Auth system complete — login, refresh, logout, and endpoint protection working. MVP ready.

---

## Phase 4: User Story 2 — Dashboard con Controles Operativos (Priority: P1)

**Goal**: Admin dashboard replaces CLI instructions card with functional "Scrapear ahora" and "Procesar con IA" buttons that show loading state and prevent duplicate submissions.

**Independent Test**: Click "Scrapear ahora" → spinner appears → button disables → on complete, shows last scrape time and button re-enables.

### Implementation for Dashboard Controls

- [ ] T020 [P] [US2] Create `apps/admin/src/lib/auth.ts` with React Context provider, token storage (memory + localStorage), automatic refresh on 401, and `ProtectedRoute` wrapper component
- [ ] T021 [P] [US2] Refactor `apps/admin/src/lib/api.ts` to attach `Authorization: Bearer` header from auth context to all requests; add `triggerScrape()` and `triggerAiProcess()` functions
- [ ] T022 [US2] Create `apps/admin/src/pages/login-page.tsx` with email/password form, calls `POST /api/auth/login`, stores tokens, redirects to `/` on success
- [ ] T023 [US2] Refactor `apps/admin/src/App.tsx` to add `/login` route (public), `ProtectedRoute` wrapper around existing routes
- [ ] T024 [P] [US2] Create `apps/admin/src/hooks/use-scrape.ts` with `useMutation` for scrape/AI trigger and polling (`useQuery` with refetchInterval) for job status
- [ ] T025 [US2] Create `apps/admin/src/components/dashboard/scrape-controls.tsx` with "Scrapear ahora" and "Procesar con IA" buttons, spinner state, last-scrape timestamp, and disabled-while-running logic
- [ ] T026 [US2] Refactor `apps/admin/src/components/layout/header.tsx` to add logout button (calls `POST /api/auth/logout`, clears tokens, redirects to `/login`) and email/name indicator
- [ ] T027 [US2] Refactor `apps/admin/src/pages/dashboard-page.tsx` to replace CLI instructions card with `<ScrapeControls />` component

**Checkpoint**: Dashboard fully functional — login flow, protected routes, scrape/AI buttons with feedback. No CLI needed for daily operation.

---

## Phase 5: User Story 3 — Administración de Grupos de Facebook (Priority: P2)

**Goal**: Admin can manage Facebook groups from the web (create, list, edit, delete, toggle active/inactive) without touching `.env` or restarting containers.

**Independent Test**: Create group via `POST /api/groups` → appears in `GET /api/groups`. Update via `PUT /api/groups/:id` → reflected in GET. Delete via `DELETE /api/groups/:id` → 404 on re-fetch.

### Tests for Groups

> **NOTE**: Write these tests FIRST, ensure they FAIL before implementation

- [ ] T028 [P] [US3] Write groups.service unit tests (create, list, update, delete, duplicate URL rejection, 404 handling) in `apps/api/src/features/groups/application/groups.service.spec.ts`

### Implementation for Groups

- [ ] T029 [P] [US3] Create `create-group.dto.ts` (Zod: id, name, url, maxPosts optional, isActive optional) and `update-group.dto.ts` (all fields optional) in `apps/api/src/features/groups/api/dto/`
- [ ] T030 [P] [US3] Create `group.repository.ts` with CRUD (findAll, findById, create, update, delete, findByUrl) in `apps/api/src/features/groups/infrastructure/group.repository.ts`
- [ ] T031 [US3] Create `groups.service.ts` with business logic (duplicate URL check, partial update merge) in `apps/api/src/features/groups/application/groups.service.ts`
- [ ] T032 [US3] Create `groups.controller.ts` with `GET /api/groups` (public, paginated), `POST /api/groups` (JWT), `GET /api/groups/:id` (JWT), `PUT /api/groups/:id` (JWT), `DELETE /api/groups/:id` (JWT) in `apps/api/src/features/groups/api/groups.controller.ts`
- [ ] T033 [US3] Create `groups.module.ts` and register in `apps/api/src/app.module.ts`
- [ ] T034 [P] [US3] Refactor `apps/admin/src/lib/api.ts` to add `fetchGroups()`, `createGroup()`, `updateGroup()`, `deleteGroup()` functions
- [ ] T035 [US3] Create `apps/admin/src/components/groups/group-form.tsx` as modal form with fields: id (on create only), name, url, maxPosts, isActive toggle
- [ ] T036 [US3] Create `apps/admin/src/pages/groups-page.tsx` with table (name, url, maxPosts, active badge, lastScraped), create/edit/delete actions, and active/inactive toggle without reload
- [ ] T037 [US3] Refactor `apps/admin/src/App.tsx` to add `/groups` route and sidebar navigation link

**Checkpoint**: Group management complete — full CRUD from API + admin UI. No `.env` editing needed.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Final validation and edge case hardening

- [ ] T038 [P] Verify `POST /api/auth/login` returns identical 401 message for wrong email vs wrong password (timing-side-channel only)
- [ ] T039 [P] Verify duplicate group URL returns 409 business error via API
- [ ] T040 [P] Verify Group does not need DB schema changes (Group model was already in existing schema)
- [ ] T041 Verify `POST /api/auth/logout` revokes session and reusing the refresh token after logout returns 401
- [ ] T042 Run `quickstart.md` validation scenarios end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1+US4 Auth)**: Depends on Phase 2 — MVP scope
- **Phase 4 (US2 Dashboard)**: Depends on Phase 3 (needs auth for API calls)
- **Phase 5 (US3 Groups)**: Depends on Phase 3 (needs auth guards for mutating endpoints)
- **Phase 6 (Polish)**: Depends on Phases 3-5 completion

### User Story Dependencies

- **US1+US4 (Auth + Endpoint Protection)**: Can start after Phase 2 — No dependencies on other stories
- **US2 (Dashboard Controls)**: Depends on US1+US4 — needs JWT auth for API calls, login page for session
- **US3 (Group CRUD)**: Depends on US1+US4 — needs JwtAuthGuard for protected endpoints
- US2 and US3 are independent of each other and can be developed in parallel once auth is complete

### Within Each Phase

- Tests MUST be written and FAIL before implementation (TDD)
- DTOs/Repositories before Services
- Services before Controllers/Pages
- Controllers before UI integration

### Parallel Opportunities

| Phase | Tasks | Why Parallel |
|-------|-------|--------------|
| Phase 1 | T001, T002 | Different packages (api vs admin) |
| Phase 2 | T005 | Config is independent of DB schema |
| Phase 3 Tests | T007, T008, T009 | Different test files |
| Phase 3 Impl | T010, T011, T012 | DTOs, token service, repo are independent |
| Phase 3 Impl | T013, T014 | Service depends on T012, strategies are independent |
| Phase 4 | T020, T021 | Auth context and API lib are independent |
| Phase 5 Tests | T028 | Single test file |
| Phase 5 Impl | T029, T030 | DTOs and repository are independent |
| Phase 6 | T038, T039, T040 | Independent checks |

---

## Parallel Example: Auth Phase

```bash
# Tests (write first, expect failure):
Task: "Write auth.service unit tests in auth.service.spec.ts"
Task: "Write JwtAuthGuard integration test in jwt-auth.guard.spec.ts"
Task: "Write endpoint protection integration test in test/endpoint-protection.spec.ts"

# DTOs + foundational (parallel):
Task: "Create login.dto.ts, auth-response.dto.ts, refresh.dto.ts"
Task: "Create token.service.ts"
Task: "Create auth-session.repository.ts"

# Service + strategies (depend on above):
Task: "Create auth.service.ts (depends on T010, T011, T012)"
Task: "Create jwt.strategy.ts and refresh-jwt.strategy.ts"
```

---

## Implementation Strategy

### MVP First (Phase 3 Only)

1. Complete Phase 1: Install dependencies
2. Complete Phase 2: DB migration + config
3. Complete Phase 3: JWT auth + endpoint protection
4. **STOP and VALIDATE**: Login, refresh, logout, and endpoint protection work
5. Deploy/demo — the admin is now secure

### Incremental Delivery

1. Phases 1-3 → Auth system + secure endpoints (MVP)
2. Phase 4 → Dashboard controls (no CLI needed for daily ops)
3. Phase 5 → Group CRUD (no `.env` editing)
4. Phase 6 → Polish and validation

### Test Strategy

- Unit tests: `auth.service.spec.ts`, `groups.service.spec.ts` — pure logic, mock repositories
- Integration tests: `jwt-auth.guard.spec.ts` — NestJS TestingModule
- E2E: `endpoint-protection.spec.ts` — full HTTP cycle

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Write tests first (TDD mandatory per constitution)
- Each user story phase is independently testable
- File paths reference `apps/api/` (NestJS API) or `apps/admin/` (React SPA) per plan.md structure
