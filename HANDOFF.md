# FB Store — Handoff Técnico

> **Último commit**: `72530d1` — Monorepo funcional + scraper E2E + AI pipeline con extracción estructurada de propiedades inmobiliarias cubanas.
>
> **Propósito**: Extraer publicaciones de grupos de Facebook, procesarlas con IA, almacenar datos estructurados y servirlos vía API REST para una app inmobiliaria.

---

## Stack

| Componente | Tecnología |
|---|---|
| Monorepo | pnpm + Turborepo |
| API Server | NestJS 11 + Fastify 5 |
| ORM | Prisma 7 + PostgreSQL |
| Scraper | Playwright 1.60 + Chrome persistente |
| AI Provider | OpenRouter (gpt-4o-mini) |
| Queue | BullMQ 5 + Redis (instalado, no configurado aún) |

---

## Estado actual

### ✅ Completado

| Área | Estado |
|---|---|
| Scaffold monorepo | pnpm workspaces, turbo.json, tsconfig.base |
| Docker | 3 Dockerfiles (api, scraper, ai-processor) + docker-compose con postgres + redis |
| Login FB | `pnpm setup:login` — Playwright headed, perfil persistente |
| Scraper | Navega grupo, click "Ver más", extrae posts con imágenes en base64, guarda en raw_posts |
| Sanitize | Limpieza de ruido Facebook (NFKC, patrones, comentarios) |
| AI Pipeline | raw_posts → OpenRouter → Listing estructurado con property fields |
| Schema | 13 columnas de propiedad (bedrooms, bathrooms, province, etc.) + aiRawData JSON |
| Images | Descarga desde FB CDN durante scrape (con cookies de sesión), guarda como base64 |
| Modularización | ai-processor dividido en 6 módulos (config, db, extractor, mapper, image-downloader, index) |
| Prompt | Prompt profesional para extracción inmobiliaria cubana |

### ❌ Pendiente

| Prioridad | Tarea |
|---|---|
| 🔴 Alta | **API Listings** — `GET /api/listings` con filtros + `GET /api/listings/:id` |
| 🟡 Media | BullMQ worker para scheduler + cola de scraping |
| 🟡 Media | Docker E2E — validar scraper + AI desde contenedor |
| 🟢 Baja | Expo app (Fase 2) |
| 🟢 Baja | Admin panel (Fase 4) |

---

## Arquitectura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Scraper     │     │ ai-processor  │     │  API NestJS   │
│  (Playwright) │────▶│  (OpenRouter) │────▶│  (Fastify)    │
│  packages/    │     │  packages/    │     │  apps/        │
│  scraper/     │     │  ai-processor │     │  api/         │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ▼                    ▼                    ▼
   raw_posts            listings            GET /api/...
   (tabla DB)           (tabla DB)          (endpoints)
```

### Flujo de datos

```
1. pnpm scrape
   └→ Playwright abre Chrome con perfil persistente
   └→ Navega a facebook.com/groups/{id}
   └→ Click "Ver más" para expandir texto truncado
   └→ Extrae posts del DOM (texto, imágenes, autor)
   └→ Descarga imágenes como base64 (usa fetch del browser → cookies activas)
   └→ Sanitiza texto (quita ruido, comentarios, UI artifacts)
   └→ Guarda en raw_posts (tabla)

2. pnpm ai:process
   └→ Lee raw_posts WHERE processed=false (batch de a 10)
   └→ Limpia comentarios/UI del texto (cleaner.ts)
   └→ Envía a OpenRouter con prompt inmobiliario
   └→ Mapea StructuredPropertyListing → columnas de Listing
   └→ Preserva imágenes base64 de raw_data
   └→ Crea registro en listings
   └→ Marca raw_post como processed

3. (pendiente) GET /api/listings
   └→ Query con filtros (listing_type, property_type, province, price, etc.)
   └→ Paginación + sorting
