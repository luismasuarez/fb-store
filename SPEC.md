# FB Store — Especificación Técnica

> **MVP**: Automatización para extraer publicaciones de grupos de Facebook, procesarlas con IA, almacenarlas y consultarlas desde una app móvil Expo.

---

## Índice

- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura General](#arquitectura-general)
- [Estrategia de Scraping](#estrategia-de-scraping)
- [AI Processing](#ai-processing)
- [Base de Datos](#base-de-datos)
- [API REST](#api-rest)
- [App Expo](#app-expo)
- [Deployment](#deployment)
- [Costos](#costos)
- [Roadmap](#roadmap)
- [Changelog](#changelog)

---

## Stack Tecnológico

| Componente | Tecnología | Justificación |
|---|---|---|
| Scraper | Python (`kevinzg/facebook-scraper` + cookies) | Gratuito, rápido para MVP. Fallback a Apify API. |
| API Server | Node.js + Express + TypeScript | Tipado fuerte, ecosistema maduro, fácil conexión con Expo |
| Job Queue | BullMQ (Redis) | Schedule, retry, rate limiting |
| AI Processing | OpenAI GPT-4o / Claude 3.5 Sonnet | Extracción estructurada de datos no-estructurados |
| Base de datos | PostgreSQL | Relacional, simple, bien soportado, maduro |
| Cliente móvil | Expo (React Native) | iOS + Android desde un solo código base |
| Infraestructura | Docker Compose | Portable, plug-and-play, fácil deploy |

---

## Arquitectura General

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                          │
│  ┌──────────────┐    ┌──────────┐    ┌──────────────┐   │
│  │  Scraper      │───▶│  Redis   │◀───│  API          │   │
│  │  (Python)     │    │ (BullMQ) │    │  (Express)    │   │
│  └──────┬───────┘    └──────────┘    └──────┬─────────┘   │
│         │                                    │             │
│         ▼                                    ▼             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL                          │ │
│  └──────────────────────────────────────────────────────┘ │
│         ▲                                                  │
│  ┌──────┴───────┐    ┌─────────────────────────┐         │
│  │  AI Processor │    │  CRON: cada 2-4 hrs     │         │
│  │  (OpenAI/     │    │  (solo horario diurno)  │         │
│  │   Claude)     │    └─────────────────────────┘         │
│  └──────────────┘                                         │
└──────────────────────────────────────────────────────────┘
                            ▲
                            │ API REST
                            ▼
                    ┌──────────────┐
                    │  Expo App    │
                    │  (Mobile)    │
                    └──────────────┘
```

### Flujo de datos

1. **Scheduler** CRON (BullMQ) dispara el scraper cada N minutos
2. **Scraper** toma cookie activa, consulta posts recientes de cada grupo
3. **Posts crudos** se guardan en `raw_text` + tabla temporal
4. **AI Processor** toma posts nuevos, los envía al LLM, extrae estructura
5. **Datos estructurados** se guardan en `listings` con dedup por `fb_post_id`
6. **API REST** expone los listings filtrables
7. **Expo App** consulta la API y muestra al usuario

---

## Estrategia de Scraping

### Abstracción de proveedor

```
┌──────────────────────────────────────────────┐
│  Scraper Interface (abstract class)           │
│  - getPosts(groupId, maxPosts) → Post[]      │
│                                              │
│  ┌──────────────────────┐                    │
│  │  FacebookScraper     │ ← Gratis, frágil   │
│  │  (kevinzg/facebook-  │                    │
│  │   scraper + cookies) │                    │
│  └──────────────────────┘                    │
│           │ Falla? → swap en config          │
│           ▼                                  │
│  ┌──────────────────────┐                    │
│  │  ApifyScraper        │ ← Pago, confiable  │
│  │  (Apify API)         │  ~$2/1K posts      │
│  └──────────────────────┘                    │
└──────────────────────────────────────────────┘
```

### facebook-scraper (default para MVP)

1. Login manual 1 vez → exportar cookies
2. El scraper usa esas cookies para autenticarse
3. Consulta el feed del grupo via GraphQL interno
4. Extrae: texto, imágenes, timestamp, autor
5. Retorna JSON con posts crudos

**Limitaciones conocidas:**
- Se rompe cuando Facebook cambia sus endpoints GraphQL (cada 2-4 semanas)
- No siempre obtiene todas las imágenes
- Los grupos privados pueden requerir cookies adicionales

### Apify (fallback)

1. API key en env vars
2. POST a `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/runs`
3. Apify maneja proxies, anti-block, CAPTCHAs
4. Callback o polling para resultados

### Medidas anti-detección

| Medida | Detalle |
|---|---|
| Rate limiting | Máximo 1 grupo cada 3 minutos |
| Límite de posts | Configurable por grupo (default: 30) |
| Schedule | Solo en horario diurno (8:00–22:00) |
| Intervalo | Cada 2–4 horas (configurable) |
| Cookies | Extraídas de sesión real, renovadas al expirar |
| Rotación de cuentas | Múltiples cuentas en env, swap con variable |
| Proxies (opcional) | Residenciales si se requiere |

### Configuración (environment variables)

```bash
# === CUENTAS DE FACEBOOK ===
# Array JSON de cuentas. Cada una con email, password y ruta a archivo de cookies.
FB_ACCOUNTS='[
  {"email": "cuenta1@email.com", "password": "pass123", "cookies": "/cookies/cuenta1.json"},
  {"email": "cuenta2@email.com", "password": "pass456", "cookies": "/cookies/cuenta2.json"}
]'
# Índice de la cuenta activa (0-based). Cambiar si la actual es baneada.
ACTIVE_ACCOUNT_INDEX=0

# === GRUPOS A SCRAPEAR ===
# Array JSON de grupos. ID numérico de Facebook + nombre + límite de posts por scrape.
FB_GROUPS='[
  {"id": "123456789", "name": "Ventas Caracas", "max_posts": 30},
  {"id": "987654321", "name": "Marketplace Venezuela", "max_posts": 20},
  {"id": "456789123", "name": "Compra Venta Cocina", "max_posts": 25}
]'

# === SCHEDULE ===
# Intervalo en minutos entre cada ronda de scraping.
SCRAPE_INTERVAL_MINUTES=180
# Horario diurno: no scrapear de madrugada.
SCRAPE_HOURS_START=8
SCRAPE_HOURS_END=22

# === SCRAPER BACKEND ===
# "facebook-scraper" | "apify"
SCRAPER_BACKEND="facebook-scraper"

# === APIFY (fallback) ===
APIFY_API_KEY=""
APIFY_ACT_ID="apify~facebook-posts-scraper"

# === DATABASE ===
DATABASE_URL="postgresql://user:pass@db:5432/fbstore"

# === REDIS ===
REDIS_URL="redis://redis:6379"

# === AI ===
AI_PROVIDER="openai"  # "openai" | "anthropic"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
AI_MODEL="gpt-4o"
# Procesa solo posts sin procesar. Límite para controlar costos.
AI_MAX_POSTS_PER_RUN=50

# === APP ===
APP_NAME="FB Store"
APP_WHATSAPP_MESSAGE="Hola, vi tu {producto} en *{app_name}*. ¿Está disponible todavía?"
```

---

## AI Processing

### Pipeline

```
Raw post text ──▶ Pre-procesamiento (limpiar saltos, URLs) ──▶ LLM Prompt ──▶ JSON
```

### Prompt engineering

```
Eres un extractor de datos de publicaciones de Facebook en Venezuela.
Analiza la siguiente publicación y extrae la información en JSON.
Responde SOLO con el JSON, sin explicaciones ni markdown.

Reglas:
- category: una de ["casa", "cocina", "aseo", "electronica", "ropa", "vehiculos", "muebles", "otros"]
- price: solo el número, sin símbolos. null si no se menciona.
- currency: "Bs", "USD", o null
- contact_phone: número de teléfono venezolano (0412, 0424, etc.). null si no aparece.
- contact_name: nombre del vendedor si se menciona. null si no.
- location: ciudad o zona. null si no se menciona.
- title: nombre del producto, máximo 80 caracteres
- description: descripción completa del producto
- is_available: true/false basado en si parece estar disponible

Publicación:
{{TEXTO_CRUDO}}

JSON:
```

### Edge cases

| Caso | Manejo |
|---|---|
| Sin precio | `price: null` |
| Sin teléfono | `contact_phone: null` |
| Múltiples productos | `category: "otros"`, descripción completa |
| Publicación "vendido" | `is_available: false` |
| Moneda ambigua | Inferir del contexto (dolar, $ → USD; bs, bolos, → Bs) |
| Solo imágenes sin texto | Saltar (sin datos para procesar) |

### Rate limiting

- OpenAI: ~10 posts/min (suficiente para ~30-50 posts por ronda)
- Lotes de 5 en paralelo con pausa de 6s entre lotes
- Costo estimado: ~$0.002-0.005 por post (modelo GPT-4o mini)

---

## Base de Datos

### Schema

```sql
-- Listings: tabla principal de publicaciones procesadas
CREATE TABLE listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_post_id    TEXT UNIQUE NOT NULL,      -- Para dedup
  title         TEXT,
  price         NUMERIC(10, 2),
  currency      TEXT DEFAULT 'Bs',
  category      TEXT,
  description   TEXT,
  contact_phone TEXT,
  contact_name  TEXT,
  location      TEXT,
  images        JSONB DEFAULT '[]',        -- Array de URLs
  source_group  TEXT,                      -- Nombre del grupo
  source_group_id TEXT,                    -- ID del grupo en FB
  source_url    TEXT,                      -- Link al post original
  raw_text      TEXT,                      -- Texto original sin procesar
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired')),
  posted_at     TIMESTAMPTZ,              -- Fecha original de la publicación
  scraped_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_scraped_at ON listings(scraped_at DESC);
CREATE INDEX idx_listings_search ON listings USING GIN(to_tsvector('spanish', title || ' ' || description));

-- Grupos monitoreados
CREATE TABLE groups (
  id            TEXT PRIMARY KEY,          -- Facebook group ID
  name          TEXT NOT NULL,
  url           TEXT,
  max_posts     INT DEFAULT 30,
  last_scraped  TIMESTAMPTZ,
  last_error    TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de cada ejecución del scraper
CREATE TABLE scrape_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      TEXT REFERENCES groups(id),
  account_index INT,
  backend       TEXT,                      -- "facebook-scraper" | "apify"
  posts_found   INT DEFAULT 0,
  posts_new     INT DEFAULT 0,
  posts_errors  INT DEFAULT 0,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  error         TEXT
);

-- Raw posts: antes del AI processing (para debug / reprocesar)
CREATE TABLE raw_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_post_id    TEXT NOT NULL,
  group_id      TEXT REFERENCES groups(id),
  raw_data      JSONB,                    -- Datos completos del scraper
  processed     BOOLEAN DEFAULT false,
  listing_id    UUID REFERENCES listings(id),
  scraped_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_raw_posts_processed ON raw_posts(processed);
```

---

## API REST

### Endpoints

```
┌─────────┬──────────────────────────────────────────────┬──────────────────────┐
│ Método  │ Ruta                                         │ Descripción          │
├─────────┼──────────────────────────────────────────────┼──────────────────────┤
│ GET     │ /api/health                                  │ Health check         │
│ GET     │ /api/listings                                │ Listar listings      │
│ GET     │ /api/listings/:id                            │ Detalle de listing   │
│ GET     │ /api/categories                              │ Listar categorías    │
│ GET     │ /api/groups                                  │ Grupos monitoreados  │
│ POST    │ /api/scrape/trigger                          │ Trigger scrape manual│
│ GET     │ /api/scrape/status                           │ Estado del scheduler │
│ GET     │ /api/scrape/logs                             │ Historial de scrapes │
└─────────┴──────────────────────────────────────────────┴──────────────────────┘
```

### Parámetros de listado

```
GET /api/listings

Query params:
  category    string    Filtrar por categoría
  search      string    Búsqueda textual (tsvector)
  min_price   number    Precio mínimo
  max_price   number    Precio máximo
  status      string    active | sold | expired (default: active)
  group_id    string    Filtrar por grupo
  sort        string    newest | oldest | price_asc | price_desc (default: newest)
  page        number    Número de página (default: 1)
  limit       number    Items por página (default: 20, max: 100)
```

### Response format

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Lavadora 12kg",
      "price": 250.00,
      "currency": "USD",
      "category": "casa",
      "description": "Lavadora en excelente estado...",
      "contact_phone": "04121234567",
      "contact_name": "María",
      "location": "Caracas",
      "images": ["https://...", "https://..."],
      "source_group": "Ventas Caracas",
      "source_url": "https://facebook.com/groups/...",
      "whatsapp_link": "https://wa.me/584121234567?text=Hola%2C%20vi%20tu%20*Lavadora%2012kg*%20en%20*FB%20Store*...",
      "posted_at": "2026-05-24T10:30:00Z",
      "scraped_at": "2026-05-25T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## App Expo

### Pantallas

| Pantalla | Descripción |
|---|---|
| **Home** | Grid de listings. Imagen + precio + título. Scroll infinito. |
| **Categorías** | Lista de categorías con conteo. Al seleccionar → lista filtrada. |
| **Búsqueda** | Input de texto + filtros (categoría, precio min/max). |
| **Detalle** | Galería de imágenes, título, precio, descripción, info de contacto. |
| **Contactar** | Botón flotante "Contactar por WhatsApp". |

### Flujo de contacto

```
Usuario ve listing
  → Tapa "Contactar por WhatsApp"
  → Se abre WhatsApp con mensaje predefinido:
    "Hola, vi tu *{producto}* en *FB Store*.
     ¿Está disponible todavía?"
  → El vendedor recibe el mensaje
  → El vendedor ve el nombre de la app → exposición orgánica
```

### Implementación del enlace WhatsApp

```typescript
// src/utils/whatsapp.ts
export function getWhatsAppLink(phone: string, product: string, appName: string): string {
  const message = `Hola, vi tu *${product}* en *${appName}*. ¿Está disponible todavía?`
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  // Si el número no tiene código de país, asumir Venezuela (+58)
  const fullPhone = cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
}
```

### Stack de la app

- Expo SDK 52+
- React Navigation (bottom tabs + stack)
- TanStack Query (React Query) para data fetching
- expo-image para carga optimizada de imágenes
- expo-linking para deep links de WhatsApp
- FlashList (de Shopify) para scroll infinito

---

## Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: fbstore
      POSTGRES_USER: fbstore
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  api:
    build: ./api
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db
      - redis
    restart: unless-stopped

  scraper:
    build: ./scraper
    env_file: .env
    volumes:
      - ./cookies:/cookies          # Archivos de cookies montados
    depends_on:
      - api
      - redis
    restart: unless-stopped

  ai-processor:
    build: ./ai-processor
    env_file: .env
    depends_on:
      - api
      - redis
    restart: unless-stopped

volumes:
  pgdata:
```

### Requisitos del servidor

- VPS con Docker y Docker Compose
- 2GB RAM mínimo (recomendado 4GB)
- 20GB SSD
- CPU 2 cores
- Node.js 20+ (para builds)
- Python 3.11+ (para scraper)

---

## Costos Mensuales Estimados

| Recurso | Con facebook-scraper | Con Apify |
|---|---|---|
| VPS (2GB RAM, 2 cores) | ~$10-15 | ~$10-15 |
| Apify API | $0 | ~$5-20 |
| OpenAI API (GPT-4o mini) | ~$3-8 | ~$3-8 |
| Proxies (opcional) | ~$5-10 | $0 (incluidos en Apify) |
| **Total** | **~$18-33/mes** | **~$18-43/mes** |

*Asumiendo ~300-500 posts procesados por día, ~10 rondas de scraping.*

---

## Roadmap

### Leyenda

- 🔴 **Pendiente** — No started
- 🟡 **En progreso** — Working on it
- 🟢 **Completado** — Done
- ⚪ **Cancelado** — Won't do / deprecated

### Fase 1: MVP Core (Semana 1-2)

| ID | Tarea | Estado | Notas |
|---|---|---|---|
| 1.1 | Setup del proyecto (monorepo, Docker Compose, tooling) | 🔴 | |
| 1.2 | Scraper Python con facebook-scraper + cookies | 🔴 | |
| 1.3 | Abstracción de proveedor de scraping (interface) | 🔴 | |
| 1.4 | Schema PostgreSQL + migraciones | 🔴 | |
| 1.5 | API Express: endpoints CRUD de listings | 🔴 | |
| 1.6 | API Express: endpoint de búsqueda/texto | 🔴 | |
| 1.7 | AI Processor: integración OpenAI + prompt engineering | 🔴 | |
| 1.8 | BullMQ: scheduler + job queue | 🔴 | |
| 1.9 | Config vía env vars (cuentas, grupos, schedule) | 🔴 | |
| 1.10 | Rotación de cuentas por env var | 🔴 | |

### Fase 2: App Móvil (Semana 3)

| ID | Tarea | Estado | Notas |
|---|---|---|---|
| 2.1 | Expo project init + navegación | 🔴 | |
| 2.2 | Pantalla Home con grid de listings | 🔴 | |
| 2.3 | Pantalla de detalle con galería | 🔴 | |
| 2.4 | Pantalla de categorías | 🔴 | |
| 2.5 | Búsqueda + filtros | 🔴 | |
| 2.6 | Integración WhatsApp (wa.me link) | 🔴 | |
| 2.7 | Scroll infinito (FlashList) | 🔴 | |

### Fase 3: Producción (Semana 4)

| ID | Tarea | Estado | Notas |
|---|---|---|---|
| 3.1 | Docker Compose producción | 🔴 | |
| 3.2 | Health checks + logging | 🔴 | |
| 3.3 | Documentación de setup (README) | 🔴 | |
| 3.4 | Prueba con grupos reales | 🔴 | |
| 3.5 | Ajustes de prompt según data real | 🔴 | |

### Fase 4: Iteraciones post-MVP

| ID | Tarea | Estado | Prioridad |
|---|---|---|---|
| 4.1 | Fallback a Apify API | 🔴 | Media |
| 4.2 | Notificaciones push de nuevos listings | 🔴 | Baja |
| 4.3 | Autenticación de usuarios en la app | 🔴 | Baja |
| 4.4 | Que usuarios puedan publicar directamente | 🔴 | Baja |
| 4.5 | Moderación de listings | 🔴 | Baja |
| 4.6 | Múltiples ciudades/ubicaciones | 🔴 | Baja |
| 4.7 | Favoritos / guardar listings | 🔴 | Baja |

---

## Changelog

Todas las modificaciones importantes de este spec se registran aquí.

Formato: `[YYYY-MM-DD] - Tipo - Descripción`

### 2026-05-25

| Tipo | Descripción |
|---|---|
| **Creación** | Versión inicial del spec. Arquitectura, scraping, AI, DB, API, Expo, roadmap y costos. |

### Próximos cambios esperados

- Ajustes de prompt según data real de grupos
- Precios y monedas: definición exacta según los formatos que aparezcan
- Categorías: ajuste fino basado en tipos de productos reales
- Rate limiting: calibración según frecuencia real de publicaciones

---

*Este documento se actualiza a medida que el proyecto evoluciona. Última modificación: 2026-05-25.*
