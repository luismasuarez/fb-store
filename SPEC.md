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
| Scraper | Node.js + Playwright + `launchPersistentContext` | Mismo lenguaje que API, sesión persistente real, extracción vía DOM |
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
│  │  (Playwright) │    │ (BullMQ) │    │  (Express)    │   │
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
2. **Scraper** abre contexto headless con perfil persistente, navega al grupo, extrae posts del DOM
3. **Posts crudos** se guardan en `raw_posts` + `raw_text`
4. **AI Processor** toma posts nuevos, los envía al LLM, extrae estructura
5. **Datos estructurados** se guardan en `listings` con dedup por `fb_post_id`
6. **API REST** expone los listings filtrables
7. **Expo App** consulta la API y muestra al usuario

---

## Estrategia de Scraping

### Enfoque: Playwright + perfil Chrome persistente

No hay APIs intermedias, no hay librerías frágiles de terceros. Playwright abre Chromium headless con un perfil real de Chrome que contiene la sesión de Facebook intacta.

```
┌─────────────────────────────────────────────────────────┐
│  Setup (1 vez, en tu máquina local)                      │
│                                                         │
│  npm run setup:login                                    │
│  → Playwright abre Chrome (headed, con ventana)          │
│  → Logeas en Facebook con email + OTP                   │
│  → Cierras el browser                                   │
│  → El perfil completo se guarda en ./profiles/fb-cuenta-1/│
│  → Subes la carpeta al server (rsync/scp)               │
│                                                         │
│  Producción (en el server)                               │
│  → Playwright abre Chrome headless                      │
│  → launchPersistentContext('/data/profiles/fb-cuenta-1/')│
│  → Facebook ve EL MISMO browser, misma sesión            │
│  → Sin cookies que expiren, sin relogueo                 │
└─────────────────────────────────────────────────────────┘
```

Por qué funciona: `launchPersistentContext` guarda todo — cookies, localStorage, indexedDB, service workers, cache. Cuando abres headless con ese mismo perfil, Facebook te reconoce como el navegador de siempre.

### Extracción de datos (sin interacción)

Las publicaciones de Facebook truncan el texto visualmente con CSS (`-webkit-line-clamp`), pero el texto completo **sí está en el DOM**. Lo extraes directamente sin clicks, sin expansiones, sin interactuar con la página.

```typescript
// El texto completo está disponible en textContent aunque esté truncado visualmente
function extractPostData(postEl: Element): RawPost {
  return {
    text: postEl.querySelector('[data-ad-preview="message"]')?.textContent ?? '',
    images: Array.from(postEl.querySelectorAll('img[src*="scontent"]'))
      .map(img => (img as HTMLImageElement).src)
      .filter(src => !src.includes('emoji')),
    author: postEl.querySelector('h2 a, h3 a, h4 a')?.textContent ?? '',
    timestamp: postEl.querySelector('abbr')?.getAttribute('title') ?? '',
    postUrl: postEl.querySelector('a[href*="/posts/"]')?.getAttribute('href') ?? '',
  };
}
```

### Anti-detección (lo mínimo necesario)

| Medida | Detalle |
|---|---|
| Perfil persistente | `launchPersistentContext` con userDataDir del perfil real |
| Flag webdriver oculto | `--disable-blink-features=AutomationControlled` |
| Rate limiting progresivo | Scroll pausado: 1 pantalla cada 3-5 segundos |
| Pausa entre grupos | 10-15 minutos entre grupo y grupo |
| Schedule diurno | Solo entre 8:00–22:00, 2-3 rondas por día |
| Rotación de cuentas | Múltiples perfiles, se cambia con una env var |

No se necesita: proxies residenciales, rotación de user agents, mouse movements, headed mode, VNC, fingerprint injection, ni nada adicional. La sesión real + ritmo pausado es suficiente.

### Ritmo de scraping (progresivo, no bulk)

```typescript
// Por grupo: scroll de a poco, pausa, extrae, siguiente
for (const group of groups) {
  const page = await context.newPage();
  await page.goto(`https://facebook.com/groups/${group.id}`, {
    waitUntil: 'networkidle',
  });

  for (let i = 0; i < group.maxPosts / 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(3000 + Math.random() * 2000); // 3-5s entre scrolls

    const posts = await page.evaluate(extractVisiblePosts);
    await sendToQueue(posts);
  }

  await page.close();

  // Pausa real entre grupos (10-15 min)
  const pauseMs = (10 + Math.random() * 5) * 60 * 1000;
  await page.waitForTimeout(pauseMs);
}
```

**Tiempos realistas para 10 grupos:**
- Por grupo: ~2-3 minutos (scrolleando lento)
- Pausa entre grupos: ~12 minutos promedio
- Ronda completa: ~2-2.5 horas
- 3 rondas al día → ~6-7 horas de "actividad" distribuidas en horario diurno

### Configuración (environment variables)

```bash
# === CUENTAS DE FACEBOOK ===
# Array JSON de cuentas. Cada una con ruta al perfil de Chrome persistente.
FB_ACCOUNTS='[
  {"email": "cuenta1@email.com", "profile": "/data/profiles/cuenta1"},
  {"email": "cuenta2@email.com", "profile": "/data/profiles/cuenta2"}
]'
# Índice de la cuenta activa (0-based). Cambiar si la actual es baneada.
ACTIVE_ACCOUNT_INDEX=0