```

---

## Estructura de paquetes

### `packages/scraper/`

```
src/
├── index.ts       ← Entry: main loop por grupo, click "Ver más", extracción, download imágenes, save
├── login.ts       ← pnpm setup:login (Playwright headed, login manual)
├── browser.ts     ← launchPersistentContext, detección de Chrome
├── extractor.ts   ← EXTRACTOR_SCRIPT (código que se inyecta en el DOM de Facebook)
```

### `packages/ai-processor/`

```
src/
├── index.ts            ← Orchestrator: loop de batches, contadores
├── config.ts           ← Env vars tipadas (provider, model, apiKey, batchSize)
├── db.ts               ← Queries a Prisma (getPendingPosts, createListing, markProcessed, etc.)
├── extractor.ts        ← Wrapper: cleanPostText() → provider.extract()
├── mapper.ts           ← Función pura: StructuredPropertyListing → Prisma create data
├── image-downloader.ts ← Fallback para descargar imágenes (solo si no vienen en base64 desde scraper)
├── cleaner.ts          ← Filtra líneas de comentarios/UI de Facebook del texto
```

### `packages/shared/`

```
src/
├── prisma/
│   ├── client.ts        ← getPrismaClient() singleton con adapter-pg
│   └── index.ts
├── ai/
│   ├── provider.ts      ← StructuredPropertyListing interface + AIProvider interface
│   ├── registry.ts      ← registerProvider, getProvider, PROMPT_SYSTEM
│   ├── openrouter.ts    ← OpenRouterProvider (fetch con timeout + retry)
│   └── index.ts
├── utils/
│   ├── sanitize.ts      ← sanitizeFacebookText (NFKC, ruido, patrones)
│   └── whatsapp.ts
├── types/
├── schemas/             ← Zod schemas
└── generated/prisma/    ← Generado por prisma generate
```

### `apps/api/`

```
src/
├── main.ts                ← NestJS bootstrap, FastifyAdapter, Swagger
├── app.module.ts          ← Módulo raíz
├── app.controller.ts      ← GET /api/health
├── prisma/
│   ├── prisma.module.ts   ← @Global, provee PrismaService
│   └── prisma.service.ts  ← Wrapper sobre getPrismaClient()
└── raw-posts/
    ├── raw-posts.controller.ts
    ├── raw-posts.service.ts
    └── raw-posts.module.ts
```

---

## Schema DB

### Listing (columnas principales)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `fb_post_id` | String (unique) | ID de Facebook |
| `title` | String? | Título limpio |
| `price` | Decimal(12,2)? | Precio |
| `currency` | String | USD/MLC/CUP/Bs |
| `listing_type` | String? | sale/rent/swap/unknown |
| `property_type` | String? | apartment/house/room/land/commercial |
| `province` | String? | Provincia |
| `municipality` | String? | Municipio |
| `neighborhood` | String? | Reparto/barrio |
| `bedrooms` | Int? | Habitaciones |
| `bathrooms` | Float? | Baños (0.5 = medio) |
| `total_m2` | Int? | Metros cuadrados |
| `floors` | Int? | Plantas |
| `parking` | Boolean? | Estacionamiento |
| `furnished` | Boolean? | Amueblado |
| `images` | Json | Array de `{url, mime, data}` con base64 |
| `ai_raw_data` | Json | Respuesta completa del AI |
| `contact_phone` | String? | Teléfono de contacto |
| `status` | String | active/sold |

Ver schema completo en `packages/shared/prisma/schema.prisma`.

### RawPost

| Columna | Descripción |
|---|---|
| `fb_post_id` | ID de Facebook (puede haber duplicados, sin unique constraint) |
| `raw_data` | JSON completo extraído del DOM (incluye imágenes en base64) |
| `text_content` | Texto sanitizado |
| `processed` | Flag de procesamiento por AI |
| `ai_provider` | openrouter / skipped / duplicate |

---

## Cómo usar

```bash
# 1. Login (1 vez, en máquina con interfaz gráfica)
pnpm setup:login
# → Playwright abre Chrome, login manual, cerrar ventana

# 2. Scrape
pnpm scrape

# 3. AI Processing
pnpm ai:process

# 4. API (desarrollo)
pnpm dev
# → http://localhost:3000/api/health
# → http://localhost:3000/api/raw-posts

# 5. DB Studio
pnpm db:studio

# 6. Docker
pnpm docker:up
pnpm docker:down

