# Research: Scraper como Microservicio HTTP Autónomo

**Branch**: `006-scraper-microservicio-http` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

## Key Decisions

### D1. Framework HTTP

| Aspect | Detail |
|--------|--------|
| **Decision** | Hono |
| **Rationale** | ~18KB, 0 dependencias, SSE nativo vía `hono/streaming`, soporte de archivos estáticos, API similar a Express (curva baja). Ideal para containers livianos. |
| **Alternatives considered** | Express (~1MB deps, sin SSE nativo, necesita middleware externo). Fastify (~2MB deps, sobredimensionado para este caso de uso). Ambos agregan peso innecesario a la imagen Docker. |
| **References** | Documentación de Hono: https://hono.dev/docs/getting-started/nodejs |

### D2. Dashboard UI

| Aspect | Detail |
|--------|--------|
| **Decision** | HTML plano + htmx via CDN |
| **Rationale** | Sin build step, cero deps JavaScript en el proyecto, renderizado server-side desde Hono. El dashboard es una herramienta operativa interna, no necesita SPA. |
| **Alternatives considered** | React (requiere Vite/build step, sobreingeniería). Alpine.js (liviano pero agrega dependencia JS). Sin dashboard (el usuario pidió expresamente una UI). |
| **References** | htmx: https://htmx.org |

### D3. Login Containerizado (VNC)

| Aspect | Detail |
|--------|--------|
| **Decision** | Xvfb :99 + x11vnc :5900 + websockify/noVNC :6080 |
| **Rationale** | Estándar de facto para browser automation containerizada. Xvfb provee display virtual, x11vnc lo expone como VNC, websockify convierte VNC a WebSocket para noVNC (cliente web). El operador abre `http://scraper:6080` en su navegador y ve la pantalla de Chrome. |
| **Alternatives considered** | Selenium Grid (infraestructura pesada, sobreingeniería). Chrome Remote Desktop (orientado a escritorios completos, no a containers). Puppeteer extra (similar a Playwright, no resuelve el display). |
| **References** | noVNC: https://github.com/novnc/noVNC, x11vnc: https://github.com/LibVNC/x11vnc |

### D4. Job Tracking

| Aspect | Detail |
|--------|--------|
| **Decision** | Mapa en memoria (`Map<jobId, JobState>`) |
| **Rationale** | Los jobs de scraping son efímeros (minutos de duración). No necesitan persistencia entre reinicios del container. Si el container se cae, los jobs en ejecución se pierden — el operador reintenta. Un Map en memoria es simple, rápido, y no agrega dependencias. |
| **Alternatives considered** | SQLite (persistencia innecesaria, I/O extra). BullMQ/Redis (eliminado por decisión de diseño). Prisma/PostgreSQL (pesado para tracking transitorio). |
| **References** | Ninguna — patrón estándar de tracking en memoria. |

### D5. Serialización de Scrapes por Perfil

| Aspect | Detail |
|--------|--------|
| **Decision** | Un job de scrape por perfil a la vez. Si llega un segundo request para el mismo perfil mientras hay uno activo, se encola en espera. |
| **Rationale** | Chromium no soporta múltiples contextos simultáneos en el mismo perfil sin corrupción de datos. Playwright's `launchPersistentContext` adquiere un lock sobre el directorio del perfil. Intentar lanzar dos contextos sobre el mismo perfil causa error SingletonLock. |
| **Alternatives considered** | Crear copias temporales del perfil (complejo, riesgo de inconsistencia). Perfiles independientes por scrape (cada perfil es independiente y puede scrappear en paralelo). |
| **References** | Playwright docs: BrowserContext, launchPersistentContext |

### D6. Validación de Requests

| Aspect | Detail |
|--------|--------|
| **Decision** | Zod 4 (misma versión que el resto del proyecto) |
| **Rationale** | El proyecto ya usa Zod 4 para validación. Mantener consistencia. Hono no tiene validación integrada pero se integra fácilmente con Zod vía un helper inline. |
| **Alternatives considered** | Validación manual (propenso a errores). TypeBox (alternativa válida pero introduce nueva dependencia). Hono Zod OpenAPI (sobredimensionado, agrega generación de OpenAPI que no necesitamos). |
| **References** | Zod: https://zod.dev |

### D7. Integración con NestJS API

| Aspect | Detail |
|--------|--------|
| **Decision** | NestJS API llama al scraper vía HTTP directo. El `QueueService` existente mantiene solo la cola `ai-process` para el AI processor. |
| **Rationale** | El scraper ya no necesita BullMQ. La comunicación es HTTP síncrono (el API encola un job y recibe jobId). El API de NestJS actúa como orquestador: llama al scraper, y cuando el scraper termina, el API encola un job en BullMQ para el AI processor. El Admin UI se suscribe al SSE del scraper directamente para progreso real. |
| **Alternatives considered** | Scraper llama al API NestJS cuando termina (inversión de dependencia, el scraper conocería al API). Scraper encola directamente en BullMQ AI queue (mantiene dependencia de Redis en el scraper). |
| **References** | Ninguna — patrón de orquestación estándar. |

