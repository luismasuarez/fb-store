# Análisis del scrapper

**Session ID:** ses_0873e0178ffeWDJGWMDqtaAuqv
**Created:** 7/19/2026, 1:03:27 AM
**Updated:** 7/19/2026, 1:29:30 AM

---

## User

Analiza el scrapper en este proyecto, y dime como funciona

---

## Assistant

**Tool: task**

---

## Assistant

Claro, te explico cómo funciona el sistema de scraping. Es una **pipeline basada en colas (BullMQ + Redis)** con tres capas:

---

## Flujo completo

1. **Disparo**: Desde el Admin UI (React) o vía `POST /api/scrape`, el API (NestJS) encola un job en la cola BullMQ `"scrape"` con 3 reintentos y backoff exponencial.

2. **Worker**: El scraper (paquete independiente `packages/scraper/`) corre como un worker BullMQ con concurrencia 1. Toma los grupos activos desde la tabla `Group` en la BD.

3. **Scraping en sí** (`packages/scraper/src/index.ts`):
   - Lanza Playwright Chromium en **modo headless** usando un perfil persistente guardado (`profiles/cuenta-1`) — evita reloguearse cada vez.
   - Navega a `facebook.com/groups/{id}`, hace scroll y da clic en "Ver más" para cargar todos los posts.
   - Ejecuta un script **inline en el DOM** (`extractor.ts`) que extrae: ID del post, autor, timestamp, texto, imágenes, URL.
   - Descarga las imágenes como **data URLs** (base64).
   - Guarda los posts en la tabla `RawPost` via Prisma, saltando duplicados (código P2002).
   - Registra métricas en `ScrapeLog`.

4. **Handoff**: Si se guardaron posts nuevos, el worker encola automáticamente un job en la cola `"ai-process"` para que el AI Processor los procese.

---

## Componentes clave

| Archivo | Rol |
|---|---|
| `packages/scraper/src/index.ts` | Lógica principal: `scrapeGroup()`, `savePosts()`, `saveScrapeLog()` |
| `packages/scraper/src/worker.ts` | BullMQ Worker que orquesta el pipeline |
| `packages/scraper/src/browser.ts` | Lanza Chromium con perfil persistente (locale Venezuela, headless) |
| `packages/scraper/src/extractor.ts` | Script de extracción que se inyecta en el DOM de Facebook |
| `packages/scraper/src/login.ts` | Utilidad para login manual (no-headless), guarda sesión |
| `apps/api/src/features/scrape/` | Endpoints REST (`POST /api/scrape`, `GET /api/scrape/status/:jobId`) |
| `apps/api/src/infrastructure/queue/` | Fachada BullMQ, encola jobs con parámetros |

---

## Temas conocidos

- **SingletonLock crash**: Si el scraper se mata sucio, Chrome deja un lock file y falla el próximo inicio. Workaround: limpieza manual o copia temporal del perfil.
- **El prefijo BullMQ** (`BULL_PREFIX`) debe coincidir entre API (producer) y worker (consumer).
- Se requiere correr `pnpm setup:login` una vez para establecer la sesión de Facebook antes del primer scrape.

---

## User

Ahora mismo yo hago clic en Scrapear ahora, y no veo nada, ni un progreso, ni siquiera una promesa de notificacion cuando termine el scrapper. Otro problema que veo es que el scraper no es como un microservicio dentro de su contenedor, que tenga las vias para comunicarse con el y recibir data y devolver data, y lo que necesito es que el scraper en si sea un microservicio consultable por cualquier ente externo. El flujo que espero es algo como montar el scraper en un contenedor, y este expone una via o flujo o caso de uso, como lo quieras llamar, para que cualquiera que levante ese container, pueda hacer el login y que se queden el profile guardado, no se si es mejor dentro del container, o como un volumen de docker, con la opcion de mapearlo a uno externo en fs. Analiza mi feedback y dame la vision de lo que hay, y de lo que quiero lograr

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

**Tool: read**

**Tool: read**

**Tool: read**

---

## Assistant

## Estado actual

### Problema 1 — Sin feedback real

El flujo del Admin UI es:

```
Click "Scrapear ahora"
  → POST /api/scrape
    → API encola en BullMQ (Redis)
    → responde 202 { jobId }  ← INMEDIATO
  → useMutation se resuelve   ← INMEDIATO
  → Muestra "✅ Scrape completado exitosamente" ← FALSO, el scraper ni empezó
```

El `isPending` dura milisegundos. El usuario nunca ve progreso real ni recibe notificación cuando termina. El frontend no pollsea el estado del job (`GET /api/scrape/status/:jobId` existe pero no se usa).

