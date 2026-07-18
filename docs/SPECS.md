# FB Store — Desglose en Especificaciones

> **Propósito**: Dividir el roadmap en 4 especificaciones independientes, cada una con contexto completo, justificación, alcance y criterios de éxito. Cada spec es autocontenida, implementable con speckit, y deja un incremento funcional del producto.
>
> **Documento complementario**: [`ROADMAP.md`](./ROADMAP.md) contiene el detalle técnico (stack, arquitectura target, archivos a modificar, acceptance criteria por tarea).

---

## Contexto General

### Estado actual del producto

```
1. [CLI] pnpm setup:login  →  Login manual a Facebook (1 vez)
2. [CLI] pnpm scrape        →  Scraper headless extrae posts → raw_posts table
3. [CLI] pnpm ai:process    →  IA estructura los posts → listings table
4. [WEB]  Admin SPA         →  Ver listings con filtros, detalle, imágenes
```

Cada paso requiere comandos manuales. No hay automatización entre ellos. La API usa `child_process.fork()` (bloqueante), no hay auth, los errores se devuelven crudos, y no hay forma de gestionar grupos o corregir datos desde la web.

### ¿Qué se descubrió?

El análisis de `portal_cloud/apps/api` reveló patrones que este proyecto debe adoptar:

- Feature modules con capas internas (`api/` → `application/` → `infrastructure/`)
- Exception filter global con errores categorizados (validation, auth, rate_limit, business)
- Request ID interceptor para trazabilidad
- Repository pattern en vez de Prisma directo en servicios
- JWT dual (access + refresh) con rotación de sesiones
- Config service tipado con validación al startup

Y patrones que NO debe copiar:

- `class-validator`/`class-transformer` → usar Zod (ya lo tenemos)
- Express → Fastify (ya lo usamos)
- Sin job queue → BullMQ es crítico para nuestro caso

---

## Especificaciones

---

### Spec 001 — Fundación API + Pipeline Automático

| | |
|---|---|
| **Depende de** | N/A (primera spec) |
| **Tiempo estimado** | 3-4 días |
| **Riesgo** | Medio — toca la base de la API y ambos workers |

#### ¿Por qué existe esta spec?

Hoy el scraper y AI processor son scripts CLI que se ejecutan con `child_process.fork()` desde la API. Esto significa que `POST /api/scrape` y `POST /api/ai-process` **bloquean la respuesta HTTP** hasta que el proceso hijo termina (potencialmente minutos). Si el proceso crashea, el usuario nunca lo sabe — la petición HTTP muere con él.

Además, la API carece de infraestructura básica:

- No hay error handling consistente (las excepciones NestJS se devuelven crudas)
- No hay request tracing (imposible correlacionar errores en logs)
- El `process.env` se accede directamente sin validación ni tipado
- Las respuestas no tienen un envelope consistente
- Los servicios inyectan `PrismaService` directamente (acoplados al ORM, difíciles de testear)

Sin esta base, todo lo demás se construye sobre arena.

#### ¿Qué incluye?

**API — Core (`apps/api/src/core/`)**:

- `filters/http-exception.filter.ts` — `@Catch()` global que categoriza errores en `validation`, `authorization`, `rate_limit`, `business`. Incluye `requestId` en toda respuesta de error. Nunca expone stack traces.
- `interceptors/request-id.interceptor.ts` — Asigna `x-request-id` a toda request/response. Logea método, URL, controller, handler, duración, status code. Acumula métricas de rechazo por categoría.
- `pipes/zod-validation.pipe.ts` — ValidationPipe global que usa Zod 4 con `whitelist` + `transform`. Reemplaza el uso actual de Zod suelto en los controllers.

**API — Infrastructure (`apps/api/src/infrastructure/`)**:

- `config/app-config.service.ts` + `config/app-config.module.ts` — Wrapper tipado sobre `ConfigService` con `getString()`, `getNumber()`, `getBoolean()`, `getRequiredString()`, `validateRequired()`. Llamado en `main.ts` antes de `listen()` para fallar rápido si faltan env vars críticas.
- `database/prisma/prisma.service.ts` + `database/prisma/prisma.module.ts` — `@Global()` — Extiende `PrismaClient`, usa `@prisma/adapter-pg`, implementa `OnModuleInit`/`OnModuleDestroy`. Soporta `SKIP_DB_CONNECT` para tests.
- `queue/queue.module.ts` + `queue/queue.service.ts` — `@Global()` — Wrapper sobre BullMQ con colas `scrape` y `ai-process`. Expone `queue.add(jobName, data)` y `queue.getJob(jobId)`.

