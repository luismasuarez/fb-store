# FB Store — Roadmap de Mejoras

> **Caso de uso**: Base de datos de casas en venta en La Habana, gestionada 100% desde la web.

**Versión**: 1.1 · **Última actualización**: 2026-07-18

---

## Visión General

Pasar de un sistema que requiere comandos CLI manuales a una plataforma web autónoma donde el usuario:

1. Abre el admin en el navegador
2. Ve el dashboard con estadísticas en vivo
3. Programa y dispara scrapes desde la UI
4. Corrige datos que la IA alucinó
5. Gestiona grupos de Facebook sin tocar archivos de configuración

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| Package manager | pnpm | `10.33.2` |
| Monorepo tool | Turborepo | `^2.0.0` |
| API Framework | NestJS + Fastify | `11.1.24` + `5.8.5` |
| ORM | Prisma + adapter-pg | `7.8.0` |
| Base de datos | PostgreSQL | `18` (alpine) |
| Cache / Queue | Redis + BullMQ | `7` (alpine) + `5.77.3` |
| Validación | Zod | `4.4.3` |
| Scraper | Playwright (Chromium) | `1.60` |
| AI Provider | OpenRouter (multi-model) | API `chat/completions` |
| Admin Frontend | Vite + React + shadcn/ui + Tailwind | Vite `8.0.14`, React `19.2.6`, Tailwind `4` |
| Lenguaje | TypeScript | `6.0.3` |
| Runtime | Node.js | `>=22.13.0` |
| Infraestructura | Docker Compose | Última |

---

## Flujo de Datos

```
FACEBOOK GROUP
      │
      ▼  (1) Playwright headless con perfil persistente
┌──────────────┐
│   SCRAPER    │  packages/scraper/ — navega al grupo, hace scroll,
│  (BullMQ     │  extrae posts del DOM, descarga imágenes
│   Worker)    │
└──────┬───────┘
       │  (2) Guarda en raw_posts con processed=false
       ▼
┌──────────────┐
│  RAW_POSTS   │  Tabla PostgreSQL
│  (pendientes)│
└──────┬───────┘
       │  (3) Pipeline automático: al terminar scrape,
       │     se encola job "ai-process"
       ▼
┌──────────────┐
│ AI PROCESSOR │  packages/ai-processor/ — toma raw_posts,
│  (BullMQ     │  limpia texto, envía a OpenRouter, mapea
│   Worker)    │  respuesta JSON a modelo Listing
└──────┬───────┘
       │  (4) Crea/actualiza listing, marca raw_post.processed=true
       ▼
┌──────────────┐
│   LISTINGS   │  Tabla PostgreSQL — datos estructurados
│              │  (título, precio, ubicación, habitaciones, etc.)
└──────┬───────┘
       │  (5) API REST con filtros, paginación, ordenamiento
       ▼
┌──────────────┐
│  API NestJS  │  apps/api/ — GET /api/listings, GET /api/listings/:id
│  + Fastify   │  Sirve también el SPA del admin
└──────┬───────┘
       │  (6) React Query + axios
       ▼
┌──────────────┐
│ ADMIN SPA    │  apps/admin/ — Dashboard, Listings, Grupos,
│  (React 19)  │  Raw Posts, Historial, Login, Edición
└──────────────┘
       │
       ▼
┌──────────────────┐
│   USUARIO FINAL  │  Ve propiedades en venta con fotos, precios,
│                  │  ubicación, contacto. Gestiona todo desde el web.
└──────────────────┘
```

**Pipeline automático**: Una vez implementado P1.1, el flujo `scrape → AI → listing visible` es continuo sin intervención manual. El scheduler (P1.2) dispara scrapes periódicos.

---

## UX del Producto Final

Pantallas del admin SPA cuando el roadmap esté completo:

