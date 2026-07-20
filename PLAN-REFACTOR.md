# Plan de Refactor: Unificar en Server Único (Hono)

## Objetivo

Eliminar NestJS, BullMQ, JWT y toda la complejidad alrededor del scraper. Unificar todo en un solo server Hono que sirva admin SPA, maneje grupos, scheduler, y procesamiento AI — todo con Prisma directo y API key auth.

---

## Fase 0: Preparación

### 0.1 — Crear estructura `server/`

```
fb-store/server/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── schemas.ts
│   ├── extractor.ts
│   ├── routes/
│   │   ├── scrape.ts
│   │   ├── groups.ts
│   │   ├── schedule.ts
│   │   ├── health.ts
│   │   └── static.ts
│   ├── services/
│   │   ├── job-tracker.ts
│   │   ├── scrape-runner.ts
│   │   ├── browser.ts
│   │   ├── scheduler.ts
│   │   ├── ai-processor.ts
│   │   ├── login-manager.ts
│   │   └── profile-manager.ts
│   └── middleware/
│       ├── auth.ts
│       └── error-handler.ts
├── prisma/
│   └── schema.prisma
├── admin/          # build del SPA (opcional, después)
├── tsconfig.json
└── package.json
```

### 0.2 — Migrar `package.json`

**Dependencias** (desde `packages/scraper/package.json` + `apps/api/package.json` + `packages/shared/package.json`):

```json
{
  "name": "@fb-store/server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.x",
    "hono": "^4.x",
    "@prisma/client": "^7.x",
    "playwright": "^1.60",
    "dotenv": "^17.x",
    "zod": "^4.x"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "typescript": "^6.x",
    "prisma": "^7.x",
    "@types/node": "^24.x"
  }
}
```

### 0.3 — Migrar `prisma/schema.prisma`

**Copiar** desde `packages/shared/prisma/schema.prisma` a `server/prisma/schema.prisma`. Ajustar `generator client` output a `../node_modules/@prisma/client`.

---

## Fase 1: Core — Copiar Módulos del Scraper

**Archivos que se copian SIN cambios** (misma lógica, mismo código):

| Origen | Destino |
|--------|---------|
| `packages/scraper/src/services/job-tracker.ts` | `server/src/services/job-tracker.ts` |
| `packages/scraper/src/services/browser.ts` | `server/src/services/browser.ts` |
| `packages/scraper/src/services/login-manager.ts` | `server/src/services/login-manager.ts` |
| `packages/scraper/src/services/profile-manager.ts` | `server/src/services/profile-manager.ts` |
| `packages/scraper/src/middleware/auth.ts` | `server/src/middleware/auth.ts` |
| `packages/scraper/src/middleware/error-handler.ts` | `server/src/middleware/error-handler.ts` |
| `packages/scraper/src/extractor.ts` | `server/src/extractor.ts` |
| `packages/scraper/src/schemas.ts` | `server/src/schemas.ts` |

**Archivos que se copian y fusionan**:

| Origen | Destino | Cambio |
|--------|---------|--------|
| `packages/scraper/src/services/scrape-runner.ts` | `server/src/services/scrape-runner.ts` | Fusionar funciones de `index.ts` (scrapeGroup, savePosts, saveScrapeLog) |
| `packages/scraper/src/index.ts` | `server/src/cli.ts` | Solo `main()` |
| `packages/scraper/src/routes/scrape.ts` | `server/src/routes/scrape.ts` | Cambiar `getPrismaClient()` → `getDb()` |

### 1.1 — Crear `server/src/db.ts`

```ts
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
```

Reemplaza `getPrismaClient()` de `@fb-store/shared`. Buscar y reemplazar en todos los archivos.

### 1.2 — Aislar funciones de `index.ts`

El `packages/scraper/src/index.ts` tiene 3 responsabilidades:
1. `scrapeGroup()` — función de scraping con Playwright
2. `savePosts()` — guardar posts en DB
3. `saveScrapeLog()` — guardar log
4. `main()` — CLI mode

Mover 1, 2, 3 a `server/src/services/scrape-runner.ts` (ya existe, fusionar). `main()` puede vivir en `server/src/cli.ts`. Eliminar dependencia circular entre `scrape-runner.ts` e `index.ts`.

---

## Fase 2: Routes — Lo que reemplaza a NestJS

### 2.1 — `server/src/routes/scrape.ts`

**Desde** `packages/scraper/src/routes/scrape.ts`. Cambios:

- `import { getPrismaClient } from "@fb-store/shared"` → `import { getDb } from "../db"`
- `import { streamSSE } from "hono/streaming"` → se queda igual
- Mantener: `POST /scrape`, `GET /scrape/:jobId`, `GET /scrape/:jobId/events`, `GET /scrape/active/:profile`

### 2.2 — `server/src/routes/groups.ts` (NUEVO)

Reemplaza a `GroupsModule` + `GroupsService` + `GroupRepository` de NestJS. CRUD directo con Prisma, sin capas de abstracción.

### 2.3 — `server/src/routes/schedule.ts` (NUEVO)

Reemplaza `SchedulerModule` + `SchedulerService` de NestJS. Endpoints `GET /schedule` y `PUT /schedule`.

### 2.4 — `server/src/routes/health.ts`

**Desde** `packages/scraper/src/routes/health.ts`. Sin cambios.

### 2.5 — `server/src/routes/static.ts` (NUEVO)

Sirve el build del admin SPA. `GET /` → `admin/index.html`, SPA fallback para SPA routing.

---

## Fase 3: Servicios Background

### 3.1 — `server/src/services/ai-processor.ts` (NUEVO)

Procesamiento de AI inline, sin BullMQ. Query posts no procesados, llama a OpenRouter, crea Listings. Se invoca desde `chainAfterScrape` o desde el scheduler.

### 3.2 — `server/src/services/scheduler.ts` (NUEVO)

Scheduler simple sin BullMQ, sin `@nestjs/schedule`:

- `setInterval` con intervalo configurable
- Flag `running` para evitar solapamiento
- Itera grupos activos, ejecuta scrape para cada uno
- Arranca/para via API `PUT /schedule`

---

## Fase 4: Entry Point Unificado

### 4.1 — `server/src/index.ts`

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import scrapeRoute from "./routes/scrape";
import groupsRoute from "./routes/groups";
import scheduleRoute from "./routes/schedule";
import healthRoute from "./routes/health";
import staticRoute from "./routes/static";
import { getScheduler } from "./services/scheduler";

const app = new Hono();

// Request ID
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

// API routes (protegidas con API key)
app.use("/api/*", authMiddleware);
app.route("/api", healthRoute);
app.route("/api", scrapeRoute);
app.route("/api", groupsRoute);
app.route("/api", scheduleRoute);

// Static files (SPA)
app.route("/", staticRoute);

// Error handler
app.onError(errorHandler);

// Start scheduler
getScheduler().start();

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3001 });
```

---

## Fase 5: Admin UI — Reconectar al Nuevo Server

### 5.1 — Actualizar `apps/admin/src/lib/api.ts`

- Cambiar `baseURL: "/api"` → Apuntar al server Hono (mismo dominio, puerto único)
- Eliminar el interceptor de auth JWT
- Eliminar el refresh token interceptor
- Simplificar a solo API key

### 5.2 — Simplificar `use-scrape.ts`

- Eliminar `getActiveScrapeJob` en mount
- SSE directo al scraper sin proxy
- Eliminar lógica de reconexión compleja

### 5.3 — Build del SPA

```bash
cd apps/admin && pnpm build && cp -r dist/ ../../server/admin/
```

---

## Lo que se elimina

| Componente | Reemplazo |
|---|---|
| NestJS (`apps/api/`) | Server Hono directo (sin DI, sin módulos) |
| `@nestjs/schedule` + cron | `setInterval` simple (30 líneas) |
| JWT + Passport + Login | API key (ya existe en scraper) |
| GroupsModule + repository pattern | Ruta Hono → Prisma directo |
| `@fb-store/shared` | Prisma schema + `db.ts` inline |
| BullMQ + Redis | Procesamiento inline + EventEmitter |
| Proxy SSE vía NestJS | SSE directo del scraper (sin auth guard) |
| Vite proxy | Server sirve admin/dist como estático |

---

## Resumen de Archivos por Fase

| Fase | Archivos | Acción |
|------|----------|--------|
| 0 | `server/package.json`, `server/tsconfig.json`, `server/prisma/schema.prisma` | Crear |
| 1 | `server/src/db.ts`, `server/src/services/*` (8 archivos) | Copiar + ajustar imports |
| 2 | `server/src/routes/scrape.ts`, `groups.ts`, `schedule.ts`, `health.ts`, `static.ts` | Migrar 1, crear 3 |
| 3 | `server/src/services/ai-processor.ts`, `scheduler.ts` | Crear |
| 4 | `server/src/index.ts` | Crear |
| 5 | `apps/admin/src/lib/api.ts`, `apps/admin/src/hooks/use-scrape.ts` | Simplificar |