### Problema 2 — Scraper no es consultable

Hoy el scraper es un **BullMQ Worker pasivo**: se sienta a esperar jobs de Redis, no expone ninguna interfaz (HTTP, gRPC, socket). Para comunicarte con él tenés que:

1. Tener acceso a Redis
2. Tener una instancia del API de NestJS que encola
3. No podés consultarlo directamente desde afuera del ecosistema

No hay manera de que "cualquier ente externo" le pida algo.

### Problema 3 — Login no está containerizado

`pnpm setup:login` corre `login.ts` que abre Chromium local (no-headless=false). En Docker no hay display, así que no podés loguearte desde el container. El profile se monta como volumen, pero el setup inicial requiere ejecución fuera del container.

---

## Visión de lo que debería ser

El scraper como **microservicio autónomo y consultable**, con esta forma:

```
┌───────────────────────────────────────────────────────────┐
│  SCRAPER CONTAINER (HTTP server)                          │
│                                                           │
│  POST /scraper/login     → Lanza Chrome (Xvfb + noVNC)    │
│  POST /scraper/scrape    → Dispara scraping (sync o job)  │
│  GET  /scraper/status/:id → Progreso en tiempo real (SSE) │
│  GET  /scraper/profiles  → Lista perfiles disponibles     │
│  POST /scraper/profiles  → Crea/cambia perfil             │
│  GET  /scraper/health    → Health check                   │
│                                                           │
│  [Express/Fastify server]                                 │
│  [BullMQ Worker interno — opcional]                       │
│                                                           │
│  Volumen: /app/profiles/{nombre}  ← mapeable desde fuera  │
└───────────────────────────────────────────────────────────┘
```

### Cambios clave

| Aspecto | Hoy → Meta |
|---|---|
| **Interfaz** | BullMQ worker pasivo → HTTP server con endpoints |
| **Feedback UI** | Falso "completado" inmediato → SSE con progreso real + notificación al final |
| **Login** | Script local fuera de Docker → Endpoint que inicia Chrome con Xvfb + noVNC, el usuario hace login desde el browser, perfil se guarda en el volumen |
| **Perfiles** | Uno fijo (`cuenta-1`) → Múltiples, gestionables via API |
| **Consulta externa** | Solo via Redis+API → HTTP directo, cualquier cliente puede hablarle |
| **Pipeline** | Solo queue-based → Híbrido: HTTP directo Y opcionalmente BullMQ |

¿Voy por buen camino con esta visión? Hay varias decisiones de diseño que discutir (SSE vs WebSocket, qué framework HTTP, si mantener BullMQ como opción o migrar todo a HTTP).

**Tool: question**

---

## Assistant

Bien. Acá va el diseño de la API del scraper como microservicio HTTP.

---

## Contrato de la API REST

```
Base URL: http://scraper:3001/api/v1
```

### Perfiles (multi-cuenta)

```
GET    /profiles
       → 200 { profiles: [{ name, createdAt, lastUsedAt, isLoggedIn }] }

POST   /profiles
       Body: { name: string }
       → 201 { name, path }

DELETE /profiles/:name
       → 204
```

### Login (containerizado con Xvfb + noVNC)

```
POST   /login
       Body: { profile: string }
       → 201 { vncUrl: "http://scraper:6080/vnc.html?password=xxx", profile }

GET    /login/:profile/status
       → 200 { profile, state: "idle" | "login-in-progress" | "logged-in" }
```

El scraper arranca Xvfb en segundo plano. Cuando llega un `POST /login`, lanza Chromium apuntando al display virtual. noVNC corre en el puerto 6080. El usuario abre `http://scraper:6080` en su navegador, ve la pantalla de Facebook, se loguea manualmente, cierra Chrome, y el perfil persiste en el volumen.

### Scraping

```
POST   /scrape
       Body: {
         groupId?: string          → busca grupo en DB
         url?: string             → URL directa de Facebook (alternativa a groupId)
         maxPosts?: number        → default del grupo o 20
         profile?: string         → "cuenta-1" default
         wait?: boolean           → false = async (default), true = bloqueante
       }
       wait=false → 202 { jobId }
       wait=true  → 200 { posts: [...], metrics: { postsFound, postsNew, durationMs } }

GET    /scrape/:jobId
       → 200 { jobId, status: "pending"|"running"|"completed"|"failed",
               progress?: { current, total, phase },
               result?: { posts, metrics },
               failedReason?: string }

GET    /scrape/:jobId/events
       → SSE stream (text/event-stream)
         event: progress  → { phase: "navigating"|"scrolling"|"extracting"|"downloading"|"saving", current, total }
         event: log       → { message: string }
         event: complete  → { posts, metrics }
         event: error     → { message }
```

