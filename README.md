# FB Store

Extrae publicaciones de grupos de Facebook, las procesa con IA y las sirve vía API REST con un panel admin. Todo en un monorepo.

## Stack

| Componente | Tecnología |
|---|---|
| API | NestJS 11 + Fastify 5 + Prisma 7 |
| Admin | Vite + React 19 + shadcn/ui |
| Scraper | Playwright 1.60 (Chromium) |
| AI | OpenRouter (gpt-4o-mini) |
| DB | PostgreSQL 18 |
| Infra | Docker Compose |
| Monorepo | pnpm + Turborepo |

## Docker (todo en uno)

```bash
pnpm docker:full
```

Abre `http://localhost:3000` — Admin SPA + API en el mismo puerto.

Para empaquetar el profile de Facebook logueado y subirlo a un deploy:

```bash
pnpm docker:profile:pack    # genera profiles/cuenta-1.tar.gz
```

## Scripts principales

| Comando | Descripción |
|---|---|
| `pnpm docker:full` | Build + levanta stack completo (API + Admin + Scraper + AI + Postgres) |
| `pnpm dev` | API en desarrollo |
| `pnpm dev:admin` | Admin en desarrollo (Vite con proxy a API) |
| `pnpm scrape` | Ejecuta scraper (requiere profile logueado) |
| `pnpm ai:process` | Procesa raw_posts con IA |
| `pnpm db:studio` | Prisma Studio |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/listings` | Listings con filtros (province, property_type, price, etc.) |
| GET | `/api/listings/:id` | Detalle de listing |
| GET | `/api/raw-posts` | Posts crudos de Facebook |
| POST | `/api/scrape` | Ejecuta scraper |
| POST | `/api/ai-process` | Ejecuta AI processor |

## Estructura

```
apps/
├── api/              # NestJS + Fastify
├── admin/            # Vite + React (SPA)
packages/
├── shared/           # Prisma schema, Zod schemas, tipos
├── scraper/          # Playwright
└── ai-processor/     # OpenRouter
```
