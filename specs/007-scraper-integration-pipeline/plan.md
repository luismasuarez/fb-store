# Implementation Plan: Scraper Integration Pipeline

**Branch**: `007-scraper-integration-pipeline` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-scraper-integration-pipeline/spec.md`

## Summary

Reconectar los 6 componentes del sistema (scraper, API, scheduler, AI processor, Admin UI, DB) después de la migración del scraper a microservicio HTTP. El pipeline scrape → persistencia → AI → listings está roto en 3 puntos críticos: (1) `savePosts` no se ejecuta en `scrape-runner.ts`, (2) el API no encadena AI processing tras el scrape, (3) el scheduler usa una BullMQ queue huérfana. Además, hay 3 gaps de UX y mantenimiento. Este plan repara las 6 roturas siguiendo los patrones de comunicación definidos en la investigación: polling para detección de finalización, `@nestjs/schedule` para scheduler, y scraping directo desde scraper a DB.

## Technical Context

**Language/Version**: TypeScript 6.0, Node.js >=22.13

**Primary Dependencies**: 
- `@nestjs/schedule` (nuevo) — reemplaza BullMQ para el scheduler
- Hono (existente) — scraper HTTP microservice
- BullMQ (existente) — solo para ai-process queue
- Playwright 1.60 (existente) — browser automation

**Storage**: PostgreSQL 18 via Prisma 7 (existente). El scraper guarda posts directamente en DB via `getPrismaClient()` de `@fb-store/shared`.

**Testing**: Vitest (existente en scraper y API). Tests TDD mandatory. Nuevos tests para:
- `scrape-runner.spec.ts` — verificar que `savePosts`/`saveScrapeLog` se llaman
- `scrape.service.spec.ts` — verificar polling + auto-chain
- `scheduler.service.spec.ts` — verificar ciclo de grupos vía HTTP
- `job-tracker.spec.ts` — verificar TTL de jobs

**Target Platform**: Linux (Docker containers). Todos los componentes corren en la red Docker interna `fb-store-net`.

**Project Type**: Web service (NestJS API) + standalone HTTP microservice (scraper) + queue worker (AI processor) + React SPA (Admin UI)

**Performance Goals**: 
- Polling: job status check en < 500ms cada 5s
- Scheduler: ciclo completo para 10 grupos en < 20 minutos
- AI auto-chain: encole en menos de 15s tras detección de completado
- TTL: limpieza de jobs en < 100ms

**Constraints**: 
- El scraper NO debe depender de llamar al API NestJS (FR-018 de Spec 006)
- Sin Redis para el scheduler (solo para ai-process queue de BullMQ)
- TDD mandatory — tests primero, implementación después
- Posts con imágenes base64 (~500KB c/u) no deben viajar por HTTP entre servicios

**Scale/Scope**: 5-20 grupos activos. Scrapes cada 4 horas. Jobs en memoria con TTL de 30 min.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| **I. Spec-First** | ✅ Pass | Spec exists at `specs/007-scraper-integration-pipeline/spec.md`, built on Spec 003 (foundation) and Spec 006 (scraper HTTP) |
| **II. Feature-Based Modularity** | ✅ Pass | Changes follow the 3-layer pattern. New logic in `application/` layers. No new modules needed — ScrapeModule, SchedulerModule, AiProcessorModule ya existen |
| **III. Zod-First Validation** | ✅ Pass | No new DTOs needed. Existing Zod schemas are reused. El único cambio de validación es en el Admin UI (selector de grupo) |
| **IV. Async Pipeline** | 🟡 Deviation — Justified | El scheduler reemplaza BullMQ por `@nestjs/schedule` + HTTP. **Justificación**: La queue "scrape" de BullMQ se eliminó en Spec 006 y no tiene consumer. Reemplazarla por `@nestjs/schedule` es el estándar de NestJS para scheduling. La cola "ai-process" via BullMQ se conserva para el AI processor. El principio IV se cumple en espíritu: el pipeline scrape → AI es automático, solo cambia el mecanismo de disparo. |
| **V. Error Observability** | ✅ Pass | Se reutiliza el sistema existente: `requestId`, error categorization, categorized exceptions. El nuevo polling captura errores del scraper y los logea categorizados. |

**Gate Verdict**: ✅ PASS — Una desviación justificada del Principio IV. El scheduler migra de BullMQ a `@nestjs/schedule` porque la queue "scrape" ya no existe. El pipeline asíncrono scrape → AI se mantiene automático.

## Project Structure

### Documentation (this feature)

```text
specs/007-scraper-integration-pipeline/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — architecture decisions (D1-D8)
├── data-model.md        # Phase 1 — entities and data flow
├── quickstart.md        # Phase 1 — validation guide
├── contracts/           # Phase 1 — interface contracts
│   └── communication-patterns.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
packages/scraper/src/
├── services/
│   └── scrape-runner.ts              # MODIFIED: add savePosts + saveScrapeLog
│   ├── scrape-runner.spec.ts         # MODIFIED: test new persistence calls
├── services/
│   └── job-tracker.ts                # MODIFIED: add TTL auto-cleanup (30 min)
│   ├── job-tracker.spec.ts           # MODIFIED: test TTL behavior

apps/api/src/
├── features/scrape/
│   ├── scrape.module.ts              # MODIFIED: import AiProcessorModule
│   └── application/
│       └── scrape.service.ts         # MODIFIED: add waitForJob + chainAfterScrape
│       ├── scrape.service.spec.ts    # MODIFIED: test polling + auto-chain
├── features/ai-processor/
│   └── ai-processor.module.ts        # MODIFIED: export AiProcessorService
├── features/scheduler/
│   ├── scheduler.module.ts           # REWRITTEN: remove BullMQ, add ScheduleModule + AiProcessorModule
│   └── application/
│       └── scheduler.service.ts      # REWRITTEN: use SchedulerRegistry + HTTP calls
│       ├── scheduler.service.spec.ts # NEW: test scheduler cycle
├── features/groups/
│   ├── infrastructure/
│   │   └── group.repository.ts       # MODIFIED: add findActive() method
│   └── application/
│       └── groups.service.ts         # MODIFIED: add findActive() method
└── package.json                      # MODIFIED: add @nestjs/schedule

apps/admin/src/
├── hooks/
│   └── use-scrape.ts                 # MODIFIED: accept groupId param in mutationFn
├── components/dashboard/
│   └── scrape-controls.tsx           # MODIFIED: add group selector dropdown
└── pages/
    └── groups-page.tsx               # MODIFIED: add Scrape button per row + polling
```

**Structure Decision**: Se mantiene la estructura existente del monorepo con 4 paquetes. Los cambios se limitan a archivos específicos dentro de cada paquete. No se crean nuevos módulos NestJS — se modifican los existentes. La lógica nueva de polling y auto-chain se agrega a `ScrapeService` (application layer). El scheduler se reescribe completamente pero mantiene su API de configuración (GET/PUT /api/schedule).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Scheduler sin BullMQ (Principio IV) | La queue "scrape" de BullMQ se eliminó en Spec 006 y no tiene consumer. El scheduler actual registra jobs en una queue fantasma. | Mantener BullMQ requeriría crear un worker HTTP que consuma de la queue "scrape" — más componentes, más latencia, misma dependencia de Redis. |
