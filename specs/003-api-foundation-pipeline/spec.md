# Feature Specification: Fundación API + Pipeline Automático

**Feature Branch**: `003-api-foundation-pipeline`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Spec 001 — Fundación API + Pipeline Automático. Convertir scraper y AI processor de CLI scripts a workers BullMQ asíncronos, agregar infraestructura base de API (error handling, request tracing, validación global, config service, Prisma module, queue module), scheduler automático, y Docker Compose para workers."

## Clarifications

### Session 2026-07-18

- Q: What authentication mechanism should the API use? → A: API Key via `x-api-key` header, validated by a NestJS guard.
- Q: What retry strategy for failed AI processor jobs? → A: Exponential backoff (2^n minutes), 3 retries max, then dead letter queue.
- Q: What is explicitly out of scope? → A: Web UI/dashboard, multi-user/roles, email/SMS notifications, Kubernetes/cloud orchestration, user registration, data import/export beyond API envelope.

## User Scenarios & Testing

### User Story 1 - Scrape y Procesamiento Automático (Priority: P1)

Como administrador del sistema, quiero disparar un scrape desde la API y recibir una confirmación inmediata, mientras el scraper procesa en segundo plano y al terminar encadena automáticamente el procesamiento con IA, para no tener que esperar ni ejecutar comandos manuales.

**Why this priority**: Es el flujo principal del producto. Sin esto, el sistema sigue requiriendo intervención manual para cada paso, que es el problema central que esta spec resuelve.

**Independent Test**: Puede probarse completamente disparando `POST /api/scrape` y verificando que: (1) responde inmediatamente con un jobId, (2) el scraper procesa y guarda raw_posts, (3) el AI processor se ejecuta automáticamente y crea listings, (4) el estado del job puede consultarse vía `GET /api/scrape/status/:jobId`.

**Acceptance Scenarios**:

1. **Given** un grupo configurado, **When** el usuario hace `POST /api/scrape`, **Then** la respuesta es inmediata con `{ jobId }` y status 202
2. **Given** un job de scrape en progreso, **When** el usuario consulta `GET /api/scrape/status/:jobId`, **Then** recibe el estado actual del job (waiting/active/completed/failed)
3. **Given** un scrape completado exitosamente, **When** el scraper termina de guardar raw_posts, **Then** el scraper encola automáticamente un job en la cola `ai-process`
4. **Given** un job de ai-process completado, **When** el worker termina de procesar, **Then** los listings correspondientes existen en la base de datos
5. **Given** el sistema funcionando, **When** se hace `POST /api/ai-process`, **Then** la respuesta es inmediata con `{ jobId }` y status 202

---

### User Story 2 - Programación Automática de Scrapes (Priority: P2)

Como administrador del sistema, quiero que el scraper se ejecute automáticamente según un horario configurable, para no tener que disparar scrapes manualmente cada vez.

**Why this priority**: La automatización completa requiere que el sistema opere sin intervención. Sin scheduler, el usuario aún debe disparar scrapes periódicamente.

**Independent Test**: Puede probarse configurando un intervalo corto (ej: cada 5 minutos) y verificando que los scrapes se ejecutan automáticamente respetando la ventana horaria configurada.

**Acceptance Scenarios**:

1. **Given** la API iniciada, **When** el scheduler se registra automáticamente, **Then** existe un repeatable job configurado con el intervalo por defecto (4 horas, ventana 8:00-22:00)
2. **Given** el scheduler activo, **When** el usuario consulta `GET /api/schedule`, **Then** recibe la configuración actual (intervalo, ventana horaria, enabled)
3. **Given** una configuración existente, **When** el usuario actualiza vía `PUT /api/schedule`, **Then** el scheduler se reconfigura con los nuevos valores
4. **Given** el scheduler activo fuera de la ventana horaria, **When** llega la hora de ejecución, **Then** el job se salta hasta la próxima ventana

---

### User Story 3 - Consistencia y Trazabilidad en la API (Priority: P0 — Foundation)

> ⚠️ **Prerrequisito de infraestructura**: Esta historia describe la base técnica (error handling, request tracing, validación, envelope) que las historias US1 y US2 necesitan para funcionar correctamente. En orden de implementación, debe ejecutarse antes que US1 y US2, aunque su impacto directo en el usuario es menor.

Como desarrollador del sistema, quiero que todas las respuestas de la API tengan un formato consistente con requestId de correlación y errores categorizados, para poder diagnosticar problemas rápidamente y construir clientes predecibles.

**Why this priority**: Es la base técnica sobre la que se construye todo lo demás. Sin error handling consistente, request tracing y validación global, las historias US1 y US2 carecerían de la infraestructura necesaria para operar de forma robusta.

**Independent Test**: Puede probarse haciendo cualquier request a la API y verificando que: (1) la respuesta incluye `x-request-id` header, (2) los errores tienen formato categorizado, (3) las listas paginadas usan envelope `{ data, pagination }`.

**Acceptance Scenarios**:

1. **Given** cualquier request a la API, **When** se procesa, **Then** la respuesta incluye el header `x-request-id`
2. **Given** un request con datos inválidos, **When** falla validación, **Then** el error tiene categoría `validation` con detalles de los campos
3. **Given** un error de negocio, **When** ocurre, **Then** la respuesta tiene formato `{ error: { code, message, requestId, timestamp } }`
4. **Given** un endpoint que retorna una lista, **When** se consulta con paginación, **Then** la respuesta usa envelope `{ data, pagination: { page, limit, total, totalPages } }`
5. **Given** una variable de entorno crítica faltante, **When** la API inicia, **Then** falla con un mensaje claro antes de empezar a escuchar

---

### Edge Cases