**API — Common (`apps/api/src/common/`)**:

- `dto/pagination.schema.ts` — Schema Zod reutilizable: `{ page, limit, total, totalPages }`
- `dto/api-response.ts` — Envelope `{ data, pagination }` para respuestas list paginadas

**Scraper (`packages/scraper/src/`)**:

- Convertir `index.ts` de CLI a BullMQ Worker
- Worker escucha en cola `scrape`, recibe `{ groupId, profileDir, maxPosts }`
- Al finalizar un grupo exitosamente, encola job en cola `ai-process`
- Escribe `ScrapeLog` con métricas (posts encontrados, nuevos, errores, duración)

**AI Processor (`packages/ai-processor/src/`)**:

- Convertir `index.ts` de CLI a BullMQ Worker
- Worker escucha en cola `ai-process`, recibe `{ rawPostIds[] }` o procesa todos los pendientes
- Sin cambios en la lógica de extracción ni en el mapper

**Scheduler (`apps/api/src/features/scheduler/`)**:

- Nuevo módulo con `SchedulerService` que configura un repeatable job en BullMQ
- Intervalo por defecto: cada 4 horas en ventana 8:00-22:00
- `GET /api/schedule` — ver config actual
- `PUT /api/schedule` — actualizar intervalo y ventana horaria

**Docker Compose**:

- Scraper y AI processor como servicios `command: ["node", "worker.js"]` con `restart: unless-stopped`
- Ambos dependen de `redis` (healthy) y `postgres` (healthy)
- Healthchecks para scraper y AI processor

**Migraciones**:

- Refactorizar `listings.controller.ts` y `raw-posts.controller.ts` para usar repository pattern y el nuevo envelope de respuesta
- Los endpoints existentes deben mantener compatibilidad hacia atrás

#### ¿Qué deja funcional?

- `POST /api/scrape` responde inmediatamente con `{ jobId }`. El scraper procesa en background. Al terminar, encola automáticamente el AI processor.
- `POST /api/ai-process` responde inmediatamente con `{ jobId }`. El AI processor procesa en background.
- `GET /api/scrape/status/:jobId` permite consultar el estado de un job.
- El scheduler corre automáticamente al iniciar la API (por defecto cada 4h).
- Toda respuesta tiene `requestId` y las list paginadas usan envelope `{ data, pagination }`.
- Los errores se devuelven categorizados con formato consistente.
- Si faltan env vars críticas (`DATABASE_URL`, `REDIS_URL`, etc.), la API falla al arrancar con un mensaje claro.

#### Lo que NO incluye (próximas specs)

- Autenticación (los endpoints siguen siendo públicos)
- UI más allá del dashboard estático actual
- Edición de listings
- Historial de scrapes (el modelo `ScrapeLog` se escribe pero no tiene endpoint aún — se expondrá en Spec 003)

---

### Spec 002 — Autenticación + Administración de Grupos

| | |
|---|---|
| **Depende de** | Spec 001 (usa el core infrastructure) |
| **Tiempo estimado** | 2 días |
| **Riesgo** | Bajo — patrones conocidos, pocos archivos nuevos |

#### ¿Por qué existe esta spec?

Hoy **cualquier persona** que acceda al admin puede disparar scrapes, procesar datos con IA (que cuesta dinero), y ver toda la información. No hay protección alguna.

Además, los grupos de Facebook que se scrapean se configuran únicamente en la variable de entorno `FB_GROUPS`. Si el usuario quiere añadir "Ventas La Habana" o "Alquileres Ciudad Habana", tiene que editar el `.env`, reiniciar el contenedor, y re-desplegar. En un producto profesional, esto debe hacerse desde la interfaz.

El dashboard actual muestra "Instrucciones" con comandos CLI — ironía pura para un producto cuyo objetivo es eliminar el uso de la terminal.

