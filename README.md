# FB Store

Automatización para extraer publicaciones de grupos de Facebook, procesarlas con IA y consultarlas desde una API.

## Stack

| Componente | Tecnología |
|---|---|
| API | NestJS 11 + Fastify 5 |
| ORM | Prisma 7 (PostgreSQL) |
| Job Queue | BullMQ + Redis |
| Scraper | Playwright 1.52 |
| AI | Multi-provider (OpenAI, Anthropic, OpenRouter) |
| Admin (Fase 0) | Prisma Studio |
| Admin (post-MVP) | Vite + React + shadcn/ui |
| Cliente móvil | Expo SDK 56 (postergado) |
| Infra | Docker Compose |
| Monorepo | pnpm + Turborepo |

## Requisitos

- Node.js >= 22.13 + pnpm 10
- Docker + Docker Compose

## Setup rápido

```bash
cp .env.example .env        # editar credenciales
pnpm install                # instalar dependencias
pnpm db:migrate             # aplicar migraciones
npm run dev                 # local: http://localhost:3000/api/health
```

## Docker (stack completo)

```bash
npm run docker:up           # levanta postgres + redis + api
npm run docker:down         # detiene todo
npm run docker:logs         # logs en tiempo real
```

La API responde en `http://localhost:3000/api/health`.

## Scripts útiles

| Comando | Descripción |
|---|---|
| `pnpm dev` | API en modo desarrollo (hot-reload) |
| `npm run docker:up` | Build + levanta stack completo |
| `pnpm db:generate` | Regenera cliente Prisma |
| `pnpm db:migrate` | Crea migración + aplica |
| `pnpm db:studio` | Prisma Studio (admin liviano) |
| `pnpm db:push` | Push schema a DB sin migración |

## Estructura

```
fb-store/
├── apps/
│   ├── api/          # NestJS + Fastify + Swagger
│   ├── admin/        # Vite + React (post-MVP)
│   └── expo/         # App móvil (postergado)
├── packages/
│   ├── shared/       # Prisma schema, client, Zod schemas
│   ├── scraper/      # Playwright worker (Fase 1)
│   └── ai-processor/ # AI extraction worker (Fase 2)
├── docker/           # Dockerfiles multi-stage
└── docker-compose.yml
```

## Roadmap

- **Fase 0** — Scraper funcional + Prisma Studio para visualización
- **Fase 1** — API con endpoints de listings + Swagger
- **Fase 2** — AI Processor + modo headless programado
- **Fase 3** — Admin panel web
- **Fase 4** — App Expo + push notifications
