<!-- SYNC IMPACT REPORT
Version change: 1.0.0 → 1.1.0
Modified principles: Item 4 in Development Workflow — changed from "Testing is encouraged but not mandatory" to "TDD Mandatory (NON-NEGOTIABLE)"
Added sections: None
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (already generic, no changes needed)
  - .specify/templates/spec-template.md ✅ (already generic, no changes needed)
  - .specify/templates/tasks-template.md ✅ (already generic, no changes needed)
  - .specify/templates/checklist-template.md ✅ (already generic, no changes needed)
  - .specify/extensions/git/commands/*.md ✅ (git commands, no constitution references)
Follow-up TODOs: None
-->

# FB Store Constitution

## Core Principles

### I. Spec-First Development
Every feature starts from a specification in `SPECS.md`. Each spec defines:
scope, acceptance criteria, deliverables, and which previous spec it depends on.
No implementation begins without an approved spec. The roadmap in `ROADMAP.md`
defines the sequence and dependencies between specs. A spec MUST be completable
and deployable independently — it must leave something functional.

### II. Feature-Based Modularity
Every API feature is a self-contained module with three internal layers:
- `api/` — controllers, DTOs (Zod schemas), guards
- `application/` — services, use cases (business logic)
- `infrastructure/` — repositories (data access)

The repository pattern MUST be used for ALL database access. No service
injects `PrismaService` directly. Repositories abstract the ORM and make
the business logic testable without a real database.

### III. Zod-First Validation
Zod 4 is the single source of truth for schemas, types, and validation.
All DTOs are Zod schemas. The global `ZodValidationPipe` validates every
request with `whitelist: true` (strips unknown fields) and `transform: true`
(coerces types). No `class-validator` or `class-transformer` — they add
duplicate annotation overhead without benefit over Zod.

### IV. Async Pipeline
All heavy computation (web scraping, AI processing, batch operations) runs
via BullMQ workers. HTTP endpoints MUST NOT block on long-running operations.
The pipeline `scrape → AI processor → listing ready` is automatic via job
chaining — when a scrape job completes, it enqueues the AI processing job.
The scheduler (BullMQ repeatable jobs) drives periodic execution without
human intervention.

### V. Error Observability
Every error response MUST include:
- A `requestId` for correlation (auto-generated or forwarded from client)
- A `category`: `validation` | `authorization` | `rate_limit` | `business`
- A human-readable `message` (never the raw exception message)

Stack traces MUST NEVER be exposed to the client. The global exception filter
(`core/filters/http-exception.filter.ts`) handles this uniformly for all
endpoints. The `RequestIdInterceptor` provides tracing and accumulates
rejection metrics.

## Stack & Technology

| Domain | Choice | Rationale |
|--------|--------|-----------|
| Package manager | pnpm | Workspaces, fast, strict |
| Monorepo | Turborepo | Task orchestration, caching |
| API framework | NestJS 11 + Fastify 5 | Structured, fast, TypeScript-native |
| ORM | Prisma 7 + adapter-pg | Type-safe, migrations, schema-first |
| Database | PostgreSQL 18 | Mature, spatial, JSON support |
| Queue | Redis 7 + BullMQ 5 | Persistent job queues, scheduling |
| Scraper | Playwright 1.60 (Chromium) | Headless browser, persistent profiles |
| AI | OpenRouter API | Multi-model access via single API |
| Frontend | Vite 8 + React 19 + shadcn/ui + Tailwind 4 | Fast dev, modern stack |
| Language | TypeScript 6.0, Node.js >=22.13 | Strong typing, modern features |
| Infrastructure | Docker Compose | Single-command deploy, portable |

All shared schemas, types, Zod validators, Prisma client, AI providers, and
utilities live in `packages/shared`. It is the only package that owns the
database schema and Prisma client generation.

## Development Workflow

1. Work follows the speckit workflow: Spec → Plan → Tasks → Implement →
   Checklist. Each spec is a standalone feature branch with sequential
   numbering (`001-feature-name`).
2. The repository is the source of truth. `ROADMAP.md` contains the technical
   plan and task details. `SPECS.md` contains the feature breakdown by phase.
   `ARCHITECTURE-REFERENCE.md` provides technical reference (scraping strategy,
   AI providers, DB schema, deployment).
3. Before implementing, verify alignment with the active spec. Each spec builds
   on the previous one — respect the dependency chain.
4. **TDD Mandatory (NON-NEGOTIABLE)**. Tests MUST be written before implementation.
   Red-Green-Refactor cycle strictly enforced. Run single test files during development:
   `pnpm --filter <package> test <file>`. Full test suite runs after lint → typecheck → test
   flow. Tests use Vitest and follow the patterns from the feature's `application/` layer
   (pure unit tests) or `TestingModule` (integration with mocked repositories).
5. Commits are manual (auto-commit is disabled in speckit config). Commit
   messages should be descriptive and reference the spec when applicable.

## Governance

- This constitution is the highest authority for project decisions.
- Amendments require: documented rationale in the commit message, a version
  bump following semver, and a Sync Impact Report at the top of this file.
- All implementations MUST align with `ROADMAP.md` (technical plan) and
  `SPECS.md` (feature breakdown). Deviations must be documented and approved.
- The three guiding documents are:
  - `ROADMAP.md` — what to build, in what order, with technical detail
  - `SPECS.md` — why each spec exists, what it includes, what it defers
  - `ARCHITECTURE-REFERENCE.md` — how the system is designed (reference)

**Version**: 1.1.0 | **Ratified**: 2026-05-25 | **Last Amended**: 2026-07-18