#### ¿Qué incluye?

**API — Auth (`apps/api/src/features/auth/`)**:

- `auth.module.ts` — Importa `PassportModule`, `JwtModule.registerAsync()`, `AppConfigModule`
- `api/auth.controller.ts` — `POST /api/auth/login` (público, rate-limited), `POST /api/auth/refresh` (público), `POST /api/auth/logout` (JWT)
- `api/dto/login.dto.ts` — Esquema Zod: `{ email, password }`
- `api/dto/auth-response.dto.ts` — `{ accessToken, refreshToken, expiresIn }`
- `application/auth.service.ts` — Password hashing con `scryptSync` + salt 16-bytes + `timingSafeEqual`. Issuance de JWT con `sub`, `typ`, `jti`. Refresh rotation (revoca sesión anterior, emite nuevo par).
- `application/token.service.ts` — Solo `hashToken()` para SHA-256 de refresh tokens
- `infrastructure/auth-session.repository.ts` — CRUD sobre tabla `auth_sessions`
- `api/jwt-auth.guard.ts` — Extiende `AuthGuard('jwt')`, adjunta `request.auth = { userId }`
- `strategies/jwt.strategy.ts` — PassportStrategy, extrae Bearer token, valida `typ === "access"`
- `strategies/refresh-jwt.strategy.ts` — PassportStrategy, extrae de `body.refreshToken`, valida `typ === "refresh"`

**API — Grupos (`apps/api/src/features/groups/`)**:

- `groups.module.ts`
- `api/groups.controller.ts` — `GET /api/groups` (público), `POST /api/groups`, `PUT /api/groups/:id`, `DELETE /api/groups/:id` (requieren JWT)
- `application/groups.service.ts`
- `infrastructure/group.repository.ts`
- `api/dto/create-group.dto.ts`, `api/dto/update-group.dto.ts`

**Protección de endpoints**:

- `POST /api/scrape` → requiere JWT
- `POST /api/ai-process` → requiere JWT
- `PUT /api/schedule` → requiere JWT
- `GET /api/listings` → público (solo lectura)
- `GET /api/groups` → público
- Mutaciones en grupos → requieren JWT

**Admin UI — Login**:

- `pages/login-page.tsx` — Formulario email + password, almacena JWT en memoria/localStorage
- `lib/auth.ts` — Context/provider de autenticación con token storage y refresh automático
- `App.tsx` — Ruta `/login`, `ProtectedRoute` wrapper para rutas protegidas
- `components/layout/header.tsx` — Botón de logout + indicador de sesión

**Admin UI — Dashboard**:

- Reemplazar la card de "Instrucciones" por `components/dashboard/scrape-controls.tsx`
- Botones "Scrapear ahora" y "Procesar con IA" con spinner, feedback de completado/error
- Muestra la hora del último scrape exitoso
- Deshabilita botones si hay un job en progreso (polling cada 5s)
- `hooks/use-scrape.ts` — `useMutation` + polling de estado

**Admin UI — Grupos**:

- `pages/groups-page.tsx` — Tabla con columnas: id, nombre, url, maxPosts, activo, última ejecución
- `components/groups/group-form.tsx` — Modal de crear/editar
- `lib/api.ts` — `fetchGroups()`, `createGroup()`, `updateGroup()`, `deleteGroup()`
- `App.tsx` — Ruta `/groups`, sidebar link

#### ¿Qué deja funcional?

- Login seguro con JWT dual + refresh rotation
- Endpoints de scrape/AI protegidos (ya no cualquiera puede dispararlos)
- Grupos gestionables desde el web (crear, editar, activar/desactivar, eliminar) sin tocar `.env`
- Dashboard con controles funcionales — zero CLI necesario para operación diaria
- Logout y expiración de sesión

#### Lo que NO incluye

- Edición de listings (spec 003)
- Raw posts page (spec 003)
- Historial de scrapes (spec 003)

**Modelo de datos nuevo** (migración Prisma):

```prisma
model AuthSession {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("auth_sessions")
}
```

---

### Spec 003 — Gestión de Listings

| | |
|---|---|
| **Depende de** | Spec 002 (usa auth y la base de API) |
| **Tiempo estimado** | 2-3 días |
| **Riesgo** | Medio — toca el core de datos y requiere coordinación API+UI |