| Pantalla | Ruta | Funcionalidad |
|---|---|---|
| **Login** | `/login` | Formulario email + password, JWT storage, redirect post-login |
| **Dashboard** | `/` | Stats (total listings, en venta, en alquiler, La Habana). Botones "Scrapear ahora" y "Procesar IA" con feedback. Último scrape. |
| **Listings** | `/listings` | Grid/table toggle. Filtros: tipo, propiedad, provincia, precio, habitaciones, baños, búsqueda. Paginación. |
| **Listing Detail** | `/listings/:id` | Galería de imágenes, datos de propiedad, ubicación, contacto, AI summary. Botón "Editar". |
| **Grupos** | `/groups` | CRUD de grupos Facebook. Activar/desactivar. Crear/editar con modal. |
| **Raw Posts** | `/raw-posts` | Tabla de posts crudos con filtro por estado (pending/processed/skipped). Procesar individualmente. |
| **Historial** | `/scrape-logs` | Logs de cada ejecución: fecha, grupo, posts encontrados/nuevos/errores, duración. |
| **Configuración** | `/schedule` | Programación del scraper: intervalo, ventana horaria, enabled/disabled. |

**Sidebar de navegación**: Dashboard, Listings, Grupos, Posts Crudos, Historial.

---

## No-Goals (explícitamente fuera de alcance)

| Aspecto | Decisión | Razón |
|---------|----------|-------|
| App móvil (Expo) | No se construye | Postergado post-MVP. El admin web cubre la gestión. |
| Multi-usuario / roles | No se implementa | Un solo admin operando el sistema. |
| Sitio público | No se construye | Los listings no se exponen al público general. |
| Pasarela de pagos | No aplica | FB Store es un agregador, no una plataforma de transacciones. |
| Multi-idioma | No aplica | Contenido target: Cuba, español. |
| Notificaciones push | No se implementa | Fuera del MVP actual. |
| WebSockets / real-time | No se implementa | React Query polling es suficiente. |
| CDN / Cloud storage | No se implementa | Almacenamiento local en disco vía Docker volumes es suficiente para la escala actual. |
| CI/CD | No se configura | Despliegue manual con Docker Compose. |
| Tests E2E | Prioridad baja | Tests unitarios + integración son prioridad. |

---

## Criterios de Éxito Generales

Estos criterios definen cuándo el sistema cumple su objetivo como producto, más allá de tareas individuales:

1. **Zero CLI**: El usuario puede operar el sistema completo (scrapear, procesar, editar, programar) sin abrir una terminal.
2. **Autonomía 7 días**: El scraper corre automáticamente según la programación sin intervención manual durante al menos 7 días consecutivos.
3. **Latencia < 30 min**: Un post publicado en Facebook aparece como listing estructurado en el admin en menos de 30 minutos (scrape + AI processing).
4. **Sin pérdida de datos**: Si el AI processor falla (timeout, rate limit, error del provider), el raw_post queda marcado como pendiente y se reintenta en el próximo ciclo.
5. **Recuperación automática**: Si Redis o PostgreSQL se reinician, los workers se reconectan y continúan procesando sin pérdida de jobs.
6. **Precisión IA > 80%**: El precio, ubicación y tipo de propiedad extraídos por la IA son correctos más del 80% de las veces (verificable vía correcciones manuales).
7. **Auth funcional**: Endpoints sensibles (scrape, AI process, schedule, groups CRUD) requieren autenticación. Listings GET es público.
8. **Docker compose up**: El stack completo se levanta con un solo comando (`docker compose up --build -d`) sin pasos adicionales.

---

## Arquitectura Objetivo de la API

Basada en el análisis de `portal_cloud/apps/api` y adaptada al stack de FB Store (Fastify + Zod + BullMQ).

### Principios

- **Feature-based modules** con capas internas: `api/` (controllers/DTOs) → `application/` (servicios/use-cases) → `infrastructure/` (repositories)
- **Repository pattern** en todas las features — nunca inyectar `PrismaService` directamente en servicios de negocio
- **Zod como fuente de verdad única** para validación + tipos (sin `class-validator`)
- **BullMQ para todo trabajo asíncrono** — scraping, AI processing, schedulers
- **Error handling categorizado** con `requestId` de correlación
- **Auth JWT dual** (access + refresh con rotación) inspirado en portal_cloud