- ¿Qué pasa cuando el scraper encuentra 0 posts nuevos? El worker debe completar exitosamente sin encolar ai-process (no hay nada que procesar)
- ¿Qué pasa cuando el AI processor falla (timeout, rate limit, error del provider)? Retry with exponential backoff (2^n minutes), max 3 retries, then move to dead letter queue. Raw posts remain marked as pending, not processed
- ¿Qué pasa cuando Redis no está disponible? La API debe fallar al iniciar con un mensaje claro
- ¿Qué pasa cuando se actualiza el schedule mientras un scrape está en ejecución? El cambio debe aplicarse al siguiente ciclo, no interrumpir el actual
- ¿Qué pasa con datos existentes? Los listings y raw-posts actuales deben seguir funcionando con el nuevo formato de respuesta envelope

## Requirements

### Functional Requirements

- **FR-001**: System MUST respond to `POST /api/scrape` with an immediate `{ jobId }` and HTTP 202, without blocking on the scraper execution
- **FR-002**: System MUST process scrape jobs asynchronously in the background via a job queue
- **FR-003**: System MUST automatically enqueue an AI processing job when a scrape job completes successfully and finds new posts
- **FR-004**: System MUST respond to `POST /api/ai-process` with an immediate `{ jobId }` and HTTP 202
- **FR-005**: System MUST process AI jobs asynchronously in the background via a job queue
- **FR-006**: System MUST provide `GET /api/scrape/status/:jobId` to check job status (waiting, active, completed, failed)
- **FR-007**: System MUST include `x-request-id` header in every API response for request tracing
- **FR-008**: System MUST log method, URL, controller, handler, duration, and status code for every request
- **FR-009**: System MUST categorize errors into types: validation, authorization, rate_limit, business, and unknown
- **FR-010**: System MUST return errors in format `{ error: { code, message, requestId, timestamp } }` without exposing stack traces
- **FR-011**: System MUST validate all incoming request data using a global validation mechanism that strips unknown fields and transforms types
- **FR-012**: System MUST validate critical environment variables at startup and fail with a clear message before listening if any are missing
- **FR-013**: System MUST expose `GET /api/schedule` to view current scheduler configuration
- **FR-014**: System MUST expose `PUT /api/schedule` to update scheduler interval and time window
- **FR-015**: System MUST register the scheduler automatically on API startup with default interval of 4 hours within window 8:00-22:00
- **FR-016**: System MUST return paginated list responses using envelope `{ data, pagination: { page, limit, total, totalPages } }`
- **FR-017**: System MUST wrap database access behind a repository layer for the listings and raw-posts features
- **FR-018**: System MUST run scraper and AI processor as long-running worker services with automatic restart on failure
- **FR-019**: System MUST save ScrapeLog entries with metrics (posts found, new, errors, duration) after each group scrape
- **FR-020**: System MUST NOT expose stack traces in production error responses
- **FR-021**: System MUST require a valid `x-api-key` header on all API requests, validated by a NestJS guard, rejecting requests without a valid key with HTTP 401. The `GET /api/health` endpoint is exempt from this requirement to allow load-balancer health probes

### Key Entities

- **ScrapeJob**: Represents an asynchronous scraping task. Contains configuration for which Facebook group to scrape, how many posts to fetch, and the profile directory. Tracks status through the queue lifecycle.
- **AiProcessJob**: Represents an asynchronous AI processing task. References raw post IDs to process or processes all pending posts. Tracks status through the queue lifecycle.
- **Schedule**: Configuration for automatic scraping. Defines interval in minutes, active hours window (start/end), and whether scheduling is enabled.
- **ScrapeLog**: Records each scrape execution with metrics: group ID, started at, duration, posts found, posts added, errors count. Provides audit trail for historical tracking.
- **Listing** (existing): Structured property listing with title, price, location, rooms, images, etc. Refactored to use repository pattern and new response envelope.
- **RawPost** (existing): Raw Facebook post data before AI processing. Refactored to use repository pattern and new response envelope.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `POST /api/scrape` responds in under 1 second (not blocked by scraper execution), confirming the async pipeline works
- **SC-002**: Scraped posts appear as structured listings within 30 minutes of the scrape request (scrape + AI processing combined)
- **SC-003**: All API error responses include a `requestId` and categorized error code - verifiable by testing any invalid request
- **SC-004**: The scheduler runs automatically on API startup and executes scrapes at the configured interval, verifiable by checking scrape logs after startup
- **SC-005**: If critical environment variables are missing, the API fails to start within 5 seconds with a clear error message
- **SC-006**: Paginated list endpoints return envelope format `{ data, pagination }` - verifiable by checking any list response structure
- **SC-007**: Scraper and AI processor workers restart automatically if they crash, verifiable by killing a worker process and confirming it comes back

## Out of Scope

- Web UI or dashboard — this spec covers API and workers only
- Multi-user support or role-based access — single admin only
- Email or SMS notifications
- Kubernetes or cloud-specific orchestration — Docker Compose only
- User registration or management
- Data import/export APIs beyond the standard envelope response format

## Assumptions

- Redis is available for BullMQ job queue operations (required dependency)
- PostgreSQL is available for data storage (required dependency)
- Existing CLI-based scraper and AI processor logic remains largely unchanged - only the execution model changes from CLI to worker
- The existing listings and raw-posts API endpoints must maintain backward compatibility in their data format (only the response envelope changes)
- Scheduler runs on the API service, not as a separate worker service
- Single admin user operating the system (no multi-user concerns)
- Network connectivity to Facebook and OpenRouter is available
- The default 4-hour interval and 8:00-22:00 window are reasonable starting defaults that users can customize
- Docker Compose is the deployment method (no Kubernetes or cloud-specific orchestration)
- API key is configured via a single `API_KEY` environment variable, shared across all admin consumers