### Health

```
GET    /health → 200 { status: "ok", uptime, profiles, chrome }
GET    /ready  → 200 { ready: true }
```

---

## Integración con el ecosistema actual

Actualmente el API de NestJS encola en BullMQ → Redis → scraper worker. Con la nueva arquitectura:

**Opción A — Puente HTTP (recomendada):**
```
NestJS API ya NO encola en BullMQ para scraper
  → llama a POST http://scraper:3001/api/v1/scrape (HTTP directo)
  → recibe jobId
  → Admin UI usa el SSE endpoint del scraper directamente
BullMQ se elimina de la ecuación del scraper
```

**Opción B — Híbrida:**
```
NestJS API encola en BullMQ como hoy
  → scraper worker escucha BullMQ Y también sirve HTTP
  → ambas vías conviven
```

Yo recomendaría la **Opción A** (eliminar BullMQ del scraper) porque:
- El scraper se vuelve independiente de Redis
- Cualquier cliente HTTP puede usarlo sin el ecosistema NestJS
- Reducís latencia (Redis hop) y complejidad operativa

El AI-processor pipeline se mantiene: el scraper llama al AI-processor vía HTTP al terminar, o el API de NestJS orquesta ambos.

---

## Preguntas para definir

1. **Framework HTTP**: ¿Express (simple, conocido) o Fastify (más rápido, schema validation nativo)?
2. **Opción A vs B**: ¿Scraper completamente independiente de BullMQ o híbrido?
3. **Grupos sin DB**: ¿Soportar `url` directa en `POST /scrape` para que el scraper funcione sin depender de la base de datos (scrape standalone)?

**Tool: question**

---

## Assistant

Buena pregunta. Te explico los enfoques:

### .env → No escalable
Como ya notaste, poner IDs en `.env` implica:
- Cambiar config + redeploy cada vez que querés scrapear un grupo nuevo
- Sin visibilidad desde la UI
- Imposible para múltiples grupos dinámicos

### DB via UI → Escalable pero acoplado
Lo que ya tienen es correcto para el **sistema integrado**:
- CRUD de grupos en Admin UI → se guardan en PostgreSQL
- El scraper lee de la DB: `Group.findMany({ where: { isActive: true } })`
- Sumás/quitar grupos desde la UI, sin tocar config
- Cada grupo tiene su propia configuración (maxPosts, etc.)

Esto escala bien y es flexible *dentro del ecosistema*.

### El problema
Si el scraper **solo** acepta `groupId` (que resuelve contra la DB), entonces cualquier ente externo que quiera usarlo necesita:
1. Tener acceso a tu DB
2. Saber los IDs internos (UUIDs) no los de Facebook
3. Pre-registrar el grupo via Admin UI antes de scrapear

Eso rompe la idea de "microservicio consultable por cualquiera".

---

### Solución que recomiendo: Soportar ambos

```
POST /scrape

Modo DB (para el sistema integrado):
  { groupId: "uuid-del-grupo-en-db" }
  → Busca el grupo en DB, usa su config

Modo URL directa (para consumo externo / standalone):
  { url: "https://facebook.com/groups/859317869284157" }
  → No necesita DB, usa el ID de Facebook directamente
```

Así:
- **Admin UI** → siempre usa `groupId` (el grupo ya existe en DB)
- **Externo/API pública** → pasa la URL de Facebook y listo
- **El scraper es autónomo**: no requiere DB para funcionar, la DB es opcional para features avanzados
- **Escalable**: podés tener 100 grupos en DB o mandar URLs desde un script, ambas vías funcionan

¿Te parece bien ese enfoque? Si es así, paso a redactar el plan de implementación completo con la API, estructura de archivos, y cambios necesarios.

---

## User

Asi me parece bien, ahora quiero entender los casos de uso que vamos teniendo hasta ahora. Lo que yo me imagino es tenidno un container, que al ejecutarlo me da ventajas como de tener una UI en algun puerto como para hacer el login de facebook, y ya tener un profile, o varios profiles, y que esa ui me brinde ver los perfiles que ya el contenedor tiene, y quizas cada profile con un boton que yo le de check para saber si dicho profile esta vivo aun. Tambien alguna endpoint o via para consultar sin ui. Con respecto al framework, aun tengo dudas de si es necesario fastify o express, o si hay alguna opcion mejor para ese caso de uso en general. Tambien tengo dudas de si estamos usando las herramientas mas optimas y mejoras para lo que quiero lograr.

---

## Assistant

Buenas preguntas. Analicemos todo.