# 7. Reset DB (borra todo y recrea schema)
cd packages/shared && DATABASE_URL=postgresql://fbstore:fbstore@localhost:5432/fbstore npx prisma migrate reset --force
```

---

## Variables de entorno (.env)

```env
DATABASE_URL=postgresql://fbstore:fbstore@localhost:5432/fbstore
REDIS_URL=redis://localhost:6379

AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-4o-mini
OPENROUTER_API_KEY=sk-or-v1-...

FB_GROUPS=[{"id":"1125512514573292","name":"Grupo Prueba","max_posts":10}]

SCRAPE_INTERVAL_MINUTES=240
```

---

## Decisiones técnicas importantes

### 1. Imágenes como base64
Las URLs de Facebook CDN tienen firmas ligadas a la sesión del navegador. Se descargan durante el scrape usando `page.evaluate(fetch → blob → FileReader → dataUrl)` que corre en el contexto del browser con cookies activas. Guardadas como base64 en `raw_data` y preservadas en `listing.images`.

### 2. Texto truncado de Facebook
Facebook trunca textos largos con "Ver más". El scraper clickea todos los botones "Ver más" antes de extraer. Aún así, algunos textos pueden quedar truncados.

### 3. Comentarios
El texto extraído del DOM incluye comentarios y elementos UI. El cleaner.ts los filtra por líneas antes de enviar al AI, ahorrando ~15-30% de tokens.

### 4. Prompt inmobiliario
El prompt es específico para Cuba: calles numeradas ("57 y 92" son direcciones, no precios), monedas (CUP, MLC, USD), terminología local ("biplanta", "puerta de calle").

### 5. Sin BullMQ activo
BullMQ está instalado como dependencia pero no configurado. El scraper y ai-processor corren como scripts directos. BullMQ se activará cuando se necesite scheduler.

---

## Problemas conocidos / Limitaciones

- **IDs repetidos en raw_posts**: `fbPostId` no tiene unique constraint. El ai-processor maneja duplicados vía P2002.
- **Precios en imágenes**: Muchos precios están solo en imágenes. El AI no puede extraerlos (solo texto). El prompt lo reporta como `mentioned: false`.
- **Comentarios pidiendo precio**: El cleaner ya filtra comentarios, pero si el texto original tiene "Precio" en un comment embedido, puede colarse.
- **Sin tests**: El proyecto está en fase de prototipo. No hay tests unitarios ni e2e.
- **API listings no implementada**: `GET /api/listings` es el próximo paso.

---

## Próximos pasos recomendados

| Prioridad | Tarea | Archivos involucrados |
|---|---|---|
| 1 | `GET /api/listings` con filtros | `apps/api/src/listings/` (crear) + `app.module.ts` |
| 2 | `GET /api/listings/:id` con detalle completo | `apps/api/src/listings/listings.controller.ts` |
| 3 | Seed script (reset + scrape + AI en 1 comando) | `package.json` + script |
| 4 | Docker E2E validation | `docker-compose.yml`, `docker/Dockerfile.*` |
| 5 | BullMQ scheduler | `packages/scraper/src/index.ts` + `apps/api/src/app.module.ts` |

---

## Comandos útiles

```bash
# Ver datos crudos
pnpm db:studio

# Ver listings via SQL directo
DATABASE_URL=postgresql://fbstore:fbstore@localhost:5432/fbstore \
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT fb_post_id, title, price::text, currency, listing_type, property_type, municipality, neighborhood, bedrooms, bathrooms, ai_confidence::text FROM listings').then(r => { console.table(r.rows); pool.end(); });
" 2>&1

# Resetear solo raw_posts processed (para reprocesar)
DATABASE_URL=postgresql://fbstore:fbstore@localhost:5432/fbstore \
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"UPDATE raw_posts SET processed = false, ai_provider = NULL WHERE ai_provider = 'openrouter'\").then(r => { console.log('Reset', r.rowCount, 'posts'); pool.end(); });
" 2>&1

# Resetear DB completa
cd packages/shared && DATABASE_URL=postgresql://fbstore:fbstore@localhost:5432/fbstore npx prisma migrate reset --force
```