### D9. Metadata de Perfiles (Implementación)

| Aspect | Detail |
|--------|--------|
| **Decision** | Archivo `.meta.json` por perfil en el filesystem |
| **Rationale** | 1-10 perfiles, metadata plana (4 campos), sin necesidad de queries. Cero dependencias — SQLite requiere native addon que complica el Dockerfile. Postgres/Prisma es overkill para 4 fields por perfil. El edge case de race condition no aplica porque por diseño solo un request a la vez por perfil. |
| **Alternatives considered** | SQLite con `better-sqlite3` (~5MB native addon, build tools en Docker). Postgres via Prisma (conexión de red, schema migration, overkill). |
| **References** | Decisión tomada durante implementación con el usuario. |

### D10. Rutas de Health Endpoints

| Aspect | Detail |
|--------|--------|
| **Decision** | Health endpoints se montan en `/` y `/api/v1` simultáneamente. Auth middleware excluye ambos sets de paths. |
| **Rationale** | Los health endpoints deben ser accesibles sin API key. Montarlos en ambos niveles permite compatibilidad: `/health` para accesos internos del container (Docker healthcheck) y `/api/v1/health` para consistencia con el resto de la API. El auth middleware debe listar explícitamente todos los paths públicos. |
| **Alternatives considered** | Mover health solo a `/api/v1` (rompe healthchecks de Docker que apuntan a `/ready`). Usar un prefijo de excepción tipo regex en auth (más complejo, menos explícito). |
| **References** | Bug descubierto en testing: `auth.ts` solo excluía `/health` y `/ready`, no `/api/v1/health`. |

### D11. Consistencia de Directorio de Perfiles

| Aspect | Detail |
|--------|--------|
| **Decision** | `browser.ts` usa `PROFILE_DIR/env` + `name` en vez de hardcodear `profiles/{name}`. `profile-manager.ts` delega en `getProfileBaseDir()` de browser.ts. |
| **Rationale** | Originalmente `browser.ts` hardcodeaba `path.resolve(PROJECT_ROOT, "profiles", name)`. Esto creaba inconsistencia: el scraper usaba un directorio y el profile-manager otro (`PROFILE_DIR` env var). Unificando ambos detrás de `getProfileBaseDir()` se garantiza que scrape y gestión de perfiles apunten al mismo lugar. |
| **Alternatives considered** | Mover la lógica de directorio a una utility separada (sobreingeniería para una sola función). |
| **References** | Bug reportado por el usuario: `PROFILE_DIR` no era respetado por el flujo de scrape. |

### D12. Persistencia de Session Check en .meta.json

| Aspect | Detail |
|--------|--------|
| **Decision** | `checkSession()` escribe `loginStatus` y `lastUsedAt` en `.meta.json` después de verificar la sesión. |
| **Rationale** | Originalmente `checkSession()` solo retornaba el resultado pero nunca lo persistía. El perfil quedaba siempre como `"unknown"` incluso después de verificaciones exitosas. Persistiendo el resultado, el dashboard puede mostrar el estado real sin ejecutar un checkSession (que toma ~15s por perfil). |
| **Alternatives considered** | Mantenerlo volátil (cada GET /profiles requeriría checkSession, lento). Cache en memoria (se pierde al reiniciar el servidor). |
| **References** | Reportado por el usuario durante testing: perfil mostraba "unknown" tras checkSession exitoso. |

### D13. Proxy SSE en NestJS (Fastify)

| Aspect | Detail |
|--------|--------|
| **Decision** | Usar `reply.hijack()` de Fastify + `Readable.fromWeb()` para pipe del SSE stream desde el scraper. |
| **Rationale** | NestJS usa Fastify como adapter HTTP. No hay middleware SSE nativo para Fastify. La alternativa de configurar CORS en el scraper y apuntar el Admin UI directamente requería exponer el scraper al navegador y configuración de CORS. El proxy vía NestJS mantiene una sola puerta de entrada a la API. |
| **Alternatives considered** | CORS directo desde el scraper (expone internals del scraper al browser, más superficie de ataque). SSE library para NestJS (dependencia extra). |
| **References** | Implementado en `apps/api/src/features/scrape/api/scrape.controller.ts`. |

### D14. Inyección de API Key en Dashboard

| Aspect | Detail |
|--------|--------|
| **Decision** | El dashboard HTML recibe `SCRAPER_API_KEY` como placeholder reemplazado server-side. |
| **Rationale** | Las peticiones htmx desde el dashboard necesitan enviar `x-api-key` header. Inyectar la key server-side evita que el operador tenga que configurarla manualmente en el HTML. Es seguro porque el dashboard solo es accesible dentro de la red interna del container. |
| **Alternatives considered** | Prompt al operador para que ingrese la key (UX pobre). Cookie con la key (inseguro). Proxy de requests via backend (complejidad extra). |
| **References** | Template string `__SCRAPER_API_KEY__` en `dashboard.html` reemplazado en `server.ts:41`. |