### Estructura

```
apps/api/src/
├── main.ts                           # Bootstrap: Fastify, Swagger, Helmet, CORS, validación startup
├── app.module.ts                     # Compone módulos infra + features
│
├── core/                             # Cross-cutting
│   ├── filters/
│   │   └── http-exception.filter.ts  # @Catch() global: categoriza, requestId, nunca expone stack
│   ├── interceptors/
│   │   └── request-id.interceptor.ts # Asigna x-request-id, logea duración, métricas de rechazo
│   └── pipes/
│       └── zod-validation.pipe.ts    # ValidationPipe basado en Zod 4 (reemplaza el actual)
│
├── infrastructure/                   # Adaptadores técnicos
│   ├── config/
│   │   ├── app-config.module.ts      # @Global()
│   │   └── app-config.service.ts     # Wrapper tipado sobre ConfigService con validación startup
│   ├── database/
│   │   └── prisma/
│   │       ├── prisma.module.ts      # @Global()
│   │       └── prisma.service.ts     # Extiende PrismaClient + lifecycle (OnModuleInit/OnModuleDestroy)
│   └── queue/
│       ├── queue.module.ts           # BullMQ módulo global
│       └── queue.service.ts          # Wrapper para encolar jobs scrape/ai-process
│
├── common/                           # Compartido intra-API
│   └── dto/
│       ├── pagination.schema.ts      # Schema Zod de paginación reutilizable
│       └── api-response.ts           # Envelope { data, pagination }
│
└── features/
    ├── auth/                         # P1.3
    │   ├── auth.module.ts
    │   ├── api/
    │   │   ├── auth.controller.ts    # POST /api/auth/login, POST /api/auth/refresh
    │   │   └── dto/
    │   ├── application/
    │   │   └── auth.service.ts       # JWT issuance, refresh rotation, scrypt hashing
    │   └── infrastructure/
    │       └── auth-session.repository.ts
    │
    ├── listings/                     # Ya existe, migrar a repository + editor
    │   ├── listings.module.ts
    │   ├── api/
    │   │   ├── listings.controller.ts
    │   │   └── dto/
    │   ├── application/
    │   │   ├── listings.service.ts        # Queries + filtros complejos
    │   │   └── listing-editor.service.ts  # P2.4: PUT /api/listings/:id
    │   └── infrastructure/
    │       └── listing.repository.ts
    │
    ├── groups/                       # P2.2
    │   ├── groups.module.ts
    │   ├── api/
    │   │   ├── groups.controller.ts  # CRUD /api/groups
    │   │   └── dto/
    │   ├── application/
    │   │   └── groups.service.ts
    │   └── infrastructure/
    │       └── group.repository.ts
    │
    ├── scrape/                       # Ya existe, migrar a async
    │   ├── scrape.module.ts
    │   ├── api/
    │   │   ├── scrape.controller.ts      # POST /api/scrape (encola job, no fork)
    │   │   └── scrape-status.controller.ts  # GET /api/scrape/status/:jobId
    │   ├── application/
    │   │   ├── scrape.service.ts         # Encola en BullMQ
    │   │   └── scrape-scheduler.service.ts  # P1.2: CRON configurable
    │   └── infrastructure/
    │       └── scrape-log.repository.ts  # P2.5: ScrapeLog CRUD
    │
    ├── ai-processor/                 # Ya existe, migrar a async
    │   ├── ai-processor.module.ts
    │   ├── api/
    │   │   └── ai-processor.controller.ts  # POST /api/ai-process (encola job)
    │   └── application/
    │       └── ai-processor.service.ts
    │
    ├── raw-posts/                    # P2.3: expandir
    │   ├── raw-posts.module.ts
    │   ├── api/
    │   │   ├── raw-posts.controller.ts
    │   │   └── dto/
    │   └── application/
    │       └── raw-posts.service.ts
    │
    ├── scheduler/                    # P1.2
    │   ├── scheduler.module.ts
    │   ├── api/
    │   │   └── scheduler.controller.ts  # GET/PUT /api/schedule
    │   └── application/
    │       └── scheduler.service.ts     # BullMQ repeatable jobs
    │
    └── health/                       # Ya existe
        └── health.controller.ts      # GET /api/health
```

