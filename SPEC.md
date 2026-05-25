# FB Store — Especificación Técnica

> **MVP**: Automatización para extraer publicaciones de grupos de Facebook, procesarlas con IA, almacenarlas y consultarlas desde una app móvil Expo.

---

## Índice

- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Monorepo](#estructura-del-monorepo)
- [Arquitectura General](#arquitectura-general)
- [Estrategia de Scraping](#estrategia-de-scraping)
- [AI Processing — Modular](#ai-processing--modular)
- [Schedule Strategy](#schedule-strategy)
- [Base de Datos](#base-de-datos)
- [API REST](#api-rest)
- [App Expo](#app-expo)
- [Deployment](#deployment)
- [Costos](#costos)
- [Roadmap](#roadmap)
- [Changelog](#changelog)

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| API Server | NestJS + Fastify | `11.1.24` + `5.8.5` |
| ORM | Prisma | `7.8.0` |
| Job Queue | BullMQ + Redis (ioredis) | `5.77.3` |
| Validación | Zod | `4.4.3` |
| Scraper | Node.js + Playwright | `1.52.x` |
| AI Processing | Multi-provider (OpenAI, Anthropic, OpenRouter) | SDKs latest |
| Base de datos | PostgreSQL | 16 |
| Admin (Fase 0) | Prisma Studio | incluido |
| Admin (post-MVP) | Vite + React + shadcn/ui + Tailwind 4 | Vite `8.0.14`, React `19.2.6` |
| Cliente móvil | Expo + React Native | SDK `56` (RN `0.85`, React `19.2.3`) |
| Mobile state | Zustand + TanStack Query | `5.0.13` + `5.100.14` |
| Infraestructura | Docker Compose | — |
| TypeScript | TypeScript | `6.0.3` |
| Node.js | Node.js | `22.13.x`+ |

---

## Estructura del Monorepo

```
fb-store/
├── package.json                   # npm workspaces root
├── tsconfig.base.json             # Base TS config compartida
├── .env.example
├── docker-compose.yml
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.scraper
│   └── Dockerfile.ai-processor
│
├── apps/                          # Aplicaciones desplegables
│   ├── api/                       # NestJS + Fastify + Prisma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── prisma/
│   │       │   ├── prisma.module.ts
│   │       │   └── prisma.service.ts
│   │       ├── listings/
│   │       │   ├── listings.module.ts
│   │       │   ├── listings.controller.ts
│   │       │   └── listings.service.ts
│   │       ├── groups/
│   │       ├── scrape/
│   │       └── common/
│   │           ├── dto/            # Zod schemas como DTOs
│   │           └── filters/        # Exception filters (Fastify)
│   │
│   ├── admin/                     # Vite + React + shadcn/ui
│   │   ├── package.json           # Post-MVP, no tocar en Fase 0
│   │   └── ...
│   │
│   └── expo/                      # Expo SDK 56
│       ├── app.json
│       ├── package.json
│       └── src/
│           ├── App.tsx
│           ├── screens/
│           │   ├── HomeScreen.tsx
│           │   ├── DetailScreen.tsx
│           │   ├── CategoriesScreen.tsx
│           │   └── SearchScreen.tsx
│           ├── components/
│           │   ├── ListingCard.tsx
│           │   └── CategoryBadge.tsx
│           ├── api/
│           │   └── client.ts
│           ├── store/
│           │   ├── filters.ts      # Zustand
│           │   └── favorites.ts
│           └── utils/
│               └── whatsapp.ts
│
├── packages/                      # Librerías compartidas
│   ├── shared/                    # Cero dependencias externas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       │   ├── listing.ts
│   │       │   ├── group.ts
│   │       │   ├── scraper.ts
│   │       │   └── config.ts
│   │       ├── ai/
│   │       │   ├── provider.ts     # AIProvider interface
│   │       │   ├── registry.ts     # Provider registry
│   │       │   ├── openai.ts
│   │       │   ├── anthropic.ts
│   │       │   └── prompt.ts       # Prompt engineering
│   │       ├── schemas/            # Zod schemas compartidos
│   │       │   ├── listing.schema.ts
│   │       │   ├── config.schema.ts
│   │       │   └── scrape.schema.ts
│   │       └── utils/
│   │           ├── whatsapp.ts
│   │           └── sanitize.ts      # Limpieza de texto HTML/DOM
│   │
│   ├── scraper/                    # Playwright + BullMQ worker
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # BullMQ worker
│   │       ├── browser.ts          # Context manager (launchPersistentContext)
│   │       ├── login.ts            # npm run setup:login
│   │       ├── extractor.ts        # Extracción DOM → RawPost
│   │       ├── behavior.ts         # Rate limiting, scroll pausado
│   │       └── config.ts
│   │
│   └── ai-processor/               # BullMQ worker
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── worker.ts
│           └── extract.ts
│
└── profiles/                       # Perfiles Chrome (gitignored)
    └── cuenta-1/
```

### Reglas del monorepo

- **`packages/shared`** no depende de nada externo. Solo TypeScript + Zod.
- **`packages/scraper`** solo depende de `shared` + Playwright + sanitize-html + BullMQ.
- **`packages/ai-processor`** solo depende de `shared` + provider SDKs + BullMQ.
- **`apps/api`** depende de `shared` + NestJS + Prisma + BullMQ.
- **`apps/admin`** se construye post-MVP. En Fase 0 se usa **Prisma Studio** como admin visual.
- **`apps/expo`** puede duplicar tipos si es necesario (Expo no siempre resuelve workspaces bien).

### Dependencias por paquete

| Paquete | Dependencias externas |
|---|---|
| `shared` | `zod@4.4.3` |
| `scraper` | `playwright@1.52.x`, `bullmq@5.77.3`, `sanitize-html`, `shared` |
| `ai-processor` | `bullmq@5.77.3`, `openai`, `@anthropic-ai/sdk`, `shared` |
| `api` | `@nestjs/core@11.1.24`, `@nestjs/platform-fastify@11.1.24`, `@nestjs/bullmq@11.0.4`, `@nestjs/config`, `@prisma/client@7.8.0`, `prisma@7.8.0` (dev), `ioredis`, `zod@4.4.3`, `shared` |
| `expo` | Expo SDK 56 + RN 0.85 + React 19.2.3, `expo-image`, `expo-linking`, `@shopify/flash-list`, `@react-navigation/native@7.2.5`, `native-stack@7.16.0`, `bottom-tabs@7.16.2`, `@tanstack/react-query@5.100.14`, `zustand@5.0.13` |

---

## Arquitectura General

```
                          ┌──────────────────┐
                          │   PostgreSQL      │
                          └────────┬─────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
   │  Scraper      │       │  API          │       │  AI Processor    │
   │  (Playwright) │       │  (NestJS +    │       │  (BullMQ worker) │
   │  BullMQ worker│       │   Fastify)    │       │                  │
   └──────┬───────┘       └──────┬───────┘       └───────┬──────────┘
          │                      │                       │
          └──────────┬───────────┴───────────┬───────────┘
                     │                       │
                     ▼                       ▼
              ┌──────────┐          ┌──────────────┐
              │  Redis    │          │  Prisma       │
              │ (BullMQ)  │          │  Studio       │
              └──────────┘          │  (Fase 0)     │
                                    └──────────────┘

                            ▲ API REST
                            │
                    ┌───────┴───────┐
                    │   Expo App    │
                    │   (Mobile)    │
                    └───────────────┘
```

### Flujo de datos

1. **Scheduler** (BullMQ CRON) dispara job de scraping
2. **Scraper** abre contexto headless con perfil persistente (Playwright), navega al grupo, extrae posts del DOM
3. **Texto crudo** se sanitiza (quitar HTML rotos, entidades, normalizar saltos)
4. **Raw posts** se guardan en `raw_posts` + `listings` (con campos vacíos antes del AI)
5. **AI Processor** toma posts no-procesados de la cola, los envía al provider configurado
6. **Provider** (OpenAI / Anthropic / OpenRouter) devuelve JSON estructurado
7. **Listings se actualizan** con datos estructurados (título, precio, categoría, contacto)
8. **API REST** expone endpoints para app y admin
9. **Expo App** consume la API y muestra listings
10. **Prisma Studio** (Fase 0) permite ver y editar datos directamente en DB

---

## Estrategia de Scraping

### Enfoque: Playwright + perfil Chrome persistente

No hay APIs intermedias ni librerías frágiles de terceros. Playwright abre Chromium headless con un perfil real de Chrome que contiene la sesión de Facebook intacta.

```
Setup (1 vez, en tu máquina local):

  npm run setup:login

  1. Playwright abre Chrome con ventana (headed)
  2. Tú haces login en Facebook (email + OTP) normalmente
  3. Cierras el browser
  4. El perfil completo se guarda en ./profiles/cuenta-1/
  5. Subes la carpeta al server: rsync -av ./profiles/ user@server:/opt/fb-store/profiles/

Producción (en el server):

  1. Playwright abre Chrome headless
  2. launchPersistentContext('/data/profiles/cuenta-1/')
  3. Facebook ve el MISMO browser, misma sesión, mismo perfil
  4. Sin cookies que expiren, sin relogueo
```

`launchPersistentContext` guarda cookies, localStorage, indexedDB, service workers, cache. Cuando abres headless con ese mismo perfil, Facebook te reconoce como "el navegador de siempre".

### Extracción de datos (sin interacción)

Las publicaciones de Facebook truncan el texto visualmente con CSS (`-webkit-line-clamp`), pero el texto completo **sí está en el DOM**. Lo extraes directamente sin clicks ni expansiones.

```typescript
// packages/scraper/src/extractor.ts

interface RawPost {
  fbPostId: string;
  text: string;
  images: string[];
  author: string;
  authorUrl: string;
  timestamp: string;
  postUrl: string;
}

function extractPostData(postEl: Element): RawPost | null {
  const text = postEl.querySelector('[data-ad-preview="message"]')?.textContent ?? '';
  if (!text.trim()) return null;

  return {
    fbPostId: postEl.getAttribute('data-store') ?? crypto.randomUUID(),
    text,
    images: Array.from(postEl.querySelectorAll('img[src*="scontent"]'))
      .map(img => (img as HTMLImageElement).src)
      .filter(src => src.includes('/') && !src.includes('emoji')),
    author: postEl.querySelector('h2 a, h3 a, h4 a')?.textContent ?? '',
    authorUrl: postEl.querySelector('h2 a, h3 a, h4 a')?.getAttribute('href') ?? '',
    timestamp: postEl.querySelector('abbr')?.getAttribute('title')
      ?? postEl.querySelector('abbr')?.textContent ?? '',
    postUrl: postEl.querySelector('a[href*="/posts/"]')?.getAttribute('href') ?? '',
  };
}
```

### Sanitización del texto

Antes de guardar o enviar al LLM, el texto extraído del DOM se limpia:

```typescript
// packages/shared/src/utils/sanitize.ts
// Dependencia: sanitize-html

import sanitizeHtml from 'sanitize-html';

export function sanitizeFacebookText(raw: string): string {
  // Remueve HTML no deseado, normaliza espacios, entidades
  const cleaned = sanitizeHtml(raw, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

### Anti-detección

| Medida | Detalle |
|---|---|
| Perfil persistente | `launchPersistentContext` con userDataDir del perfil real |
| Flag webdriver oculto | `--disable-blink-features=AutomationControlled` |
| Rate limiting progresivo | Scroll pausado: 1 pantalla cada 3-5 segundos |
| Pausa entre grupos | 10-15 minutos entre grupo y grupo |
| Schedule variable | Horarios distintos cada día (ver sección Schedule Strategy) |
| Rotación de cuentas | Múltiples perfiles en env vars, se cambia con índice |

No se necesita: proxies residenciales, rotación de user agents, mouse movements, headed mode en producción, VNC, fingerprint injection.

### Ritmo de scraping

```typescript
// packages/scraper/src/behavior.ts

async function scrapeGroup(context: BrowserContext, group: GroupConfig): Promise<RawPost[]> {
  const page = await context.newPage();
  const posts: RawPost[] = [];

  try {
    await page.goto(`https://facebook.com/groups/${group.id}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const scrollsNeeded = Math.ceil(group.maxPosts / 5);

    for (let i = 0; i < scrollsNeeded; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(3000 + Math.random() * 2000);

      const batch = await page.evaluate(() => {
        const elements = document.querySelectorAll('[data-pagelet^="FeedUnit"]');
        return Array.from(elements).map(extractPostData).filter(Boolean);
      });

      posts.push(...batch);
    }
  } finally {
    await page.close();
  }

  return [...new Map(posts.map(p => [p.fbPostId, p])).values()];
}
```

**Tiempos para 10 grupos:**
- Por grupo: ~2-3 minutos (6-10 scrolls con pausas)
- Pausa entre grupos: ~12 minutos promedio
- Ronda completa: ~2-2.5 horas
- 2-3 rondas al día → ~5-7 horas en ventana diurna

---

## AI Processing — Modular

### Interfaz compartida

```typescript
// packages/shared/src/ai/provider.ts

export interface AIProvider {
  name: string;
  extract(rawText: string, imageUrls?: string[]): Promise<StructuredListing>;
}

export interface StructuredListing {
  title: string | null;
  price: number | null;
  currency: 'Bs' | 'USD' | null;
  category: Category | null;
  description: string | null;
  contactPhone: string | null;
  contactName: string | null;
  location: string | null;
  isAvailable: boolean;
  confidence: number;
}

export type Category =
  | 'casa' | 'cocina' | 'aseo' | 'electronica'
  | 'ropa' | 'vehiculos' | 'muebles' | 'otros';
```

### Registry de providers

```typescript
// packages/shared/src/ai/registry.ts

const providers = new Map<string, new (apiKey: string, model: string) => AIProvider>();

export function registerProvider(name: string, ctor: new (apiKey: string, model: string) => AIProvider) {
  providers.set(name, ctor);
}

export function getProvider(config: AIProviderConfig): AIProvider {
  const ctor = providers.get(config.provider);
  if (!ctor) throw new Error(`Unknown AI provider: ${config.provider}`);
  return new ctor(config.apiKey, config.model);
}
```

### Providers implementados

| Provider | Código | Endpoint |
|---|---|---|
| OpenAI | `packages/shared/src/ai/openai.ts` | `api.openai.com/v1/chat/completions` |
| Anthropic | `packages/shared/src/ai/anthropic.ts` | `api.anthropic.com/v1/messages` |
| OpenRouter | `packages/shared/src/ai/openrouter.ts` | `openrouter.ai/api/v1/chat/completions` |

OpenRouter no necesita SDK — usa fetch directo. Soporta modelos gratuitos (rate-limited) que pueden reducir costo de AI a $0.

### Prompt compartido

```typescript
// packages/shared/src/ai/prompt.ts

export const PROMPT_SYSTEM = `
Eres un extractor de datos de publicaciones de compra/venta en Facebook.
Analiza el texto y responde SOLO con JSON válido, sin explicaciones.

Campos:
- title: nombre del producto (máx 80 chars). null si no identificas producto.
- price: número sin símbolos. null si no hay precio.
- currency: "Bs" o "USD". null si no se especifica.
- category: una de: casa, cocina, aseo, electronica, ropa, vehiculos, muebles, otros.
- description: texto completo del producto.
- contactPhone: número venezolano (0412, 0424, 0416, 0426). null si no aparece.
- contactName: nombre del vendedor. null si no aparece.
- location: ciudad o zona. null si no aparece.
- isAvailable: true/false. false si dice "vendido", "reservado", "dado".
- confidence: número del 0 al 1 indicando qué tan seguro estás de los datos extraídos.

Reglas:
- Si el texto no parece una publicación de venta, confidence < 0.3
- No inventes datos. Si no está en el texto, null.
- Precios en bolívares asume Bs, en dólares asume USD.
`;
```

### Configuración

```bash
# === AI PROVIDER ===
# "openai" | "anthropic" | "openrouter"
AI_PROVIDER="openrouter"
AI_MODEL="openai/gpt-4o-mini"
AI_API_KEY="sk-..."

# OpenRouter extras (opcional)
OPENROUTER_API_KEY=""
OPENROUTER_REFERER="https://fbstore.app"
```

---

## Schedule Strategy

> **📌 Pendiente de definir en detalle.** Implementar en Fase 3.

### Idea general

Intervalos variables por día de la semana para romper patrones predecibles:

| Día | Intervalo base | Rondas | Ventana |
|---|---|---|---|
| Lunes | 4h | 3 | 8:00-22:00 |
| Martes | 6h | 2 | 8:00-22:00 |
| Miércoles | 3h | 4 | 8:00-22:00 |
| Jueves | 5h | 2 | 8:00-22:00 |
| Viernes | 4h | 3 | 8:00-22:00 |
| Sábado | 6h | 2 | 10:00-20:00 |
| Domingo | 8h | 1 | 10:00-18:00 |

Variaciones adicionales: offset aleatorio (±30min), skip probabilístico (10%).

### Para Fase 0

Intervalo fijo simple (ej: cada 4 horas en horario diurno). La lógica variable se implementa en Fase 3.

---

## Base de Datos

### Esquema Prisma

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Listing {
  id            String   @id @default(uuid()) @db.Uuid
  fbPostId      String   @unique @map("fb_post_id")
  title         String?
  price         Decimal? @db.Decimal(10, 2)
  currency      String   @default("Bs")
  category      String?
  description   String?
  contactPhone  String?  @map("contact_phone")
  contactName   String?  @map("contact_name")
  location      String?
  images        Json     @default("[]")
  sourceGroup   String?  @map("source_group")
  sourceGroupId String?  @map("source_group_id")
  sourceUrl     String?  @map("source_url")
  rawText       String?  @map("raw_text")
  status        String   @default("active")
  aiConfidence  Decimal? @db.Decimal(3, 2) @map("ai_confidence")
  postedAt      DateTime? @map("posted_at")
  scrapedAt     DateTime @default(now()) @map("scraped_at")
  processedAt   DateTime? @map("processed_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([category])
  @@index([status])
  @@index([scrapedAt(sort: Desc)])
  @@map("listings")
}

model Group {
  id          String   @id
  name        String
  url         String?
  maxPosts    Int      @default(30) @map("max_posts")
  lastScraped DateTime? @map("last_scraped")
  lastError   String?  @map("last_error")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("groups")
}

model ScrapeLog {
  id           String   @id @default(uuid()) @db.Uuid
  groupId      String   @map("group_id")
  accountIndex Int      @map("account_index")
  postsFound   Int      @default(0) @map("posts_found")
  postsNew     Int      @default(0) @map("posts_new")
  postsErrors  Int      @default(0) @map("posts_errors")
  startedAt    DateTime @default(now()) @map("started_at")
  finishedAt   DateTime? @map("finished_at")
  durationMs   Int?     @map("duration_ms")
  error        String?

  @@map("scrape_logs")
}

model RawPost {
  id          String    @id @default(uuid()) @db.Uuid
  fbPostId    String    @map("fb_post_id")
  groupId     String?   @map("group_id")
  rawData     Json?     @map("raw_data")
  textContent String?   @map("text_content")
  processed   Boolean   @default(false)
  listingId   String?   @map("listing_id") @db.Uuid
  aiProvider  String?   @map("ai_provider")
  scrapedAt   DateTime  @default(now()) @map("scraped_at")
  listing     Listing?  @relation(fields: [listingId], references: [id])

  @@index([processed])
  @@index([fbPostId])
  @@map("raw_posts")
}
```

---

## API REST

### Endpoints

```
┌─────────┬─────────────────────────────────────────────────┬──────────────────────────┐
│ Método  │ Ruta                                            │ Descripción              │
├─────────┼─────────────────────────────────────────────────┼──────────────────────────┤
│ GET     │ /api/health                                     │ Health check             │
│ GET     │ /api/listings                                   │ Listar listings          │
│ GET     │ /api/listings/:id                               │ Detalle de listing       │
│ GET     │ /api/categories                                 │ Listar categorías        │
│ GET     │ /api/groups                                     │ Grupos monitoreados      │
│ POST    │ /api/scrape/trigger                             │ Trigger scrape manual    │
│ GET     │ /api/scrape/status                              │ Estado del scheduler     │
│ GET     │ /api/scrape/logs                                │ Historial de scrapes     │
│ GET     │ /api/raw-posts                                  │ Posts crudos (Fase 0)    │
└─────────┴─────────────────────────────────────────────────┴──────────────────────────┘
```

### Parámetros de listado

```
GET /api/listings

Query params:
  category    string    Filtrar por categoría
  search      string    Búsqueda textual
  min_price   number    Precio mínimo
  max_price   number    Precio máximo
  status      string    active | sold | expired (default: active)
  group_id    string    Filtrar por grupo
  sort        string    newest | oldest | price_asc | price_desc (default: newest)
  page        number    Página (default: 1)
  limit       number    Items (default: 20, max: 100)
```

### Estructura NestJS (esquemática)

```typescript
// apps/api/src/listings/listings.controller.ts

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @HttpCode(200)
  async findAll(
    @Query(new ZodValidationPipe(ListingQuerySchema)) query: ListingQueryDto
  ): Promise<PaginatedResponse<ListingResponse>> {
    return this.listingsService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ListingResponse> {
    return this.listingsService.findOne(id);
  }
}
```

Los DTOs se validan con Zod 4 mediante un `ZodValidationPipe` que transforma el schema al DTO tipado. Esto también alimenta `@nestjs/swagger` para documentación OpenAPI automática.

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
      "images": ["https://..."],
      "source_group": "Ventas Caracas",
      "source_url": "https://facebook.com/groups/...",
      "whatsapp_link": "https://wa.me/584121234567?...",
      "ai_confidence": 0.92,
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

### Pantallas (Fase 0)

| Pantalla | Descripción |
|---|---|
| **Home** | Grid de listings. Imagen + precio + título. Scroll infinito (FlashList). |
| **Detalle** | Imágenes, descripción, datos de contacto, botón WhatsApp. |
| **Categorías** | Filtro por categoría con conteo de resultados. |
| **Búsqueda** | Input + filtros combinados (categoría, precio). |

### Flujo de contacto

```
Usuario ve listing
  → Tapa "Contactar por WhatsApp"
  → Se abre WhatsApp con mensaje:
    "Hola, vi tu *{producto}* en *FB Store*.
     ¿Está disponible todavía?"
  → El vendedor ve el nombre de la app → exposición orgánica
```

### Implementación del enlace WhatsApp

```typescript
// packages/shared/src/utils/whatsapp.ts

export function getWhatsAppLink(phone: string, product: string, appName: string): string {
  const message = `Hola, vi tu *${product}* en *${appName}*. ¿Está disponible todavía?`
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  const fullPhone = cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone}`
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
}
```

### Stack de la app

```
@tanstack/react-query 5.100.14   ← Server state
zustand 5.0.13                   ← Client state (filtros, favoritos)
@shopify/flash-list 2.3.1       ← Scroll infinito eficiente
expo-image ~56.0.9              ← Imágenes optimizadas
expo-linking ~56.0.11           ← Deep links WhatsApp
```

---

## Deployment

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: fbstore
      POSTGRES_USER: fbstore
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    ports:
      - "5432:5432"

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db
      - redis
    restart: unless-stopped

  scraper:
    build:
      context: .
      dockerfile: docker/Dockerfile.scraper
    env_file: .env
    volumes:
      - ./profiles:/data/profiles
    depends_on:
      - redis
      - db
    restart: unless-stopped

  ai-processor:
    build:
      context: .
      dockerfile: docker/Dockerfile.ai-processor
    env_file: .env
    depends_on:
      - redis
      - db
    restart: unless-stopped

volumes:
  pgdata:
```

### Comandos útiles

```bash
# Setup de perfil (1 vez en PC local)
npm run setup:login

# Ver data en DB (Fase 0 admin)
npx prisma studio

# Ver jobs en cola
npx bullmq-dashboard

# Logs del scraper
docker compose logs -f scraper
```

### Setup de perfiles

```bash
# En tu máquina local con interfaz gráfica:
npm run setup:login

# 1. Playwright abre Chrome headed
# 2. Navega a facebook.com
# 3. Espera a que hagas login manualmente
# 4. Guarda el perfil completo en ./profiles/cuenta-1/
# 5. Cierra

# Luego subes los perfiles al server:
rsync -av ./profiles/ usuario@server:/opt/fb-store/profiles/
```

### Requisitos del servidor

- VPS con Docker y Docker Compose
- 2GB RAM mínimo (recomendado 4GB)
- 20GB SSD
- CPU 2 cores
- Node.js 22.13.x+

---

## Costos Mensuales Estimados

| Recurso | Costo |
|---|---|
| VPS (2GB RAM, 2 cores) | ~$10-15 |
| AI Provider (OpenAI/OpenRouter) | ~$3-8* |
| **Total** | **~$13-23/mes** |

*OpenRouter tiene modelos gratuitos (rate-limited) que pueden reducir a $0.

---

## Roadmap

### Leyenda

- 🔴 **Pendiente**
- 🟡 **En progreso**
- 🟢 **Completado**
- ⚪ **Cancelado / Postergado**

---

### Fase 0: "Primeros datos" (ahora)

> Objetivo: scrapear 1-2 grupos y ver los posts en crudo en la app. Admin vía Prisma Studio.

| # | Tarea | Dependencias clave | Estado |
|---|---|---|---|
| 0.1 | Monorepo: npm workspaces + tsconfig base | — | 🔴 |
| 0.2 | `shared`: types + schemas Zod + utils (sanitize, whatsapp) | `zod@4.4.3` | 🔴 |
| 0.3 | `scraper`: Docker + Chromium + Playwright | `playwright@1.52.x` | 🔴 |
| 0.4 | Script `setup:login` (headed local, guarda perfil) | Playwright headed | 🔴 |
| 0.5 | `scraper`: extracción DOM de 1 grupo + sanitizado | `sanitize-html` | 🔴 |
| 0.6 | `api`: NestJS + Fastify + Prisma schema + migraciones | `@nestjs/*`, `prisma@7.8.0`, `fastify@5.8.5` | 🔴 |
| 0.7 | `api`: endpoints GET /api/raw-posts + GET /api/listings | `zod`, `@nestjs/swagger` | 🔴 |
| 0.8 | `expo`: proyecto init + HomeScreen con posts desde API | Expo SDK 56, `@tanstack/react-query`, `flash-list` | 🔴 |
| 0.9 | Prueba E2E: scraper → DB → API → app | — | 🔴 |

---

### Fase 1: MVP Core (después de Fase 0)

| # | Tarea | Estado |
|---|---|---|
| 1.1 | AIProvider interface + registry (OpenAI, Anthropic, OpenRouter) | 🔴 |
| 1.2 | `ai-processor`: BullMQ worker con multi-provider | 🔴 |
| 1.3 | `scraper`: múltiples grupos + rate limiting progresivo + dedup | 🔴 |
| 1.4 | `scraper`: rotación de cuentas por env var | 🔴 |
| 1.5 | `api`: categorías, búsqueda tsvector, paginación completa | 🔴 |
| 1.6 | BullMQ scheduler con horario configurable | 🔴 |

---

### Fase 2: App Móvil Completa

| # | Tarea | Estado |
|---|---|---|
| 2.1 | Pantalla Detalle con galería de imágenes | 🔴 |
| 2.2 | Pantalla Categorías con filtro | 🔴 |
| 2.3 | Búsqueda + filtros combinados | 🔴 |
| 2.4 | Integración WhatsApp | 🔴 |

---

### Fase 3: Schedule Inteligente

| # | Tarea | Prioridad |
|---|---|---|
| 3.1 | Schedule variable por día de la semana | Media |
| 3.2 | Offset aleatorio + jitter | Media |
| 3.3 | Skip probabilístico | Baja |

---

### Fase 4: Admin Panel

| # | Tarea | Prioridad |
|---|---|---|
| 4.1 | Vite + React + shadcn/ui + Tailwind 4 | Media |
| 4.2 | Login / autenticación | Baja |
| 4.3 | Tablero de listings con CRUD | Media |
| 4.4 | Historial de scrapes | Baja |
| 4.5 | Configuración de grupos desde UI | Baja |

---

### Fase 5: Post-MVP

| # | Tarea | Prioridad |
|---|---|---|
| 5.1 | Notificaciones push de nuevos listings | Baja |
| 5.2 | Autenticación de usuarios en la app | Baja |
| 5.3 | Publicación directa desde la app | Baja |
| 5.4 | Favoritos / guardar listings | Baja |

---

## Changelog

### 2026-05-25

| Tipo | Descripción |
|---|---|
| **Creación** | Versión inicial del spec. |
| **Actualización** | Scraper: Python/facebook-scraper → Node.js + Playwright con `launchPersistentContext`. Sin Apify, proxies, VNC, Xvfb. Setup login local 1 vez. |
| **Actualización** | AI Provider modular: interfaz `AIProvider` + registry. OpenAI, Anthropic, OpenRouter (incluye modelos gratis). |
| **Actualización** | Monorepo: npm workspaces con `apps/` (api, admin, expo) + `packages/` (shared, scraper, ai-processor). `shared` sin dependencias externas. |
| **Actualización** | Stack finalizado: NestJS 11 + Fastify 5 + Prisma 7 + Zod 4 + TypeScript 6 + Expo SDK 56 (RN 0.85, React 19). Versiones concretas y lockeadas por paquete. |
| **Actualización** | Admin: Postergado a Fase 4. En Fase 0 se usa Prisma Studio. |
| **Actualización** | Schedule Strategy: sección agregada como pendiente (Fase 3). |
| **Actualización** | Roadmap: Fase 0 (primeros datos) → Fase 1 (MVP Core) → Fase 2 (App) → Fase 3 (Schedule) → Fase 4 (Admin) → Fase 5 (Post-MVP). |
| **Actualización** | Agregadas dependencias faltantes: `ioredis`, `sanitize-html`, `openai`, `@anthropic-ai/sdk`, `@nestjs/config`, `@nestjs/swagger`, `@anatine/zod-nestjs`. |

---

*Este documento se actualiza a medida que el proyecto evoluciona. Última modificación: 2026-05-25.*