### D15. Login via Playwright vs Spawn (Implementación)

| Aspect | Detail |
|--------|--------|
| **Decision** | Usar `chromium.launchPersistentContext` de Playwright en vez de `child_process.spawn` para el login interactivo. Fallback a Chrome del sistema si Playwright Chromium no está instalado. |
| **Rationale** | El `login.ts` original usaba Playwright y funcionaba correctamente. Al reemplazarlo por `spawn` en `login-manager.ts`, los perfiles no se guardaban correctamente porque `spawn` no maneja el ciclo de vida del perfil de Chrome (creación de directorios, persistencia de cookies). Playwright lo hace automáticamente. Además, `spawn` requería `detectChrome()` que no encontraba Brave. Playwright con `executablePath` fallback resuelve ambos problemas. |
| **Alternatives considered** | Instalar Playwright Chromium (requiere `npx playwright install chromium`, paso extra para el usuario). Usar siempre el Chrome del sistema (inconsistente entre Docker y local). |
| **References** | `login-manager.ts:startLogin()` — try/catch con fallback a `findSystemChrome()`. |

### D16. Detección de Sesión vía DOM (Implementación)

| Aspect | Detail |
|--------|--------|
| **Decision** | `checkSession()` usa selectores DOM múltiples para determinar si el perfil está logueado en Facebook: feed (`[role="feed"]`), menú de usuario (`[aria-label="Your profile"]`), formulario de login (`input[name="email"]` + `button[name="login"]`), registro (`a[href*="/reg/"]`). |
| **Rationale** | La implementación original solo verificaba la URL: si contenía "facebook.com" sin "/login/" → alive. Esto causaba falsos positivos en perfiles vacíos porque la URL de inicio sin login también contiene "facebook.com". La detección vía DOM es más precisa porque busca elementos específicos de la UI de Facebook. |
| **Alternatives considered** | Verificar solo cookies (no verifica que la sesión siga siendo válida en el servidor). URL checking (falsos positivos). |
| **References** | `profile-manager.ts:checkSession()`. Bug reportado por el usuario: perfil vacío aparecía como "alive". |

### D17. Configuración de Producción para el Container

| Aspect | Detail |
|--------|--------|
| **Decision** | `PROFILE_DIR` y `VNC_PASSWORD` como env vars explícitas en docker-compose. VNC con password en vez de `-nopw`. Servicio `full` eliminado. |
| **Rationale** | `PROFILE_DIR=/app/profiles` explicita la ruta de perfiles eliminando ambigüedad. `VNC_PASSWORD` permite proteger el acceso VNC (antes era `-nopw`, cualquiera que alcanzara el puerto 6080 veía el escritorio). El servicio `full` tenía semántica obsoleta de `PROFILE_DIR` (apuntaba a un perfil específico, no al directorio padre). |
| **Alternatives considered** | Dejar VNC sin password (inseguro en producción). Mantener full service actualizado (no aporta valor, scraper es standalone). |
| **References** | `docker-compose.yml`, `entrypoint.sh`, `quickstart.md`. |

### D18. Login automático al cerrar Chrome (Implementación)

| Aspect | Detail |
|--------|--------|
| **Decision** | `startLogin()` escucha `context.waitForEvent("close")` y al detectar que el usuario cerró Chrome, persiste `.meta.json` con `loginStatus: "alive"` automáticamente. |
| **Rationale** | Originalmente `proc.on("exit")` persistía el meta, pero solo funcionaba con `spawn`. Con Playwright, `waitForEvent("close")` es el equivalente. Chrome guarda las cookies al cerrar, pero sin esta persistencia el perfil quedaba como "unknown" hasta que el usuario ejecutara `checkSession` manualmente. |
| **Alternatives considered** | Requerir `completeLogin()` manual (POST /login/:profile/complete) — UX pobre, el usuario no sabía que tenía que hacerlo. |
| **References** | `login-manager.ts:101-109`. Reportado por el usuario durante testing. |

### D8. Manejo de Chrome Lock Files

| Aspect | Detail |
|--------|--------|
| **Decision** | El entrypoint.sh limpia archivos lock (`SingletonLock`, `SingletonCookie`, `SingletonSocket`) del directorio del perfil antes de iniciar el servidor. |
| **Rationale** | Si el scraper se cierra abruptamente, Chrome deja lock files que impiden lanzar un nuevo contexto sobre el mismo perfil. La limpieza en startup es la solución más simple y robusta documentada en la comunidad de Playwright. |
| **Alternatives considered** | Trap de señales SIGTERM/SIGKILL en Node.js (no captura kill -9 ni crash del container). Copia temporal del perfil (complejo, overhead de I/O). |
| **References** | Playwright issue tracker: SingletonLock errors after unclean shutdown |