### Comparación Estado Actual → Objetivo

| Aspecto | Hoy (FB Store) | Objetivo |
|---------|----------------|----------|
| Validación | Zod schemas sueltos, sin pipe global | `ZodValidationPipe` global con `whitelist` + `transform` |
| Error handling | Excepciones NestJS crudas | Filtro global categorizado (validation/auth/rate_limit/business) + requestId |
| Auth | Sin autenticación | JWT dual (access + refresh) con rotación de sesiones |
| DB Access | Prisma directo en servicios | Repository pattern en todas las features |
| Scraping/AI | `child_process.fork()` bloqueante | BullMQ workers asíncronos con pipeline automático |
| Scheduler | No existe | Repeatable jobs configurables desde API + UI |
| Grupos | Solo en env var `FB_GROUPS` | CRUD completo con tabla `groups` |
| Listings | Solo GET | GET + PUT (edición manual con trazabilidad) |
| Config | `process.env` directo | `AppConfigService` tipado con validación al arranque |
| Trazabilidad | Ninguna | RequestIdInterceptor + métricas de rechazo |
| Response | JSON plano | Envelope `{ data, pagination }` consistente |

---

## Priorización

| Fase | Enfoque | Impacto | Esfuerzo |
|------|---------|---------|----------|
| **P1** | Automatización del pipeline + Auth | Sin esto el sistema no escala ni es profesional | 3-4 días |
| **P2** | Gestión completa desde la web | El usuario deja de usar la terminal | 3-4 días |
| **P3** | Calidad de dato + pulido | Datos más precisos, UX refinada | 2-3 días |

---

## P1 — Automatización del Pipeline + Auth

### P1.1 — BullMQ Job Queue: Scraper + AI Processor como Workers

**Problema**: Scraper y AI Processor se ejecutan como scripts CLI síncronos. `POST /api/scrape` y `POST /api/ai-process` bloquean la respuesta HTTP hasta que el child process termina. No hay pipeline automático (scrape → AI).

**Solución**: Implementar BullMQ con Redis:

```
POST /api/scrape  →  Queue "scrape"   →  ScraperWorker (consume y guarda raw_posts)
                                        →  Al finalizar, encola Job en Queue "ai-process"
POST /api/ai-process  →  Queue "ai-process"  →  AIProcessorWorker (consume raw_posts → listings)
```

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `packages/scraper/src/index.ts` | Convertir de script CLI a worker BullMQ (`Worker` + `Job`) |
| `packages/scraper/src/index.ts` | Al finalizar cada job de scrape, encolar job en cola `ai-process` |
| `packages/ai-processor/src/index.ts` | Convertir de script CLI a worker BullMQ (`Worker` + `Job`) |
| `apps/api/src/scraper/scraper.controller.ts` | Cambiar de `fork()` a `queue.add('scrape', groupConfig)` |
| `apps/api/src/scraper/scraper.service.ts` | Inyectar `BullMQ Queue` en vez de `child_process.fork` |
| `apps/api/src/ai-processor/ai-processor.controller.ts` | Cambiar de `fork()` a `queue.add('ai-process', {})` |
| `apps/api/src/ai-processor/ai-processor.service.ts` | Inyectar `BullMQ Queue` |
| `apps/api/src/app.module.ts` | Importar `BullMQModule` con config de Redis |
| `docker-compose.yml` | Scraper y AI processor como servicios `command: ["node", "worker.js"]` con `restart: unless-stopped` |

**Acceptance Criteria**:

1. `POST /api/scrape` responde inmediatamente con `{ jobId }`
2. El scraper procesa en background y guarda en `raw_posts`
3. Al terminar, se encola automáticamente el AI processor
4. `POST /api/ai-process` responde inmediatamente con `{ jobId }`
5. El AI processor procesa en background y crea `listings`
6. Se puede consultar el estado del job via `GET /api/scrape/status/:jobId`

---

### P1.2 — Scheduler Automático (CRON)

**Problema**: No hay scraping periódico. El usuario debe disparar manualmente cada vez.

**Solución**: BullMQ `QueueScheduler` + `RepeatableJob` configurable.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `packages/shared/src/schemas/config.schema.ts` | Agregar schema `ScheduleConfig { intervalMinutes, hoursStart, hoursEnd, enabled }` |
| `apps/api/src/scheduler/scheduler.service.ts` | **Nuevo**: Servicio que configura `queue.add('scrape', {}, { repeat: { pattern: cronExpression } })` |
| `apps/api/src/scheduler/scheduler.module.ts` | **Nuevo**: Módulo del scheduler |
| `apps/api/src/app.module.ts` | Importar `SchedulerModule` |
| `apps/api/src/scheduler/scheduler.controller.ts` | **Nuevo**: `GET /api/schedule` (ver config), `PUT /api/schedule` (actualizar) |

**Acceptance Criteria**:

1. Por defecto, el scheduler corre cada 4 horas en horario 8:00-22:00
2. Se puede cambiar el intervalo desde API (y eventualmente desde UI)
3. El scheduler respeta la ventana horaria (no scrapea de madrugada)
4. Al iniciar la app, el scheduler se registra automáticamente

---

### P1.3 — Autenticación Básica

**Problema**: Todos los endpoints son públicos. Cualquiera puede triggerear scrapes y ver datos.

**Solución**: Auth básica con JWT + login en API. Proteger rutas del admin y endpoints sensibles.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/auth/auth.module.ts` | **Nuevo**: Módulo con JWT strategy |
| `apps/api/src/auth/auth.controller.ts` | **Nuevo**: `POST /api/auth/login` → devuelve JWT |
| `apps/api/src/auth/auth.guard.ts` | **Nuevo**: Guard que protege rutas |
| `apps/api/src/scraper/scraper.controller.ts` | Agregar `@UseGuards(AuthGuard)` |
| `apps/api/src/ai-processor/ai-processor.controller.ts` | Agregar `@UseGuards(AuthGuard)` |
| `apps/api/src/scheduler/scheduler.controller.ts` | Agregar `@UseGuards(AuthGuard)` |
| `apps/api/src/main.ts` | Agregar CORS para admin + cookie/header JWT config |
| `apps/admin/src/pages/login-page.tsx` | **Nuevo**: Pantalla de login |
| `apps/admin/src/lib/auth.ts` | **Nuevo**: Context/provider de auth con JWT storage |
| `apps/admin/src/App.tsx` | Agregar ruta `/login`, proteger rutas con `ProtectedRoute` |
| `apps/admin/src/components/layout/header.tsx` | Agregar botón de logout + indicador de sesión |

**Acceptance Criteria**:

1. `GET /api/listings` sigue siendo público (solo lectura)
2. `POST /api/scrape`, `POST /api/ai-process`, `PUT /api/schedule` requieren JWT
3. El admin redirige a `/login` si no hay token
4. El token expira y se refresca automáticamente

---

## P2 — Gestión Completa desde la Web

### P2.1 — Botones de Control en Dashboard

**Problema**: El dashboard actual muestra "Instrucciones" con comandos CLI. El usuario debe ir a la terminal.

**Solución**: Reemplazar la card de instrucciones con botones funcionales y feedback visual.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `apps/admin/src/lib/api.ts` | Agregar `triggerScrape()`, `triggerAiProcess()`, `getJobStatus()` |
| `apps/admin/src/pages/dashboard-page.tsx` | Reemplazar card de instrucciones con botones + estado del último scrape |
| `apps/admin/src/hooks/use-scrape.ts` | **Nuevo**: Hook `useTriggerScrape` con mutation + polling de estado |
| `apps/admin/src/components/dashboard/scrape-controls.tsx` | **Nuevo**: Componente con botones, spinner, último resultado |

**Acceptance Criteria**:

1. Botón "Scrapear ahora" → muestra spinner → feedback "Completado / Error"
2. Botón "Procesar con IA" → mismo patrón
3. Muestra la hora del último scrape exitoso
4. Si hay un job en progreso, deshabilita el botón

---

### P2.2 — Página de Gestión de Grupos

**Problema**: Los grupos de Facebook se configuran en `FB_GROUPS` env var. Sin CRUD en API ni UI.

**Solución**: Endpoints CRUD para `Group` + página en admin.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/groups/groups.controller.ts` | **Nuevo**: `GET/POST /api/groups`, `PUT/DELETE /api/groups/:id` |
| `apps/api/src/groups/groups.service.ts` | **Nuevo**: CRUD sobre modelo `Group` |
| `apps/api/src/groups/groups.module.ts` | **Nuevo**: Módulo de grupos |
| `apps/admin/src/lib/api.ts` | Agregar `fetchGroups()`, `createGroup()`, `updateGroup()`, `deleteGroup()` |
| `apps/admin/src/pages/groups-page.tsx` | **Nuevo**: Tabla de grupos + modal de crear/editar |
| `apps/admin/src/components/groups/group-form.tsx` | **Nuevo**: Formulario (id, name, url, maxPosts, isActive) |
| `apps/admin/src/App.tsx` | Agregar ruta `/groups` |
| `apps/admin/src/components/layout/sidebar.tsx` | Agregar link "Grupos" |

