# Feature Specification: Scraper como Microservicio HTTP Autónomo

**Feature Branch**: `007-scraper-microservicio`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Convertir el scraper de FB Store de un worker BullMQ pasivo a un microservicio HTTP autónomo, con API REST, dashboard de gestión de perfiles, login containerizado con VNC, y progreso en tiempo real vía SSE"

## Clarifications

### Session 2026-07-19

- Q: Debería tener autenticación la API del scraper? → A: Sí, API key via header `x-api-key`, configurable via env var `SCRAPER_API_KEY` en el container. Consistente con el patrón del API NestJS. Sin API key configurada, el scraper no arranca.
- Q: Estrategia de logging? → A: Console-only con formato JSON estructurado. Docker maneja la rotación y persistencia de logs.

## User Scenarios & Testing

### User Story 1 - Scrape via API HTTP (Priority: P1)

Como usuario del sistema (Admin UI o ente externo), quiero enviar una URL de grupo de Facebook a un endpoint HTTP y recibir los posts extraídos, para poder scrapear sin depender de una cola de mensajes ni del ecosistema NestJS.

**Why this priority**: Es el flujo principal de la feature. Sin esto, el scraper sigue siendo un worker pasivo no consultable, que es el problema central que esta spec resuelve.

**Independent Test**: Puede probarse completamente enviando `POST /api/v1/scrape` con una URL de grupo de Facebook y verificando que: (1) responde con un jobId si es async, (2) el scraper procesa y extrae posts, (3) los posts pueden consultarse via `GET /api/v1/scrape/:jobId`.

**Acceptance Scenarios**:

1. **Given** un grupo de Facebook con posts públicos, **When** el usuario hace `POST /api/v1/scrape { url: "https://facebook.com/groups/123" }`, **Then** la respuesta es inmediata con `{ jobId }` y status 202
2. **Given** un job de scrape en progreso, **When** el usuario consulta `GET /api/v1/scrape/:jobId`, **Then** recibe el estado actual del job (pending/running/completed/failed)
3. **Given** un scrape completado, **When** el usuario consulta el resultado, **Then** recibe los posts extraídos con texto, imágenes, autor y timestamp
4. **Given** un grupo registrado en la base de datos, **When** el usuario hace `POST /api/v1/scrape { groupId: "uuid" }`, **Then** el scraper usa la configuración del grupo (maxPosts, etc.) desde la DB

---

### User Story 2 - Progreso en Tiempo Real (Priority: P1)

Como usuario del Admin UI, quiero ver el progreso real del scraping mientras se ejecuta — fase actual, posts encontrados, imágenes descargadas — para saber qué está pasando y no quedarme con la incertidumbre de un spinner que dura milisegundos.

**Why this priority**: Es el principal pain point reportado por el usuario. El feedback falso actual ("completado" inmediato) hace que el sistema parezca roto o que no hace nada.

**Independent Test**: Puede probarse suscribiendo a `GET /api/v1/scrape/:jobId/events` con un cliente SSE y verificando que se reciben eventos de progreso durante la ejecución del scrape.

**Acceptance Scenarios**:

1. **Given** un scraper ejecutándose, **When** un cliente se suscribe al endpoint SSE del job, **Then** recibe eventos con la fase actual (navigating, scrolling, extracting, downloading, saving)
2. **Given** un scrape completado, **When** el SSE emite el evento complete, **Then** el cliente recibe el resultado final
3. **Given** un error durante el scrape, **When** ocurre, **Then** el SSE emite un evento error con el mensaje

---

### User Story 3 - Gestión de Perfiles (Priority: P2)

Como operador del scraper, quiero gestionar múltiples perfiles de Facebook (cuentas) desde una API y una interfaz web, para poder tener varias sesiones de login y verificar cuáles siguen activas sin tener que acceder al filesystem del contenedor.

**Why this priority**: Sin perfiles gestionables, el scraper depende de un solo perfil fijo, limitando su uso a una sola cuenta de Facebook y requiriendo acceso al filesystem para administrarlos.

**Independent Test**: Puede probarse creando un perfil via API, iniciando sesión, verificando su estado, y luego eliminándolo — todo sin tocar el contenedor directamente.

