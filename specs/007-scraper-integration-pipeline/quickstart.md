# Quickstart: Scraper Integration Pipeline

> Guía de validación para verificar que la integración funciona de punta a punta.
> Detalles completos en [spec.md](./spec.md), contratos en [contracts/](./contracts/).

## Prerrequisitos

- Docker Compose corriendo: `docker compose up -d`
- O entorno local con:
  - PostgreSQL accesible via `DATABASE_URL`
  - Scraper corriendo en `http://localhost:3001`
  - API corriendo en `http://localhost:3000`
  - Redis accesible para BullMQ ai-process queue
- `SCRAPER_API_KEY` configurada (ej: `dev-key`)

## Escenarios de Validación

### Escenario 1: Pipeline Scrape → Persistencia → AI

```bash
# 1. Disparar scrape para un grupo (usar un groupId existente)
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{"groupId": "<existing-group-id>"}'
# → 202 { "jobId": "scrape_uuid" }

# 2. Verificar que RawPost se crearon en DB (via psql o Prisma Studio)
# psql -U fbstore -d fbstore -c "SELECT count(*) FROM raw_post WHERE \"groupId\" = '<group-id>';"
# → count > 0

# 3. Verificar que ScrapeLog se creó
# psql -U fbstore -d fbstore -c "SELECT * FROM scrape_log ORDER BY finished_at DESC LIMIT 1;"
# → Una fila con postsFound > 0 y postsNew > 0

# 4. Verificar que AI processing se encoló
# (revisar logs del API o checkear cola BullMQ)
# → Debe aparecer un job en la queue ai-process
```

**Criterio de éxito**: RawPost, ScrapeLog creados, y AI job encolado automáticamente.

---

### Escenario 2: Scheduler Automático

```bash
# 1. Verificar configuración actual del scheduler
curl -X GET http://localhost:3000/api/schedule
# → { "data": { "intervalMinutes": 240, "hourStart": 8, "hourEnd": 22, "enabled": true } }

# 2. Configurar intervalo corto para test (5 min)
curl -X PUT http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 5}'
# → { "data": { "intervalMinutes": 5, ... } }

# 3. Esperar al próximo tick del cron (máximo 5 min)
# Revisar logs del API:
docker compose logs api | grep "Scrape cycle"
# → Debe mostrar "Scrape cycle started" y "Scrape cycle completed"

# 4. Verificar que se crearon ScrapeLogs nuevos
# psql -d fbstore -c "SELECT * FROM scrape_log WHERE finished_at > now() - interval '10 minutes';"
# → Debe haber registros nuevos

# 5. Restaurar intervalo original
curl -X PUT http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 240}'
```

**Criterio de éxito**: El scheduler ejecuta scrapes automáticos. Se crean ScrapeLogs para cada grupo activo.

---

### Escenario 3: Scrape de Grupo Individual desde Admin UI

```bash
# 1. Abrir Admin UI en http://localhost:3000
# 2. Iniciar sesión con credenciales configuradas
# 3. Ir a Dashboard → "Scrapear ahora"
# 4. Verificar que hay un dropdown de selección de grupo
# 5. Seleccionar un grupo específico
# 6. Hacer clic en "Scrapear"
# 7. Verificar que la barra de progreso SSE avanza con fases
# 8. Al completar, verificar mensaje "Scrape completado: N posts"
```

**Criterio de éxito**: El operador puede seleccionar un grupo y ver progreso en tiempo real.

---

### Escenario 4: Botón Scrapear en Página de Grupos

```bash
# 1. Ir a Admin UI → Grupos
# 2. Verificar que cada fila tiene botón "Scrapear"
# 3. Hacer clic en "Scrapear" para un grupo
# 4. Verificar que el botón se deshabilita durante el scrape
# 5. Al completar, verificar que la columna "Último scrape" se actualiza
```

**Criterio de éxito**: Scrape individual desde la página de grupos con feedback visual.

---

### Escenario 5: Limpieza de Jobs (TTL)

```bash
# 1. Disparar un scrape (Escenario 1)
# 2. Consultar estado inmediatamente
curl -X GET http://localhost:3001/api/v1/scrape/<jobId> \
  -H "x-api-key: dev-key"
# → 200 { "status": "completed" }

# 3. Esperar 30 minutos (reducir a 1 min para test cambiando TTL en job-tracker.ts)
# 4. Volver a consultar el mismo jobId
curl -X GET http://localhost:3001/api/v1/scrape/<jobId> \
  -H "x-api-key: dev-key"
# → 404 { "error": { "code": "not_found", "message": "Job not found" } }
```

**Criterio de éxito**: Jobs completados/fallidos se eliminan automáticamente después del TTL.

---

### Escenario 6: Manejo de Errores

```bash
# DB caída (simular deteniendo PostgreSQL)
docker compose stop postgres

# Disparar scrape
curl -X POST http://localhost:3001/api/v1/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{"groupId": "<existing-group-id>"}'
# → 503 { "error": { "code": "db_error", "message": "Database is not available..." } }

# Restaurar DB
docker compose start postgres

# Scraper caído (simular)
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{"groupId": "<existing-group-id>"}'
# → 202 { "jobId" }
# → Después de 120s, el polling timeoutea y se logea el error
# → Revisar logs del API: "Job <jobId> timed out"
```

**Criterio de éxito**: Errores de DB retornan 503. Scraper caído no bloquea el API.

---

## Verificación Rápida (Cheat Sheet)

```bash
# Estado del scraper
curl -s http://localhost:3001/api/v1/ready | jq .

# Listar perfiles
curl -s http://localhost:3001/api/v1/profiles -H "x-api-key: dev-key" | jq .

# Disparar scrape vía API
curl -s -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{"groupId":"<id>"}'

# Estado del scheduler
curl -s http://localhost:3000/api/schedule -H "x-api-key: dev-key" | jq .
```