**Acceptance Criteria**:

1. Lista todos los grupos con su estado (activo/inactivo)
2. Crear grupo: form con id, nombre, url, maxPosts
3. Editar grupo: mismo form pre-poblado
4. Eliminar grupo: confirmación antes de borrar
5. Activar/desactivar toggle sin recargar página

---

### P2.3 — Página de Raw Posts

**Problema**: No hay forma de ver los posts crudos antes de que la IA los procese. El usuario no sabe qué datos están "pendientes".

**Solución**: Página con tabla de raw posts + filtros.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/raw-posts/raw-posts.controller.ts` | Agregar `status` filter (processed/pending/skipped), paginación completa |
| `apps/api/src/raw-posts/raw-posts.service.ts` | Agregar filtros por estado, groupId, fechas |
| `apps/admin/src/lib/api.ts` | Agregar `fetchRawPosts()` |
| `apps/admin/src/pages/raw-posts-page.tsx` | **Nuevo**: Tabla con columnas: fbPostId, grupo, fecha, status (pending/done/skipped) |
| `apps/admin/src/App.tsx` | Agregar ruta `/raw-posts` |
| `apps/admin/src/components/layout/sidebar.tsx` | Agregar link "Posts crudos" |

**Acceptance Criteria**:

1. Tabla paginada con todos los raw posts
2. Filtro por estado (pending / processed / skipped)
3. Filtro por grupo
4. Click en un row → ver el texto completo del post
5. Botón "Procesar ahora" para posts pendientes individuales

---

### P2.4 — Edición de Listings desde Admin

**Problema**: Los listings son de solo lectura. Si la IA alucinó un precio, ubicación o categoría, no hay forma de corregirlo.

**Solución**: Endpoint `PUT /api/listings/:id` + UI de edición inline.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/listings/listings.controller.ts` | Agregar `PUT /api/listings/:id` |
| `apps/api/src/listings/listings.service.ts` | Agregar `update(id, data)` |
| `apps/api/src/listings/listings.module.ts` | Asegurar que `PUT` esté habilitado |
| `apps/admin/src/lib/api.ts` | Agregar `updateListing(id, data)` |
| `apps/admin/src/pages/listing-page.tsx` | Agregar modo edición (toggle ver/editar) |
| `apps/admin/src/components/listings/listing-edit-form.tsx` | **Nuevo**: Formulario de edición (título, precio, moneda, tipo, provincia, municipio, barrio, habitaciones, baños, m², descripción, contacto, estado) |