**Acceptance Scenarios**:

1. **Given** un scraper en funcionamiento, **When** el usuario lista perfiles via `GET /api/v1/profiles`, **Then** recibe la lista de perfiles disponibles con su estado
2. **Given** un perfil existente, **When** el usuario pide verificar su sesión, **Then** el scraper navega a Facebook y reporta si la sesión sigue activa o expiró
3. **Given** un perfil que ya no se necesita, **When** el usuario lo elimina, **Then** el directorio del perfil se borra del filesystem

---

### User Story 4 - Login Containerizado (Priority: P2)

Como operador del scraper, quiero iniciar sesión en Facebook desde el navegador web conectándome al contenedor via VNC, para que el perfil con la sesión quede guardado en un volumen Docker persistente sin necesidad de tener Chrome instalado localmente.

**Why this priority**: Actualmente el login requiere ejecutar un script local con display gráfico. En Docker no hay display, por lo que el login es imposible dentro del container. Esto bloquea el uso del scraper en producción.

**Independent Test**: Puede probarse iniciando el contenedor, abriendo la URL de VNC en un navegador, haciendo login en Facebook, cerrando Chrome, y verificando que el perfil persiste al reiniciar el contenedor.

**Acceptance Scenarios**:

1. **Given** un perfil sin sesión activa, **When** el operador solicita login via `POST /api/v1/login`, **Then** el scraper lanza Chromium en modo visible (Xvfb + noVNC) y devuelve la URL de VNC
2. **Given** Chromium abierto en el display virtual, **When** el operador se conecta via noVNC desde su navegador, **Then** ve la pantalla de Facebook y puede loguearse manualmente
3. **Given** el login completado y Chrome cerrado, **When** se verifica el perfil, **Then** la sesión de Facebook está activa y persistida en el volumen

---

### Edge Cases

- **Scraper se cierra abruptamente durante un scrape**: Los jobs en ejecución se pierden. El operador debe reintentar el scrape manualmente.
- **Dos requests de scrape simultáneos para el mismo perfil**: El scraper serializa los jobs por perfil. El segundo request espera a que termine el primero.
- **Perfil corrupto por crash de Chrome**: El entrypoint del contenedor debe limpiar archivos lock de Chrome al iniciar.
- **Sin conexión a Facebook**: El scraper debe reportar error claro indicando que no puede acceder a la URL del grupo.
- **Grupo sin posts nuevos**: El scraper completa exitosamente con 0 posts nuevos, sin errores.
- **URL de grupo inválida o inexistente**: El scraper debe detectar que la página no contiene un feed de grupo y reportar error.
- **Login expirado durante un scrape**: Si la sesión de Facebook expiró, el scraper falla con un mensaje indicando que debe re-loguéarse.
- **Múltiples perfiles en uso simultáneo**: Cada perfil puede tener un scrape en ejecución en paralelo (independiente).
- **Sin conexión a la base de datos en modo URL directa**: El scraper debe funcionar sin DB cuando se usa con URL directa. Solo falla si se usa groupId y no hay DB disponible.

## Requirements

### Functional Requirements