---

## Casos de uso del scraper container

```
┌─────────────────────────────────────────────────────────────┐
│  SCRAPER CONTAINER                                          │
│                                                             │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │  HTTP Server :3001   │    │  noVNC :6080             │    │
│  │  ─ API REST         │    │  (web VNC client)        │    │
│  │  ─ Dashboard UI     │    └──────────────────────────┘    │
│  └─────────────────────┘                                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Profiles (Docker volume /app/profiles/)              │   │
│  │  cuenta-1/   cuenta-2/   cuenta-3/                    │   │
│  │  └── Chrome session data (cookies, localStorage…)    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chromium (Playwright)                                │   │
│  │  Login  → headless=false → Xvfb :99 → capturado por  │   │
│  │           noVNC → lo ves en el browser                │   │
│  │  Scrape → headless=true  → Xvfb :99 → sin display    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### UI de gestión (Dashboard en el scraper, no en Admin)

Puerto aparte (ej: `:3001/dashboard`), con:

| Vista | Qué hace |
|---|---|
| **Lista de perfiles** | Muestra los profiles disponibles, su estado |
| **Login** | Botón "Iniciar sesión" → abre el VNC en otra pestaña, Chrome ya cargó Facebook, hacés login manual |
| **Verificar sesión** | Botón "Verificar" → lanza Chrome headless, navega a Facebook, detecta si sigue logueado o pide login |
| **Scrape rápido** | Input de URL de grupo + botón "Scrapear" para probar sin pasar por el Admin |

### API endpoints (sin UI)

```
GET    /api/v1/profiles                 → Lista perfiles con estado
POST   /api/v1/profiles                 → Crear perfil nuevo
DELETE /api/v1/profiles/:name           → Borrar perfil

POST   /api/v1/login                    → Inicia Chrome + VNC para login
       Body: { profile: "cuenta-1" }
       → 201 { vncUrl, profile }

GET    /api/v1/profiles/:name/check     → Verifica si la sesión sigue viva
       → 200 { alive: true/false, reason? }

POST   /api/v1/scrape                   → Scrapea (con groupId o url directa)
GET    /api/v1/scrape/:jobId            → Estado del job
GET    /api/v1/scrape/:jobId/events     → SSE progreso en tiempo real
```

---

## Sobre el framework

Tu duda es válida. Analicemos:

| | Express | Fastify | **Hono** |
|---|---|---|---|
| Tamaño | ~1MB+ deps | ~2MB+ deps | **~18KB, 0 deps** |
| SSE nativo | ❌ hay que agregar | ❌ hay que agregar | **✅ `hono/streaming`** |
| Static files | ✅ serve-static | ✅ @fastify/static | **✅ serve-static** |
| TypeScript | ✅ | ✅ | **✅ Excelente** |
| Perf | Medio | Alto | **Muy alto** |
| Ideal para container | ❌ Pesado | ❌ Pesado | **✅ Liviano** |

**Hono** es el que mejor calza para este caso:
- Arranca al toque (ideal para health checks de container)
- Mínimo footprint en la imagen Docker
- SSE built-in para el progreso en tiempo real
- Soporta servir HTML/JS estático para el dashboard
- API similar a Express (curva baja)

---

## Sobre las herramientas en general

| Herramienta | Status | Recomendación |
|---|---|---|
| **Playwright** | ✅ Excelente | Seguí usándolo |
| **TypeScript** | ✅ | Seguí |
| **BullMQ/Redis** | ❌ A eliminar del scraper | Ya decidimos Opción A |
| **Prisma** | ✅ Para DB | Seguí (solo para groups cuando usa DB mode) |
| **pnpm** | ✅ | Seguí |
| **HTML dashboard** | 💡 A agregar | Recomiendo **htmx** + HTML plano — sin build step, cero deps JS, renderizado server-side desde Hono |

---

## Check de sesión ("perfil vivo")

El check es simple:

```
POST /api/v1/profiles/:name/check

1. Lanza Chromium con el perfil (headless)
2. Navega a https://facebook.com/
3. Detecta:
   - ¿Aparece el feed? → alive: true
   - ¿Redirige a /login/? → alive: false
   - ¿Error de red / captcha? → alive: unknown
4. Cierra el browser
```

Esto es barato (~5-10s) y se puede hacer desde el dashboard con un botón, o automatizado.

---

¿Te parece bien la dirección con **Hono + dashboard embebido + noVNC**? Si querés puedo profundizar en algún punto específico antes de armar el plan de implementación.

---

## User

Si, esa direccion me parece la mejor, ahora dame un plan de como vamos 

---

## Assistant

---

