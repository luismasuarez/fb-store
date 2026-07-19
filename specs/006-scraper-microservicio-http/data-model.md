# Data Model: Scraper HTTP Microservice

**Branch**: `006-scraper-microservicio-http` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

## Overview

El scraper maneja tres tipos de datos: (1) **profiles** en el filesystem, (2) **jobs** en memoria, (3) **posts extraídos** en PostgreSQL (vía Prisma, solo en DB mode). No se introducen nuevas tablas en la base de datos — las entidades `RawPost` y `ScrapeLog` ya existen y se reutilizan.

## Entity: Profile

Un perfil es un directorio en el filesystem que contiene los datos de sesión de Chromium (cookies, localStorage, indexedDB). Es el equivalente a un perfil de Chrome de toda la vida.

**Storage**: Docker volume `/app/profiles/{name}/`

**Metadata**: Archivo JSON en `/app/profiles/{name}/.meta.json`

```json
{
  "name": "cuenta-1",
  "createdAt": "2026-07-19T12:00:00.000Z",
  "lastUsedAt": "2026-07-19T14:30:00.000Z",
  "loginStatus": "unknown"
}
```

**States**:
- `unknown` — no se ha verificado aún
- `alive` — la sesión de Facebook es válida (se ve el feed)
- `dead` — la sesión expiró (redirige a /login/)
- `locked` — Chrome está en uso (lock file presente)

**Validation rules**:
- Nombre: solo alfanumérico + guiones (`^[a-zA-Z0-9_-]+$`)
- No se permite sobrescribir un perfil existente en creación
- Perfiles no vacíos no se pueden eliminar si están en uso (locked)

## Entity: ScrapeJob (in-memory)

Un job se crea cuando se recibe un POST /scrape. Vive en un `Map<string, JobState>` en memoria.

```typescript
interface JobState {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  config: {
    url?: string;        // URL directa de grupo
    groupId?: string;    // groupId desde DB
    maxPosts: number;
    profile: string;
  };
  progress: {
    phase: "queued" | "navigating" | "scrolling" | "extracting" | "downloading" | "saving";
    current: number;
    total: number;
  };
  result?: {
    posts: RawPost[];
    metrics: {
      postsFound: number;
      postsNew: number;
      durationMs: number;
    };
  };
  failedReason?: string;
  createdAt: Date;
  sseClients: Set<SSEClient>;  // conexiones SSE activas
}
```

**Lifecycle**: `pending → running → completed | failed`

**Edge cases**:
- Si el container se reinicia, todos los jobs se pierden (datos efímeros)
- Si un job está running y llega otro scrape para el mismo perfil, se rechaza con 409 Conflict
- Si un job está pending (en cola esperando turno) y llega otro para el mismo perfil, se encola detrás

## Entity: ScrapeProgress (SSE Event)

Eventos emitidos durante la ejecución de un scrape, transmitidos vía SSE a los clientes suscritos.

```typescript
type ProgressEvent =
  | { type: "progress"; phase: string; current: number; total: number; message?: string }
  | { type: "log"; message: string }
  | { type: "complete"; result: { posts: RawPost[]; metrics: ScrapeMetrics } }
  | { type: "error"; message: string };
```

**Fases de progreso**:
| Phase | Qué significa | current/total |
|-------|---------------|---------------|
| `queued` | Esperando turno (perfil en uso) | posición en cola |
| `navigating` | Navegando a la URL del grupo | timeout restante (s) |
| `scrolling` | Haciendo scroll para cargar posts | scroll N / total scrolls |
| `extracting` | Ejecutando script de extracción en el DOM | posts encontrados |
| `downloading` | Descargando imágenes como data URLs | imagen N / total imágenes |
| `saving` | Guardando posts en la base de datos | post N / total posts nuevos |

## Entity: FacebookSession

Representa el resultado de verificar si un perfil sigue logueado en Facebook.

```typescript
interface FacebookSession {
  profile: string;
  alive: boolean;
  reason?: "feed-visible" | "redirected-to-login" | "network-error" | "chrome-error";
  checkedAt: string; // ISO timestamp
}
```

**States**:
| alive | reason | Significado |
|-------|--------|-------------|
| true | feed-visible | Se ve el feed de Facebook → sesión activa |
| false | redirected-to-login | Redirige a /login/ → sesión expirada |
| false | network-error | No se pudo cargar Facebook (red/container) |
| false | chrome-error | Error al lanzar Chromium |

## Relaciones con entidades existentes (DB)

| Entidad | Tabla | Relación |
|---------|-------|----------|
| `RawPost` | `raw_posts` | Creada por `savePosts()` cuando se usa DB mode. Misma estructura que hoy. |
| `ScrapeLog` | `scrape_logs` | Creada por `saveScrapeLog()` cuando se usa DB mode. Misma estructura que hoy. |
| `Group` | `groups` | Consultada por `groupId` cuando se usa DB mode. Campos usados: id, name, maxPosts, isActive. |

No se agregan nuevas tablas. Las entidades existentes son suficientes.