#### ¿Por qué existe esta spec?

El usuario hoy puede scrapear y ver listings, pero:

- **No sabe qué posts están pendientes** de procesar por la IA. Los raw posts son invisibles en la UI.
- **No puede corregir los datos** que la IA alucinó. Si el precio, la ubicación o el tipo de propiedad son incorrectos, no hay forma de arreglarlos.
- **No hay historial** de cuándo se scrapeó cada grupo, cuántos posts se encontraron, cuántos fallaron. Si algo sale mal, no hay manera de diagnosticarlo.
- **Sin trazabilidad** entre el dato original (raw post) y el dato estructurado (listing).

Sin estas capacidades, el producto es una caja negra: entra data, sale data, pero el usuario no tiene control ni visibilidad.

#### ¿Qué incluye?

**API — Listings (`apps/api/src/features/listings/`)**:

- Migrar listings a repository pattern (crear `listing.repository.ts`)
- Agregar `PUT /api/listings/:id` en `listings.controller.ts`
- Crear `listing-editor.service.ts` — valúa datos, actualiza listing, registra la edición manual (campo `manuallyEdited: true` o similar en metadata)

**API — Raw Posts (`apps/api/src/features/raw-posts/`)**:

- Migrar raw-posts a repository pattern
- Endpoint `GET /api/raw-posts` con filtros: `status` (pending/processed/skipped), `groupId`, `scrapedAt[gte]`, `scrapedAt[lte]`
- Endpoint `POST /api/raw-posts/:id/process` — encola un job `ai-process` para un raw post específico

**API — Scrape Logs (`apps/api/src/features/scrape-logs/`)**:

- Nuevo módulo `scrape-logs/`
- `GET /api/scrape/logs` con paginación y filtros: `groupId`, `startedAt[gte]`, `startedAt[lte]`

**Admin UI — Raw Posts**:

- `pages/raw-posts-page.tsx` — Tabla: fbPostId, grupo, fecha, status (badge colored)
- Filtros: estado, grupo, rango de fechas
- Click → modal con texto completo del post
- Botón "Procesar" para posts pendientes individuales

**Admin UI — Editar Listing**:

- `components/listings/listing-edit-form.tsx` — Formulario completo: título, precio, moneda, tipo de operación (venta/alquiler/permuta), tipo de propiedad, provincia, municipio, barrio, habitaciones, baños, m², pisos, parqueo, amueblado, descripción, contacto
- Toggle "Ver / Editar" en la página de detalle
- Guardado optimista con React Query

**Admin UI — Historial**:

- `pages/scrape-logs-page.tsx` — Tabla: fecha, grupo, posts encontrados/nuevos/errores, duración, error (si aplica)
- Filtros: grupo, rango de fechas
- Badge rojo si hubo error

**Admin UI — Sidebar**:

- Agregar links: "Posts Crudos", "Historial"

#### ¿Qué deja funcional?

- Ciclo completo de vida del dato gestionado desde el web:
  1. Ver qué posts están pendientes de procesar (raw posts page)
  2. Procesar individualmente si es necesario
  3. Ver los listings estructurados (ya existía)
  4. Corregir datos incorrectos (editar listing)
  5. Auditar qué pasó en cada scrape (historial)
- Trazabilidad: cada listing sabe si fue generado por IA o editado manualmente

#### Lo que NO incluye

- IA con visión (spec 004)
- Almacenamiento externo de imágenes (spec 004)
- Feedback loop de IA (spec 004)

---

### Spec 004 — Calidad de Dato + Pulido Final

| | |
|---|---|
| **Depende de** | Spec 003 (necesita listings editables para el feedback loop) |
| **Tiempo estimado** | 2-3 días |
| **Riesgo** | Bajo — cambios localizados, sin impacto en la arquitectura |

#### ¿Por qué existe esta spec?

Tres problemas de calidad que impactan directamente la utilidad del producto:

1. **La IA solo ve texto**. Las fotos de la propiedad (estado, acabados, vista) son información clave que el modelo nunca recibe. Un precio escrito a mano en una pizarra, una placa de "Se Vende" con número de teléfono — el texto del post rara vez incluye esto, pero las fotos sí.