**Acceptance Criteria**:

1. Botón "Editar" en la página de detalle del listing
2. Formulario con todos los campos editables
3. Validación básica (precio > 0, campos requeridos)
4. Guardar → actualiza sin recargar página
5. Indicador visual de "editado manualmente" (diferente de AI-generated)

---

### P2.5 — Historial de Scrapes

**Problema**: El modelo `ScrapeLog` existe pero nadie escribe ni lo consulta.

**Solución**: Escribir logs desde el scraper worker + endpoint + página en admin.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `packages/scraper/src/index.ts` | Al finalizar cada grupo, crear `ScrapeLog` con métricas |
| `apps/api/src/scraper-logs/scraper-logs.controller.ts` | **Nuevo**: `GET /api/scrape/logs` con paginación y filtros |
| `apps/api/src/scraper-logs/scraper-logs.service.ts` | **Nuevo**: Query sobre `ScrapeLog` |
| `apps/api/src/scraper-logs/scraper-logs.module.ts` | **Nuevo**: Módulo |
| `apps/admin/src/lib/api.ts` | Agregar `fetchScrapeLogs()` |
| `apps/admin/src/pages/scrape-logs-page.tsx` | **Nuevo**: Tabla de historial (fecha, grupo, posts encontrados/nuevos/errores, duración) |
| `apps/admin/src/App.tsx` | Agregar ruta `/scrape-logs` |
| `apps/admin/src/components/layout/sidebar.tsx` | Agregar link "Historial" |

**Acceptance Criteria**:

1. Cada vez que el scraper procesa un grupo, se guarda un ScrapeLog
2. Tabla paginada con columnas: fecha, grupo, posts encontrados, nuevos, errores, duración
3. Filtro por grupo y rango de fechas
4. Los errores se muestran con badge rojo

---

## P3 — Calidad de Dato + Pulido

### P3.1 — Envío de Imágenes a la IA

**Problema**: El `OpenRouterProvider` ignora el parámetro `imageUrls`. La IA solo ve texto, pierde contexto visual crucial (fotos de la propiedad, estado, acabados).

**Solución**: Enviar URLs de imágenes al modelo multimodal (`gpt-4o-mini` lo soporta).

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `packages/shared/src/ai/openrouter.ts` | Modificar `extract()` para incluir imágenes en el payload `messages` como `content: [{ type: "text" }, { type: "image_url", image_url: { url } }]` |
| `packages/ai-processor/src/index.ts` | Pasar `imageUrls` desde `rawData.images` al `extractor.extract()` |

**Acceptance Criteria**:

1. Las imágenes del post se envían al modelo junto con el texto
2. La calidad del extraction mejora visiblemente (precios, ubicación, estado)
3. Timeout por request se ajusta para incluir el procesamiento de imágenes

---

### P3.2 — Almacenamiento Externo de Imágenes

**Problema**: Las imágenes se guardan como base64 en la columna `images` de `listings`. La DB se llena rápido, las queries son lentas.

**Solución**: Migrar a almacenamiento en disco local (o S3 compatible) dentro del contenedor Docker. Guardar URLs en vez de base64.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `packages/ai-processor/src/image-downloader.ts` | Guardar archivos en `/app/storage/images/` en vez de base64 en DB |
| `packages/ai-processor/src/db.ts` | Guardar `[{ url: "/storage/images/uuid.jpg", mime: "image/jpeg" }]` sin `data` |
| `apps/api/src/main.ts` | Servir `/storage/images/` como static files |
| `apps/admin/src/lib/api.ts` | `getImageUrl()` ahora apunta a `/storage/images/...` |
| `docker-compose.yml` | Agregar volumen `fb-store-images` para persistencia |
| `docker/Dockerfile.api` | Crear directorio `/app/storage/images` |
| `docker/Dockerfile.full` | Crear directorio `/app/storage/images` |
| `packages/scraper/src/index.ts` | Ya no descargar imágenes en el scraper (delegar al AI processor) |