- **FR-001**: Scraper MUST expose an HTTP API with endpoints for scraping, profile management, login, and health check
- **FR-002**: Scraper MUST accept scrape requests via URL directa de Facebook sin depender de base de datos
- **FR-003**: Scraper MUST accept scrape requests via groupId (registrado en DB) para usar configuración persistida
- **FR-004**: Scraper MUST respond to scrape requests with a jobId and HTTP 202 when using async mode
- **FR-005**: Scraper MUST respond to scrape requests with the full result when using sync (wait) mode
- **FR-006**: Scraper MUST provide a status endpoint to query job state (pending/running/completed/failed)
- **FR-007**: Scraper MUST provide an SSE endpoint that streams real-time progress events during scraping
- **FR-008**: SSE events MUST include the current phase (navigating, scrolling, extracting, downloading, saving) and progress indicators
- **FR-009**: Scraper MUST support listing available profiles with metadata (name, creation date, last used, login status). Login status can be: unknown, alive (valid session), dead (session expired), or locked (Chrome in use).
- **FR-010**: Scraper MUST support creating new profile directories via API
- **FR-011**: Scraper MUST support deleting profiles via API
- **FR-012**: Scraper MUST support verifying if a profile's Facebook session is still valid by navigating to Facebook and checking for the feed
- **FR-013**: Scraper MUST support launching an interactive login session via Xvfb + noVNC for a given profile
- **FR-014**: Scraper MUST return a VNC URL that the operator can open in their browser to interact with the Facebook login page
- **FR-015**: Profile data MUST persist in a Docker volume so it survives container restarts
- **FR-016**: Scraper MUST expose a health check endpoint returning system status (uptime, profiles, Chrome availability, display status)
- **FR-017**: Scraper MUST NOT require Redis or BullMQ for operation (zero external messaging dependencies). Together with FR-018, this ensures the scraper can run as an independent service.
- **FR-018**: Scraper MUST work as a standalone microservice — no dependency on the NestJS API or any other service. See also FR-017 for messaging independence.
- **FR-019**: Scraper MUST clean Chrome lock files on startup to handle unclean shutdowns
- **FR-020**: Scraper MUST provide a web dashboard UI for managing profiles, initiating login, checking sessions, and running quick scrapes
- **FR-021**: Dashboard MUST be served as static files without requiring a JavaScript build step or framework compilation
- **FR-022**: Scraper container MUST expose two ports: HTTP API (default 3001) and noVNC web client (default 6080)
- **FR-023**: Scraper MUST require a valid API key in the `x-api-key` header on all requests except health/ready. The API key MUST be configurable via `SCRAPER_API_KEY` env var. If `SCRAPER_API_KEY` is not set, the scraper MUST fail to start.

### Key Entities

- **ScrapeJob**: Represents an asynchronous scraping task. Contains URL or groupId, profile to use, max posts. Tracks status through its lifecycle (pending → running → completed/failed). Stores progress events and final result.
- **Profile**: A directory containing a persistent Chromium browser profile (cookies, localStorage, sessions). Represents a logged-in Facebook account. Has metadata (name, created date, last used, login status).
- **ScrapeProgress**: Streaming events emitted during scraping. Contains phase name, current/total counts, and optional message. Consumed via SSE by clients.
- **FacebookSession**: A validated state of a profile indicating whether the Facebook login session is still active. Can be alive (feed visible), dead (redirected to login), or unknown (error during check).

## Success Criteria

### Measurable Outcomes

- **SC-001**: A scrape request via URL directa completes in under 2 minutes for a group with 20 posts
- **SC-002**: SSE events are received at least every 5 seconds during an active scrape, providing continuous progress feedback
- **SC-003**: Profile verification (session check) completes in under 15 seconds per profile
- **SC-004**: Login flow via noVNC completes with a persistent session saved to the Docker volume, surviving container restart
- **SC-005**: The scraper container starts and responds to health checks within 10 seconds
- **SC-006**: All API endpoints respond in under 500ms for non-scraping operations (status, profiles, health)
- **SC-007**: The scraper functions without Redis, BullMQ, or any messaging system — only the HTTP server is needed

## Assumptions

- The scraper container will have access to a Docker volume mounted at `/app/profiles` for profile persistence
- Facebook groups targeted are public or accessible with the logged-in account
- The operator has a valid Facebook account and can complete login manually via the VNC interface
- The existing `packages/scraper/src/index.ts` (scrapeGroup, savePosts, saveScrapeLog) will be reused with minimal changes
- The scraper will continue to use Playwright for browser automation and Prisma for optional DB access
- The NestJS API will be updated separately to call the scraper via HTTP instead of BullMQ (out of scope for this spec)
- The AI processor pipeline (scrape → raw posts → AI → listings) remains unchanged; this spec only transforms how the scraper is invoked
- Multiple profiles are independent — each stores its own browser session data and can be used concurrently
- Xvfb + x11vnc + noVNC can be installed in the Docker image (Alpine or Debian-based) without issues
- Logging strategy: console-only with structured JSON format. Docker handles log rotation and persistence.