2. **Las imágenes se guardan como base64 en PostgreSQL**. Cada listing puede tener 5-10 fotos. Una foto de 2MB en base64 son ~2.6MB en la DB. Con 1000 listings, son ~20GB en la tabla `listings` — la DB se llena, las queries se vuelven lentas, los backups pesan. Las imágenes deben ir al disco (o CDN), la DB solo guarda rutas.

3. **La IA comete errores que se repiten**. El usuario corrige un precio mal interpretado, pero la próxima vez la IA vuelve a fallar igual. Sin un feedback loop, el modelo no mejora. Con pocos ejemplos (few-shot), el prompt se puede auto-mejorar con las correcciones que el usuario ya hizo.

#### ¿Qué incluye?

**IA con Visión (`packages/shared/src/ai/openrouter.ts`)**:

- Modificar `extract()` para enviar imágenes al modelo como `content: [{ type: "text" }, { type: "image_url", image_url: { url } }]`
- Limitar a las primeras 3-4 imágenes (por costo y contexto)
- Ajustar timeout (las imágenes tardan más en procesarse)

**Almacenamiento Externo de Imágenes (`packages/ai-processor/src/`)**:

- `image-downloader.ts` — Guardar en `/app/storage/images/{uuid}.{ext}` en vez de base64 en DB
- `db.ts` — Guardar `[{ url: "/storage/images/uuid.jpg", mime: "image/jpeg" }]` sin campo `data`
- `apps/api/src/main.ts` — Servir `/storage/images/` como static files con `@fastify/static`
- `apps/admin/src/lib/api.ts` — `getImageUrl()` apunta a URL estática en vez de data URI
- `docker-compose.yml` — Volumen `fb-store-images`
- Fallback: listings existentes con base64 siguen funcionando

**Feedback Loop (`packages/shared/src/ai/`)**:

- Al editar un listing manualmente, guardar un registro de corrección en nueva tabla `ai_corrections`
- `packages/ai-processor/src/index.ts` — Antes de llamar al provider, consultar las últimas N correcciones y pasarlas como ejemplos few-shot en el prompt
- `packages/shared/src/ai/registry.ts` — Modificar el system prompt para incluir sección dinámica de ejemplos
- La precisión de la IA debe mejorar visiblemente con el tiempo

**UX Refinada (`apps/admin/src/`)**:

- `components/theme-toggle.tsx` — Modo oscuro/claro con persistencia en localStorage
- `components/ui/image-lightbox.tsx` — Click en imagen → modal con navegación entre fotos
- `components/ui/error-state.tsx` — Mensajes amigables cuando falla la API
- Badge "Editado manualmente" en listing detail
- Paginación con salto a página N
- Skeletons más refinados en cards y tabla

#### ¿Qué deja funcional?

- La IA ve las fotos de las propiedades → mejor precisión en precio, ubicación y tipo
- Las imágenes se sirven como archivos estáticos → DB más liviana, queries más rápidas
- La IA mejora con el tiempo: las correcciones del usuario entrenan al modelo vía few-shot
- Experiencia visual refinada: modo oscuro, lightbox, estados de error, paginación completa

---

## Resumen

| Spec | ¿Por qué existe? | ¿Qué deja funcional? | Días |
|------|-----------------|----------------------|------|
| **001** | Sin pipeline automático ni infraestructura base | API robusta + scraping/AI en background + scheduler | 3-4 |
| **002** | Sin auth no es profesional; grupos solo en env var | Admin seguro + grupos desde web + dashboard con controles | 2 |
| **003** | Datos no editables, raw posts invisibles, sin historial | Ciclo completo: ver pendientes → procesar → corregir → auditar | 2-3 |
| **004** | IA sin visión, imágenes en DB, errores se repiten | Datos precisos, IA que mejora, UX refinada | 2-3 |
| | | **Total** | **~10 días** |

### Orden de implementación

```
Spec 001 (Fundación + Pipeline)
    │
    ▼
Spec 002 (Auth + Grupos)
    │
    ▼
Spec 003 (Gestión de Listings)
    │
    ▼
Spec 004 (Calidad + UX)
```

Cada spec es un incremento funcional que se puede desplegar y usar independientemente.