**Acceptance Criteria**:

1. Las imágenes se sirven como archivos estáticos, no como base64 inline
2. El tamaño de la DB se reduce drásticamente
3. Las imágenes persisten entre reinicios del contenedor
4. Los listings existentes con base64 siguen funcionando (fallback)

---

### P3.3 — Feedback Loop para el Prompt de IA

**Problema**: Cuando el usuario corrige manualmente un listing, esa corrección se pierde. La IA sigue cometiendo los mismos errores.

**Solución**: Almacenar las correcciones manuales y usarlas como ejemplos few-shot en el prompt.

**Archivos a modificar**:

| Archivo | Cambio |
|---------|--------|
| `packages/shared/src/ai/registry.ts` | Agregar sección de `fewShotExamples` en el system prompt, construida desde correcciones previas |
| `packages/ai-processor/src/index.ts` | Consultar las últimas N correcciones manuales y pasarlas como ejemplos en el prompt |
| `packages/shared/src/ai/prompt.ts` | **Nuevo**: Template del prompt con sección de ejemplos dinámicos |

**Acceptance Criteria**:

1. Las correcciones manuales del usuario se registran en la DB
2. El prompt incluye ejemplos reales corregidos
3. La precisión de la IA mejora con el tiempo

---

### P3.4 — UX: Mejoras Visuales en Admin

| Mejora | Archivos |
|--------|----------|
| Modo oscuro toggle | `apps/admin/src/components/theme-toggle.tsx`, header |
| Image lightbox modal | `apps/admin/src/components/ui/image-lightbox.tsx`, listing detail |
| Estados de error en queries | `apps/admin/src/components/ui/error-state.tsx`, hooks existentes |
| Badge de "editado manualmente" | `apps/admin/src/pages/listing-page.tsx` |
| Paginación con saltos (ir a página N) | `apps/admin/src/components/listings/listing-pagination.tsx` |
| Skeleton loading más refinados | `apps/admin/src/components/ui/skeleton.tsx` |

**Acceptance Criteria**:

1. Toggle día/noche funcional con persistencia en localStorage
2. Click en imagen → lightbox modal con navegación
3. Mensajes de error amigables cuando falla la API
4. Indicador visual de listings editados vs AI-generated

---

## Resumen de Estimación

| Fase | Tarea | Esfuerzo estimado |
|------|-------|-------------------|
| **P1** | BullMQ Workers | 2 días |
| **P1** | Scheduler CRON | 0.5 días |
| **P1** | Autenticación JWT | 1 día |
| **P2** | Botones de control en dashboard | 0.5 días |
| **P2** | Gestión de grupos (CRUD + UI) | 1 día |
| **P2** | Raw posts page | 0.5 días |
| **P2** | Edición de listings | 1 día |
| **P2** | Historial de scrapes | 0.5 días |
| **P3** | Imágenes a la IA | 0.5 días |
| **P3** | Almacenamiento externo de imágenes | 1 día |
| **P3** | Feedback loop de IA | 0.5 días |
| **P3** | Mejoras UX | 1 día |
| **Total** | | **~10 días** |

## Orden Sugerido de Implementación

Cada tarea P1 y P2 es independiente y desplegable por sí sola. El orden recomendado:

```
P1.1 (BullMQ) ─► P1.2 (Scheduler) ─► P1.3 (Auth)
     │                                    │
     ▼                                    ▼
P2.1 (Botones) ─► P2.2 (Grupos) ─► P2.3 (Raw Posts)
     │                                    │
     ▼                                    ▼
P2.4 (Editar)  ─► P2.5 (Historial) ─► P3.1 (Imágenes IA)
     │
     ▼
P3.2 (Storage) ─► P3.3 (Feedback) ─► P3.4 (UX)
```
