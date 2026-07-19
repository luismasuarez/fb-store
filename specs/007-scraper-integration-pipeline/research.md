# Research: Scraper Integration Pipeline

**Branch**: `007-scraper-integration-pipeline` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

## Key Decisions

### D1. Patrón de Persistencia: Scraper guarda en DB directamente

| Aspect | Detail |
|--------|--------|
| **Decision** | El scraper llama a `savePosts()` y `saveScrapeLog()` internamente en `scrape-runner.ts` |
| **Rationale** | El scraper ya tiene conexión a PostgreSQL (para groupId mode). Las funciones ya existen en `index.ts`. Evita transferir payloads grandes (imágenes base64 ~500KB por post) por HTTP entre scraper → API. La API solo recibe métricas livianas para decidir si encolar AI. |
| **Alternatives considered** | API guarda en DB (payload enorme via HTTP, dual write path). Scraper cache local (complejidad innecesaria). |
| **References** | Análisis de subagente persistence-gap. Código existente en `packages/scraper/src/index.ts:107-148`. |

### D2. Polling vs Webhook para detección de finalización

| Aspect | Detail |
|--------|--------|
| **Decision** | Polling: API llama `GET /scrape/:jobId` cada 5s hasta "completed" o timeout 120s |
| **Rationale** | El scraper es autónomo (FR-018 de Spec 006) — no debe depender de llamar al API. Polling es débilmente acoplado: el scraper no necesita saber que el API existe. 12-24 requests para un job de 1 minuto es overhead despreciable. |
| **Alternatives considered** | Webhook (scraper llama al API → viola autonomía del scraper). SSE server-side (conexión long-lived, más stateful). |
| **References** | Análisis de subagente ai-pipeline-gap. FR-018 de Spec 006. |

### D3. Auto-chain de AI: dentro del ScrapeService

| Aspect | Detail |
|--------|--------|
| **Decision** | `ScrapeService` inyecta `AiProcessorService` directamente y llama `triggerProcessing()` después de scrape exitoso |
| **Rationale** | Es el orquestador natural. ScrapeService sabe cuándo un scrape termina (vía polling). AiProcessorService sabe cómo encolar AI. No hay riesgo de dependencia circular (ScrapeModule → AiProcessorModule, no hay retroreferencia). |
| **Alternatives considered** | Scheduler maneja el AI chain (acopla scheduler con AI, el scheduler no sabe de scrapes individuales). Admin UI encola AI manualmente (requiere acción del operador). |
| **References** | Análisis de subagente ai-pipeline-gap. Estructura de módulos en `apps/api/src/features/`. |

### D4. Scheduler: @nestjs/schedule + SchedulerRegistry

| Aspect | Detail |
|--------|--------|
| **Decision** | Reemplazar BullMQ `upsertJobScheduler` por `@nestjs/schedule` con `SchedulerRegistry` para cron jobs dinámicos |
| **Rationale** | `SchedulerRegistry.addCronJob()` permite crear/modificar/eliminar cron jobs en runtime, que es necesario para que PUT /api/schedule funcione. `@Cron()` decorator es estático y no permite cambios en caliente. El scheduler itera grupos con `wait=true` secuencialmente. |
| **Alternatives considered** | BullMQ scrape queue con worker HTTP (dependencia Redis innecesaria). setInterval (no respeta ventana horaria nativamente). |
| **References** | Análisis de subagente scheduler-gap. Documentación de @nestjs/schedule. |

### D5. Scrape multi-grupo: wait=true secuencial

| Aspect | Detail |
|--------|--------|
| **Decision** | POST /api/v1/scrape con `wait: true` para cada grupo, secuencialmente, con timeout de 5 min por grupo |
| **Rationale** | El scraper soporta `wait: true` (sync mode) que bloquea hasta completar y retorna resultado directo. Simplifica el scheduler: no necesita mantener estado de jobs ni polling por grupo. Timeout por grupo evita que un grupo trabado bloquee indefinidamente. |
| **Alternatives considered** | Async + polling por grupo (complejidad adicional, más conexiones HTTP simultáneas). |
| **References** | Análisis de subagente scheduler-gap. Schemas en `packages/scraper/src/schemas.ts:8`. |

### D6. SSE vs Polling en Admin UI para grupos

| Aspect | Detail |
|--------|--------|
| **Decision** | Dashboard usa SSE (existente). Página de Grupos usa polling simple para detectar fin de scrape. |
| **Rationale** | La página de Grupos solo necesita saber "terminó o no" para refrescar lastScraped. No necesita logs de progreso ni fases. Polling cada 2s es suficiente y evita manejar múltiples conexiones SSE simultáneas. |
| **Alternatives considered** | SSE por grupo (múltiples EventSource, más complejo). Sin feedback (el operador no sabe cuándo terminó). |
| **References** | Análisis de subagente admin-ux-gap. |

### D7. TTL de jobs en memoria

| Aspect | Detail |
|--------|--------|
| **Decision** | Eliminar jobs "completed" y "failed" del Map después de 30 minutos |
| **Rationale** | Los jobs en memoria no se persisten. Si alguien consulta un job después de 30 min, recibirá 404 — aceptable dado que el API tiene su propia lógica de encadenamiento que ocurre dentro de los primeros 2 minutos. El TTL evita memory leak. |
| **Alternatives considered** | Sin límite (memory leak). TTL de 5 min (muy agresivo, el operador puede estar revisando el dashboard). |
| **References** | Análisis de subagente persistence-gap. `job-tracker.ts` en scraper. |

### D8. Manejo de errores: fail-closed para DB

| Aspect | Detail |
|--------|--------|
| **Decision** | Si `savePosts()` falla, el error se propaga, el job se marca como "failed" con código `db_error` (503), y NO se notifica "complete" via SSE |
| **Rationale** | Es mejor fallar ruidosamente que reportar un éxito falso. Los posts extraídos existen en el objeto `JobState` en memoria (aunque no persistidos), y los logs del servidor tienen la traza. El operador puede reintentar. |
| **Alternatives considered** | Best-effort (notificar complete aunque DB falle — el operador cree que los posts están guardados cuando no es así). |
| **References** | Análisis de subagente persistence-gap. Error handler en `packages/scraper/src/routes/scrape.ts:40-48`. |