# === GRUPOS A SCRAPEAR ===
# Array JSON de grupos.
FB_GROUPS='[
  {"id": "123456789", "name": "Ventas Caracas", "max_posts": 30},
  {"id": "987654321", "name": "Marketplace Venezuela", "max_posts": 20}
]'

# === SCHEDULE ===
SCRAPE_INTERVAL_MINUTES=180
SCRAPE_HOURS_START=8
SCRAPE_HOURS_END=22

# === DATABASE ===
DATABASE_URL="postgresql://user:pass@db:5432/fbstore"

# === REDIS ===
REDIS_URL="redis://redis:6379"

# === AI ===
AI_PROVIDER="openai"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
AI_MODEL="gpt-4o"
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
| Moneda ambigua | Inferir del contexto (dolar, $ → USD; bs, bolos → Bs) |
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
      - ./profiles:/data/profiles      # Perfiles de Chrome persistentes
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

### Setup de perfiles (1 vez)

```bash
# En tu máquina local con interfaz gráfica:
npm run setup:login

# Esto corre un script con Playwright headed que:
# 1. Abre Chrome
# 2. Navega a facebook.com
# 3. Espera a que hagas login manualmente
# 4. Guarda el perfil completo en ./profiles/fb-cuenta-1/
# 5. Cierra

# Luego subes los perfiles al server:
rsync -av ./profiles/ usuario@server:/opt/fb-store/profiles/
```

### Requisitos del servidor

- VPS con Docker y Docker Compose
- 2GB RAM mínimo (recomendado 4GB)
- 20GB SSD
- CPU 2 cores
- Node.js 20+ (para builds)
- Playwright system dependencies (instaladas vía Dockerfile)

---

## Costos Mensuales Estimados

| Recurso | Costo |
|---|---|
| VPS (2GB RAM, 2 cores) | ~$10-15 |
| OpenAI API (GPT-4o mini) | ~$3-8 |
| **Total** | **~$13-23/mes** |

*Asumiendo ~300-500 posts procesados por día, ~3 rondas de scraping.*

---

## Roadmap

### Leyenda

- 🔴 **Pendiente**
- 🟡 **En progreso**
- 🟢 **Completado**
- ⚪ **Cancelado**

### Fase 1: MVP Core (Semana 1-2)

| ID | Tarea | Estado |
|---|---|---|
| 1.1 | Setup del proyecto (monorepo, Docker Compose, tooling) | 🔴 |
| 1.2 | Docker con Playwright + Chromium + dependencias | 🔴 |
| 1.3 | Script de setup: login local con Playwright headed, guarda perfil | 🔴 |
| 1.4 | Scraper headless con `launchPersistentContext` + extracción DOM | 🔴 |
| 1.5 | Rate limiting progresivo: scroll pausado, pausa entre grupos | 🔴 |
| 1.6 | Schema PostgreSQL + migraciones | 🔴 |
| 1.7 | API Express: endpoints CRUD de listings + búsqueda | 🔴 |
| 1.8 | AI Processor: integración OpenAI + prompt engineering | 🔴 |
| 1.9 | BullMQ: scheduler + job queue + schedule configurable | 🔴 |
| 1.10 | Config vía env vars (cuentas, grupos, schedule, rotación) | 🔴 |

### Fase 2: App Móvil (Semana 3)

| ID | Tarea | Estado |
|---|---|---|
| 2.1 | Expo project init + navegación | 🔴 |
| 2.2 | Pantalla Home con grid de listings | 🔴 |
| 2.3 | Pantalla de detalle con galería | 🔴 |
| 2.4 | Pantalla de categorías | 🔴 |
| 2.5 | Búsqueda + filtros | 🔴 |
| 2.6 | Integración WhatsApp (wa.me link) | 🔴 |
| 2.7 | Scroll infinito (FlashList) | 🔴 |

### Fase 3: Producción (Semana 4)

| ID | Tarea | Estado |
|---|---|---|
| 3.1 | Health checks + logging estructurado | 🔴 |
| 3.2 | Documentación de setup (README) | 🔴 |
| 3.3 | Prueba con grupos reales | 🔴 |
| 3.4 | Ajustes de prompt según data real | 🔴 |

### Fase 4: Iteraciones post-MVP

| ID | Tarea | Prioridad |
|---|---|---|
| 4.1 | Notificaciones push de nuevos listings | Baja |
| 4.2 | Autenticación de usuarios en la app | Baja |
| 4.3 | Publicación directa desde la app | Baja |
| 4.4 | Favoritos / guardar listings | Baja |
| 4.5 | Múltiples ubicaciones | Baja |

---

## Changelog

### 2026-05-25

| Tipo | Descripción |
|---|---|
| **Creación** | Versión inicial del spec. |
| **Actualización** | Scraper migrado de Python/facebook-scraper a Node.js + Playwright con `launchPersistentContext`. Eliminado: Apify fallback, proxies, VNC, Xvfb, mouse movements, headed mode en producción. Agregado: setup de login local (1 vez headed), scraping headless con perfil persistente, rate limiting progresivo sin artificios. Roadmap simplificado. |

---

*Este documento se actualiza a medida que el proyecto evoluciona. Última modificación: 2026-05-25.*
