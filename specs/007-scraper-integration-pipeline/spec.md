# Feature Specification: Scraper Integration Pipeline

**Feature Branch**: `007-scraper-integration-pipeline`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Reconectar el scraper HTTP autónomo con el API NestJS, el scheduler automático, el AI processor y el Admin UI. Arreglar los 6 gaps de integración que dejó la migración del scraper de BullMQ a HTTP, para que el pipeline completo (scrape → save posts → AI process → listings) funcione de punta a punta sin intervención manual."

## User Scenarios & Testing

### User Story 1 - Pipeline Automático Scrape → AI (Priority: P1)

Como operador del sistema, quiero que cuando disparo un scrape manualmente, los posts se guarden en la base de datos y el procesamiento con IA se encadene automáticamente, para no tener que ejecutar "Procesar con IA" manualmente después de cada scrape.

**Why this priority**: Es el pipeline de valor principal del producto. Sin esto, el sistema requiere intervención manual para cada ciclo scrape → AI, que es exactamente el problema que la Spec 003 resolvía y que la Spec 006 rompió involuntariamente.

**Independent Test**: Puede probarse disparando un scrape desde el Admin UI o la API, y verificando que: (1) los posts aparecen como RawPost en la base de datos, (2) un ScrapeLog se crea con las métricas correctas (postsFound, postsNew, durationMs), (3) un job de AI processing se encola automáticamente en la cola ai-process, (4) eventualmente los listings aparecen en la base de datos.

**Acceptance Scenarios**:

1. **Given** un grupo de Facebook con posts, **When** el operador hace clic en "Scrapear ahora", **Then** el scraper extrae posts, los persiste como RawPost y crea un ScrapeLog en la base de datos
2. **Given** un scrape completado exitosamente con posts nuevos, **When** el API detecta la finalización, **Then** encola automáticamente un job en la cola ai-process
3. **Given** un scrape que encuentra 0 posts nuevos, **When** el API detecta la finalización, **Then** NO encola AI processing y registra el resultado
4. **Given** un scrape que falla (error de red, sesión expirada), **When** el API detecta el fallo, **Then** NO encola AI processing y el job queda marcado como "failed"

---

### User Story 2 - Scrapes Automáticos con Scheduler (Priority: P1)

Como operador del sistema, quiero que el scheduler ejecute scrapes automáticos según el horario configurado (cada N minutos, ventana horaria), para no tener que disparar scrapes manualmente.

**Why this priority**: Sin scheduler funcional, el sistema solo opera con intervención manual. Es una regresión respecto a la Spec 003 donde el scheduler funcionaba via BullMQ.

**Independent Test**: Puede probarse configurando un intervalo corto (ej: cada 5 minutos) via PUT /api/schedule, y verificando que: (1) el scheduler ejecuta scrapes en cada tick, (2) itera sobre todos los grupos activos, (3) tras cada scrape encola AI processing, (4) respeta la ventana horaria configurada.

**Acceptance Scenarios**:

1. **Given** el scheduler activo con grupos configurados, **When** llega la hora de ejecución según el cron, **Then** el scheduler obtiene los grupos activos de la base de datos
2. **Given** una lista de grupos activos, **When** el scheduler ejecuta el ciclo, **Then** itera secuencialmente sobre cada grupo llamando al scraper via HTTP con wait=true
3. **Given** un grupo scrapeado exitosamente, **When** el ciclo continúa, **Then** el scheduler encola AI processing para los posts de ese grupo
4. **Given** un grupo que falla durante el scrape, **When** el ciclo continúa, **Then** el scheduler logea el error y continúa con el siguiente grupo (fallo parcial no detiene el ciclo)
5. **Given** el scheduler deshabilitado (enabled: false), **When** llega la hora de ejecución, **Then** no se ejecuta ningún scrape

---

### User Story 3 - Scrape de Grupo Individual desde Admin UI (Priority: P2)

Como operador del sistema, quiero seleccionar qué grupo scrapear desde el dashboard y también poder scrapear un grupo específico desde la página de grupos, para tener control granular sobre qué grupos se actualizan.

**Why this priority**: Sin esta capacidad, el operador solo puede scrapear "todos los grupos" sin opción de seleccionar uno específico, limitando el control operativo.

**Independent Test**: Puede probarse abriendo el Admin UI, seleccionando un grupo específico en el dashboard y haciendo clic en "Scrapear", o yendo a la página de Grupos y haciendo clic en "Scrapear" en una fila. En ambos casos, el progreso debe ser visible y al finalizar el lastScraped del grupo debe actualizarse.

**Acceptance Scenarios**:

1. **Given** el dashboard con múltiples grupos activos, **When** el operador selecciona un grupo del dropdown y hace clic en "Scrapear", **Then** solo ese grupo se scrapea y el progreso se muestra via SSE
2. **Given** la página de Grupos, **When** el operador hace clic en "Scrapear" en una fila, **Then** se scrapea ese grupo específico y al finalizar la columna lastScraped se actualiza
3. **Given** "Todos los grupos" seleccionado en el dashboard, **When** el operador hace clic en "Scrapear", **Then** el scraper itera sobre todos los grupos activos secuencialmente

---

### User Story 4 - Limpieza Automática de Jobs en Scraper (Priority: P3)

Como operador del sistema, quiero que los jobs de scraping viejos se limpien automáticamente de la memoria del scraper, para que el uso de memoria no crezca indefinidamente con uso continuado.

**Why this priority**: Es una buena práctica de higiene del sistema. En operación normal (scrapes cada 4 horas), la acumulación es lenta, pero en desarrollo o pruebas puede crecer rápido.

**Independent Test**: Puede probarse disparando scrapes y verificando que después del tiempo de expiración configurado, los jobs completados/fallidos desaparecen del Map interno.

**Acceptance Scenarios**:

1. **Given** un job de scrape completado, **When** pasan 30 minutos desde su finalización, **Then** el job se elimina automáticamente del Map en memoria
2. **Given** un job de scrape fallido, **When** pasan 30 minutos desde su finalización, **Then** el job se elimina automáticamente
3. **Given** un job en estado running, **When** pasan 30 minutos, **Then** el job NO se elimina (solo jobs completed/failed)

---

### Edge Cases

- **¿Qué pasa si el scraper se cae durante un scrape?** El API detecta timeout en polling y logea error. Los posts ya guardados antes del crash persisten en DB (el scraper guarda durante el proceso). El operador debe reintentar.
- **¿Qué pasa si la base de datos no está disponible durante savePosts?** El scraper falla con error 503. El job se marca como "failed". SSE emite evento error. El API no encola AI.
- **¿Qué pasa si la AI processor no está disponible?** El enqueuing de AI falla. El scrape ya se completó y los posts están en DB. Se logea el error. El operador puede reprocesar manualmente.
- **¿Qué pasa si el scheduler ejecuta un ciclo mientras el anterior aún no terminó?** El scheduler debe detectar si hay un ciclo en ejecución y saltar el tick si el anterior no ha terminado.
- **¿Qué pasa con grupos sin posts nuevos en scheduler?** El scheduler no encola AI para ese grupo y continúa con el siguiente.
- **¿Qué pasa si un grupo es desactivado mientras el scheduler está iterando?** El scheduler usa la lista de activos obtenida al inicio del ciclo. El grupo se procesa en ese ciclo pero no en el siguiente.

## Requirements

### Functional Requirements

**Pipeline Scrape → Persistencia → AI**:

- **FR-001**: El scraper DEBE llamar a `savePosts()` después de `scrapeGroup()` en el `runScrape()`, antes de notificar a clientes SSE
- **FR-002**: El scraper DEBE llamar a `saveScrapeLog()` después de `savePosts()` con métricas precisas (postsFound, postsNew, durationMs)
- **FR-003**: El `result.metrics.postsNew` DEBE reflejar el valor retornado por `savePosts()` (posts realmente persistidos, excluyendo duplicados P2002), no el total de posts extraídos
- **FR-004**: Si `savePosts()` falla, el error DEBE propagarse y el job DEBE marcarse como "failed" con código `db_error` y status 503
- **FR-005**: Los eventos SSE "complete" DEBEN emitirse SOLO después de que `savePosts()` y `saveScrapeLog()` hayan sido exitosos
- **FR-006**: El API NestJS DEBE implementar polling a `GET /scrape/:jobId` cada 5 segundos hasta que el status sea "completed" o "failed", con un timeout máximo de 120 segundos
- **FR-007**: Cuando el polling detecta "completed" con posts nuevos > 0, el API DEBE encolar automáticamente AI processing via `AiProcessorService.triggerProcessing()`
- **FR-008**: Cuando el polling detecta "completed" con 0 posts nuevos, el API NO DEBE encolar AI processing y DEBE logear el resultado
- **FR-009**: Cuando el polling detecta "failed" o timeout, el API DEBE logear el error y NO DEBE encolar AI processing
- **FR-010**: El encadenamiento AI DEBE ejecutarse de forma asíncrona sin bloquear la respuesta HTTP. El endpoint POST /api/scrape DEBE retornar HTTP 202 inmediatamente, con el encadenamiento ocurriendo en segundo plano.
- **FR-011**: El `ScrapeModule` DEBE importar `AiProcessorModule` para acceder a `AiProcessorService`
- **FR-012**: El `AiProcessorModule` DEBE exportar `AiProcessorService` para que otros módulos puedan usarlo

**Scheduler Automático**:

- **FR-013**: El scheduler DEBE reemplazar BullMQ `@InjectQueue("scrape")` por `@nestjs/schedule` con `SchedulerRegistry` para manejo dinámico de cron jobs
- **FR-014**: El scheduler DEBE obtener los grupos activos desde la base de datos al inicio de cada ciclo
- **FR-015**: El scheduler DEBE iterar secuencialmente sobre cada grupo activo, llamando al scraper via HTTP con `wait=true`
- **FR-016**: Cada llamada al scraper DEBE tener un timeout individual de 5 minutos por grupo
- **FR-017**: Si un grupo falla, el scheduler DEBE continuar con el siguiente grupo (fallo parcial no detiene el ciclo)
- **FR-018**: Tras cada scrape exitoso, el scheduler DEBE encolar AI processing directamente llamando a `AiProcessorService.triggerProcessing()`
- **FR-019**: El scheduler DEBE detectar si un ciclo previo aún está en ejecución y saltar el tick si es necesario (no solapamiento)
- **FR-020**: La configuración del scheduler (intervalo, ventana horaria, enabled) DEBE seguir siendo modificable via GET/PUT /api/schedule
- **FR-021**: El módulo `SchedulerModule` DEBE eliminar `BullModule.registerQueue({ name: "scrape" })` e importar `ScheduleModule.forRoot()`
- **FR-022**: El scheduler DEBE depender de `@nestjs/schedule` (agregar a package.json del API)

**Admin UI - Scrape de Grupo Específico**:

- **FR-023**: El componente `ScrapeControls` DEBE mostrar un dropdown con los grupos activos para que el operador seleccione cuál scrapear
- **FR-024**: El dropdown DEBE incluir una opción "Todos los grupos" como valor por defecto
- **FR-025**: El hook `useScrape` DEBE aceptar un parámetro opcional `groupId` en la función de mutación
- **FR-026**: La página de Grupos DEBE mostrar un botón "Scrapear" por fila que dispare el scrape de ese grupo específico
- **FR-027**: El scraping desde la página de Grupos DEBE usar polling simple (no SSE) para determinar cuándo terminó y actualizar lastScraped
- **FR-028**: El botón "Scrapear" DEBE deshabilitarse mientras el grupo está siendo scrapeado

**Limpieza de Jobs**:

- **FR-029**: El `job-tracker` del scraper DEBE eliminar automáticamente jobs con status "completed" o "failed" después de 30 minutos
- **FR-030**: Jobs con status "pending" o "running" NO DEBEN ser eliminados por el mecanismo de TTL

### Key Entities

- **ScrapeJob (en memoria)**: Representa un job de scraping en ejecución. Estados: pending, running, completed, failed. Se elimina automáticamente tras 30 min de finalizado.
- **RawPost**: Post extraído de Facebook persistido en PostgreSQL. Creado por `savePosts()` en el scraper. Es la entrada para el AI processor.
- **ScrapeLog**: Registro de métricas de cada ejecución de scrape. Creado por `saveScrapeLog()` en el scraper.
- **ScheduleConfig**: Configuración del scheduler automático (intervalo, ventana horaria, enabled). Modificable via API.
- **CronJob (dinámico)**: Job de cron registrado via `SchedulerRegistry` que ejecuta el ciclo de scraping automático.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un scrape via API o Admin UI resulta en RawPost y ScrapeLog persistidos en DB en menos de 2 minutos para un grupo con 20 posts
- **SC-002**: El AI processing se encola automáticamente en menos de 15 segundos después de que el scrape se completa (contando el polling de 5s)
- **SC-003**: El scheduler ejecuta scrapes automáticos respetando el cron configurado, verificable revisando ScrapeLogs
- **SC-004**: El operador puede seleccionar un grupo específico y scrapearlo individualmente desde el Admin UI en 1 clic
- **SC-005**: El scheduler tolera fallos individuales de grupos sin detener el ciclo completo
- **SC-006**: La memoria del scraper no crece indefinidamente — jobs completados/fallidos se eliminan después de 30 minutos
- **SC-007**: El pipeline completo (scrape → persistencia → AI → listings) funciona sin intervención manual después de disparar un scrape

## Assumptions

- El scraper ya tiene acceso a PostgreSQL via `getPrismaClient()` (usado actualmente para groupId mode)
- Las funciones `savePosts()` y `saveScrapeLog()` en `index.ts` ya existen y funcionan correctamente
- `@nestjs/schedule` es compatible con la versión de NestJS del proyecto (v11)
- El modelo `Group` en Prisma tiene un campo `isActive` para filtrar grupos activos
- El endpoint `GET /api/groups` acepta el filtro `isActive=true`
- Todos los componentes corren en la misma red Docker y pueden comunicarse via HTTP interno
- El BullMQ queue "ai-process" y su worker siguen funcionando — solo el scheduler necesita migración
- El patrón de polling cada 5s con timeout de 120s es aceptable dado que los scrapes típicos duran 30-60s
