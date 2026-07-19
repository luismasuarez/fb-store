# Implementation Plan: Scraper como Microservicio HTTP Autónomo

**Branch**: `006-scraper-microservicio-http` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-scraper-microservicio-http/spec.md`

## Summary

Convertir el scraper de FB Store de un worker BullMQ pasivo a un microservicio HTTP autónomo usando Hono. El scraper expone API REST autenticada con x-api-key para scraping (URL directa o groupId desde DB), SSE para progreso en tiempo real, gestión de perfiles multi-cuenta, login containerizado con Xvfb + noVNC, y dashboard web con htmx. Logging estructurado JSON a consola. Se elimina la dependencia de BullMQ/Redis del scraper, manteniendo solo el AI processor pipeline via BullMQ desde el API NestJS.

## Technical Context

**Language/Version**: TypeScript 6.0, Node.js >=22.13

**Primary Dependencies**:
- Hono — framework HTTP (liviano, SSE nativo, static files)
- Playwright 1.60 — browser automation
- @fb-store/shared — Prisma client, tipos compartidos (solo para DB mode)
- sanitize-html — sanitización de texto (ya existe)
- Xvfb + x11vnc + noVNC (websockify) — display virtual y VNC web

**Storage**: 
- Perfiles: sistema de archivos en Docker volume (`/app/profiles/`)
- Jobs de scraping: mapa en memoria (volátil, no persiste entre reinicios)
- Datos extraídos: PostgreSQL via Prisma (solo en DB mode, `RawPost` y `ScrapeLog`)

**Testing**: Vitest (ya configurado en `packages/scraper/vitest.config.ts`). Tests existentes en `index.spec.ts` deben mantenerse. Tests nuevos para endpoints HTTP.

**Target Platform**: Linux (Docker container basado en `node:22-slim` con Chromium instalado via Playwright)

**Project Type**: Web service HTTP autónomo (monorepo, package `packages/scraper`)

**Performance Goals**: 
- Scrape de 20 posts en < 2 minutos
- Endpoints de estado/health en < 500ms
- Check de sesión de perfil en < 15 segundos

**Constraints**:
- Sin dependencia de Redis ni BullMQ (principio de diseño)
- Sin build step para el dashboard (HTML plano + htmx vía CDN)
- Cada perfil serializa sus scrapes (un job por perfil a la vez)
- Debe limpiar Chrome lock files al iniciar
- API key via `x-api-key` header, configurable via `SCRAPER_API_KEY` env var (el scraper no arranca sin ella)
- Logging: console-only con formato JSON estructurado

**Scale/Scope**: 1-10 perfiles de Facebook, cada uno con sesión persistente. Jobs de scraping en memoria (no persistidos). Sin concurrencia por perfil.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Justification |
|------|--------|---------------|
| **I. Spec-First** | ✅ Pass | Feature originates from approved spec `006-scraper-microservicio-http/spec.md` con FR-023 (auth) y logging agregados via clarify session |
| **II. Feature-Based Modularity** | ✅ Pass | El scraper es un package independiente (`packages/scraper`) con separación clara de capas que mapean al patrón de 3 capas: `routes/` → api (controllers), `services/` → application (business logic), `middleware/` + `services/profile-manager` (DB access) → infrastructure (repositories). La estructura análoga cumple el espíritu del principio aunque no use NestJS modules. |
| **III. Zod-First Validation** | ✅ Pass | Se usará Zod para validar requests HTTP entrantes (POST /scrape, POST /profiles, POST /login), manteniendo la convención del proyecto. |
| **IV. Async Pipeline** | 🟡 Deviation — Justified | El scraper elimina BullMQ y pasa a ser HTTP directo. Desviación deliberada del principio IV. **Justificación**: (1) El scraper necesita ser consultable por cualquier ente externo sin depender de Redis, (2) el patrón async se mantiene (202 inmediato + jobId + SSE para progreso), (3) el pipeline scrape → AI processor se conserva vía BullMQ desde el API NestJS, (4) desviación aprobada por el usuario en discusión previa a la spec. |
| **V. Error Observability** | ✅ Pass | El scraper implementará formato de error consistente con requestId, categoría y mensaje human-readable, alineado con el principio V. |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Eliminación de BullMQ (Principio IV) | El scraper necesita ser un microservicio HTTP consultable sin depender de Redis. BullMQ/Redis atan el scraper a la infraestructura de colas y lo hacen inaccesible desde fuera del ecosistema. | Mantener BullMQ + agregar HTTP crea dos formas de invocación (complejidad innecesaria) y no resuelve la dependencia de Redis. |

## Project Structure

### Documentation (this feature)

```text
specs/006-scraper-microservicio-http/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — entities and relationships
├── quickstart.md        # Phase 1 — validation guide
├── contracts/
│   └── rest-api.md      # API contract specification
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
packages/scraper/
├── src/
│   ├── server.ts                    # Entry point — Hono HTTP server
│   ├── index.ts                     # Core scrape logic (refactored)
│   ├── browser.ts                   # Playwright context (modified)
│   ├── extractor.ts                 # Facebook DOM extraction (unchanged)
│   ├── routes/
│   │   ├── scrape.ts                # POST /scrape, GET /status/:id, GET /events/:id
│   │   ├── profiles.ts              # GET/POST/DELETE /profiles, GET /profiles/:name/check
│   │   ├── login.ts                 # POST /login, GET /login/:profile/status, POST /login/:profile/complete
│   │   └── health.ts                # GET /health, GET /ready
│   ├── services/
│   │   ├── scrape-runner.ts         # Wraps scrapeGroup with progress emission
│   │   ├── job-tracker.ts           # In-memory job state + SSE clients
│   │   ├── profile-manager.ts       # Profile CRUD + metadata + session check
│   │   └── login-manager.ts         # Launch Chrome in Xvfb for login
│   ├── middleware/
│   │   ├── auth.ts                  # x-api-key validation
│   │   └── error-handler.ts         # Consistent error responses with requestId
│   └── static/
│       └── dashboard.html           # htmx dashboard (served as static)
├── scripts/
│   └── entrypoint.sh                # Starts Xvfb + x11vnc + noVNC + Node
├── package.json                     # +hono, +zod, -bullmq, -ioredis
├── vitest.config.ts                 # Unchanged
└── tsconfig.json                    # Unchanged

docker/
├── Dockerfile.scraper               # Modified: +xvfb, +novnc, +entrypoint

docker-compose.yml                   # Modified: scraper ports + env + SCRAPER_API_KEY

apps/api/src/
├── features/scrape/
│   └── application/
│       └── scrape.service.ts        # Modified: calls scraper via HTTP con x-api-key header
└── infrastructure/
    └── queue/
        └── queue.service.ts         # Modified: solo aiQueue, sin scrapeQueue

apps/admin/src/
├── hooks/use-scrape.ts              # Modified: SSE progress subscription
├── lib/api.ts                       # Modified: triggerScrape URL
└── components/dashboard/
    └── scrape-controls.tsx          # Modified: real progress bar
```

**Structure Decision**: Se mantiene la estructura existente del monorepo. Los cambios principales son dentro de `packages/scraper/` (reescritura a HTTP server) y modificaciones puntuales en `apps/api/` y `apps/admin/` para integrarse con el scraper via HTTP.
