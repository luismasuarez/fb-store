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

### D8. Manejo de Chrome Lock Files

| Aspect | Detail |
|--------|--------|
| **Decision** | El entrypoint.sh limpia archivos lock (`SingletonLock`, `SingletonCookie`, `SingletonSocket`) del directorio del perfil antes de iniciar el servidor. |
| **Rationale** | Si el scraper se cierra abruptamente, Chrome deja lock files que impiden lanzar un nuevo contexto sobre el mismo perfil. La limpieza en startup es la solución más simple y robusta documentada en la comunidad de Playwright. |
| **Alternatives considered** | Trap de señales SIGTERM/SIGKILL en Node.js (no captura kill -9 ni crash del container). Copia temporal del perfil (complejo, overhead de I/O). |
| **References** | Playwright issue tracker: SingletonLock errors after unclean shutdown |
