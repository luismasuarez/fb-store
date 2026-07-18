# Implementation Plan: Autenticación + Administración de Grupos

**Branch**: `004-auth-group-admin` | **Date**: 2026-07-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-auth-group-admin/spec.md`

## Summary

Implement authentication with JWT dual (access + refresh tokens with rotation), protect sensitive API endpoints, add CRUD for Facebook groups via API + admin UI, and replace the dashboard instructions card with functional scrape/AI controls.

## Technical Context

**Language/Version**: TypeScript 6.0, Node.js >=22.13

**Primary Dependencies**: NestJS 11 + Fastify 5, Passport (with JWT strategy), Zod 4, Prisma 7 + @prisma/adapter-pg, React 19 + Vite 8, @tanstack/react-query

**Storage**: PostgreSQL 18 (via Prisma ORM), no new storage — AuthSession table added to existing DB

**Testing**: Vitest (via NestJS TestingModule with mocked repositories), React Testing Library for UI components

**Target Platform**: Linux (Docker containers), Node.js runtime + browser

**Project Type**: Web service (NestJS API) + single-page admin app (Vite + React)

**Performance Goals**: Login <1s, group CRUD <500ms, dashboard button feedback <200ms

**Constraints**: Passwords hashed with scrypt + unique 16-byte salt + timingSafeEqual; refresh tokens stored as SHA-256 hashes; never expose stack traces; access tokens stateless (validated by signature); refresh rotation with immediate previous-token revocation; rate limiting on login endpoint

**Scale/Scope**: Single admin user, 5-20 Facebook groups, tens of thousands of listings

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First Development | ✅ PASS | Spec exists (created via `/speckit.specify`), depends on Spec 001 per `docs/SPECS.md` |
| II. Feature-Based Modularity | ✅ PASS | Auth and Groups implemented as feature modules with `api/` → `application/` → `infrastructure/` layers per constitution |
| III. Zod-First Validation | ✅ PASS | Login DTO, group create/update DTOs use Zod schemas validated by global ZodValidationPipe |
| IV. Async Pipeline | ✅ N/A | Auth and group CRUD are synchronous operations; no BullMQ involvement |
| V. Error Observability | ✅ PASS | Auth errors (401) use the categorized error format with requestId; unauthorized access returns authorization category |

**Gate Verdict**: ✅ PASS — All constitution principles verified. No violations to justify.

*Re-check after Phase 1 design: All principles still hold. Auth and Groups modules follow the 3-layer pattern (api/ → application/ → infrastructure/). All DTOs use Zod schemas. Auth errors use categorized format with requestId.*

## Project Structure

### Documentation (this feature)

```text
specs/004-auth-group-admin/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rest-api.md
│   └── sessions.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
apps/api/src/
├── features/
│   ├── auth/                            # NEW
│   │   ├── auth.module.ts
│   │   ├── api/
│   │   │   ├── auth.controller.ts       # POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout
│   │   │   └── dto/
│   │   │       ├── login.dto.ts         # Zod: { email, password }
│   │   │       ├── auth-response.dto.ts # Zod: { accessToken, refreshToken, expiresIn }
│   │   │       └── refresh.dto.ts       # Zod: { refreshToken }
│   │   ├── application/
│   │   │   ├── auth.service.ts          # Password hashing + JWT issuance + refresh rotation
│   │   │   └── token.service.ts         # SHA-256 hashToken()
│   │   ├── infrastructure/
│   │   │   └── auth-session.repository.ts
│   │   └── strategies/
│   │       ├── jwt.strategy.ts          # Bearer token, validates typ === "access"
│   │       └── refresh-jwt.strategy.ts  # body.refreshToken, validates typ === "refresh"
│   └── groups/                          # NEW
│       ├── groups.module.ts
│       ├── api/
│       │   ├── groups.controller.ts     # GET /api/groups (public), POST/PUT/DELETE (JWT)
│       │   └── dto/
│       │       ├── create-group.dto.ts
│       │       └── update-group.dto.ts
│       ├── application/
│       │   └── groups.service.ts
│       └── infrastructure/
│           └── group.repository.ts

apps/api/src/features/
├── scrape/
│   └── api/
│       └── scrape.controller.ts         # REFACTOR: add @UseGuards(JwtAuthGuard)
├── ai-processor/
│   └── api/
│       └── ai-processor.controller.ts   # REFACTOR: add @UseGuards(JwtAuthGuard)
└── scheduler/
    └── api/
        └── scheduler.controller.ts      # REFACTOR: add @UseGuards(JwtAuthGuard) on PUT

apps/admin/src/
├── lib/
│   ├── auth.ts                          # NEW: Auth context/provider with token storage + refresh
│   └── api.ts                           # REFACTOR: add auth headers, fetchGroups, createGroup, etc.
├── hooks/
│   └── use-scrape.ts                    # NEW: useMutation + polling for scrape/ai-process
├── pages/
│   ├── login-page.tsx                   # NEW: email + password form, stores JWT
│   └── groups-page.tsx                  # NEW: group table + create/edit/delete
├── components/
│   ├── dashboard/
│   │   └── scrape-controls.tsx          # NEW: "Scrapear ahora" + "Procesar con IA" buttons
│   ├── groups/
│   │   └── group-form.tsx               # NEW: create/edit group modal
│   └── layout/
│       └── header.tsx                   # REFACTOR: add logout button + session indicator
└── App.tsx                              # REFACTOR: add /login route, ProtectedRoute, /groups route, sidebar link
```

**Structure Decision**: Feature-based modules in `features/` with 3 internal layers per Constitution Principle II. Auth uses Passport strategies for JWT validation. Admin UI uses React contexts for auth state and `@tanstack/react-query` mutations with polling for job status feedback. The existing endpoint protection uses a `JwtAuthGuard` (extends `AuthGuard('jwt')`) attached via `@UseGuards()` on controllers.

## Complexity Tracking

*No Constitution violations — complexity tracking not required.*
