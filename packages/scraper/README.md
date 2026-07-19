# @fb-store/scraper — Autonomous HTTP Scraper Microservice

Standalone HTTP microservice for scraping Facebook groups using Playwright. Exposes a REST API with SSE streaming, multi-account profile management, containerized VNC login, and a web dashboard.

## Architecture

```
packages/scraper/
├── src/
│   ├── server.ts              # Hono HTTP server entry point
│   ├── index.ts               # Core scrape logic (scrapeGroup, savePosts)
│   ├── browser.ts             # Playwright context factory + profile path resolution
│   ├── extractor.ts           # Facebook DOM extraction script
│   ├── schemas.ts             # Zod request validation schemas
│   ├── routes/
│   │   ├── scrape.ts          # POST /scrape, GET /scrape/:jobId, GET /scrape/:jobId/events
│   │   ├── profiles.ts        # CRUD /profiles, GET /profiles/:name/check
│   │   ├── login.ts           # POST /login, GET /login/:profile/status, POST /login/:profile/complete
│   │   └── health.ts          # GET /health, GET /ready
│   ├── services/
│   │   ├── scrape-runner.ts   # Wraps scrapeGroup with progress emission + SSE
│   │   ├── job-tracker.ts     # In-memory job state + SSE client management
│   │   ├── profile-manager.ts # Filesystem-based profile CRUD + session check
│   │   └── login-manager.ts   # Interactive login via Playwright (local) or Xvfb (Docker)
│   ├── middleware/
│   │   ├── auth.ts            # x-api-key header validation
│   │   └── error-handler.ts   # Consistent error envelope with requestId
│   └── static/
│       └── dashboard.html     # htmx-based operations dashboard
├── scripts/
│   └── entrypoint.sh          # Container startup (Xvfb + x11vnc + noVNC + Node)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Quick Start

### Prerequisites

- Node.js >=22.13, pnpm
- Playwright Chromium: `npx playwright install chromium`

### Build

```bash
pnpm --filter @fb-store/scraper build
```

### Run (local)

```bash
SCRAPER_API_KEY=dev-key PROFILE_DIR=$(pwd)/profiles node packages/scraper/dist/server.js
```

Or with hot-reload:

```bash
SCRAPER_API_KEY=dev-key PROFILE_DIR=$(pwd)/profiles pnpm --filter @fb-store/scraper dev
```

Server starts on `http://localhost:3001`.

### Run (Docker)

```bash
VNC_PASSWORD=fbstore SCRAPER_API_KEY=dev-key docker compose up --build scraper -d
```

## API Reference

Base URL: `http://localhost:3001/api/v1`

Authentication: `x-api-key` header required on all endpoints except `/health` and `/ready`.

### Response Envelope

**Success:**
```json
{ "data": { ... } }
```

**Error:**
```json
{ "error": { "code": "validation|business|unknown", "message": "...", "requestId": "uuid" } }
```

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | System status (uptime, profiles, chrome, display) | No |
| `GET` | `/ready` | Readiness probe for Docker healthcheck | No |
| `POST` | `/scrape` | Trigger a scrape job | Yes |
| `GET` | `/scrape/:jobId` | Get job status and result | Yes |
| `GET` | `/scrape/:jobId/events` | SSE stream of progress events | Yes |
| `GET` | `/profiles` | List all profiles | Yes |
| `POST` | `/profiles` | Create a new profile | Yes |
| `DELETE` | `/profiles/:name` | Delete a profile | Yes |
| `GET` | `/profiles/:name/check` | Check Facebook session status | Yes |
| `POST` | `/login` | Start interactive login via VNC | Yes |
| `GET` | `/login/:profile/status` | Login session status | Yes |
| `POST` | `/login/:profile/complete` | Complete login session | Yes |

### POST /scrape

```json
{
  "url": "https://facebook.com/groups/859317869284157",
  "groupId": "uuid-from-db",
  "maxPosts": 20,
  "profile": "cuenta-1",
  "wait": false
}
```

- `url` or `groupId` required (exactly one). `url` mode works without database.
- `wait: true` blocks until complete and returns full result.
- Returns `202 { jobId }` for async, `200 { posts, metrics }` for sync.

### SSE Events (GET /scrape/:jobId/events)

| Event | Payload | Description |
|-------|---------|-------------|
| `progress` | `{ phase, current, total }` | Phase: navigating, scrolling, extracting, downloading, saving |
| `log` | `{ message }` | Log message |
| `complete` | `{ posts, metrics }` | Scrape completed |
| `error` | `{ message }` | Scrape failed |

## Profile Management

Profiles are Chrome user data directories stored on the filesystem. Each profile corresponds to one Facebook account.

```
profiles/
├── cuenta-1/          # Profile directory
│   ├── Default/       # Chrome profile data (cookies, localStorage, sessions)
│   └── .meta.json     # Metadata (createdAt, lastUsedAt, loginStatus)
└── cuenta-2/
    └── .meta.json
```

### Status values

| Status | Meaning |
|--------|---------|
| `unknown` | Not checked yet |
| `alive` | Facebook session is valid (feed visible) |
| `dead` | Session expired (redirected to /login/) |
| `locked` | Chrome in use by another operation |

### Creating a new account

1. **Dashboard**: `+ New Account` → enter name → creates directory + `.meta.json`
2. **Local**: Open Chrome with `--user-data-dir=./profiles/{name}`, log in to Facebook, close
3. **Docker**: `Login` button → VNC opens → log in → close Chrome → `.meta.json` auto-updates to `alive`

## Docker Setup

### Container architecture

```
scraper container
├── Xvfb :99            # Virtual display (no monitor needed)
├── x11vnc :5900        # VNC server
├── websockify :6080    # WebSocket-to-VNC proxy (noVNC)
└── Node server :3001   # HTTP API
```

### Ports

| Port | Service | Description |
|------|---------|-------------|
| 3001 | API | REST endpoints |
| 6080 | noVNC | Web-based VNC client for interactive login |

### Volumes

```yaml
volumes:
  - ./profiles:/app/profiles   # Profile persistence
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_API_KEY` | — (required) | API key for x-api-key auth. Server fails to start if unset. |
| `PORT` | `3001` | HTTP server port |
| `PROFILE_DIR` | `<cwd>/profiles` | Directory containing profile subdirectories |
| `VNC_PASSWORD` | `fbstore` | Password for noVNC access (Docker only) |
| `CHROME_PATH` | auto-detected | Path to Chrome/Chromium/Brave binary |
| `DATABASE_URL` | — | PostgreSQL URL for groupId mode (DB mode) |
| `PROFILE_DIR` in login.ts | `/app/profiles` | Only used in Docker |

## Dashboard UI

Access at `http://localhost:3001/dashboard`.

Features:
- Profile list with status badges (unknown/alive/dead)
- Check session button → verifies Facebook login
- Login button → starts interactive VNC session (Docker)
- Quick scrape form → URL + maxPosts + profile selector
- Real-time progress during scrape

Built with vanilla HTML + htmx (CDN). No build step required.

## Development

### Tests

```bash
pnpm --filter @fb-store/scraper test
```

Uses Vitest. Tests are in `src/**/*.spec.ts`.

### Project conventions

- **Framework**: Hono (lightweight HTTP, SSE streaming via `hono/streaming`)
- **Validation**: Zod schemas in `schemas.ts`
- **Browser automation**: Playwright `launchPersistentContext`
- **Error handling**: Consistent envelope with `code`, `message`, `requestId`

## Edge Cases

- **Scraper crashes during scrape**: Jobs are lost (in-memory). Retry manually.
- **Profile already scraping**: Returns 409 Conflict. One job per profile at a time.
- **Empty profile directory**: `listProfiles()` falls back to default metadata.
- **Chrome lock files**: `entrypoint.sh` cleans `SingletonLock`, `SingletonCookie`, `SingletonSocket` on startup.
- **No database in URL mode**: Scraper works fully without DB when using direct URLs.
- **Facebook blocks headless**: `checkSession()` uses DOM detection (feed, login form, profile menu).
- **Missing Playwright Chromium**: Falls back to system Chrome/Brave automatically.

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| hono | ^4.7 | HTTP framework |
| @hono/node-server | ^1.13 | Node.js adapter for Hono |
| zod | 4.4.3 | Request validation |
| playwright | 1.60 | Browser automation |
| sanitize-html | ^2.0 | Text sanitization |
| @fb-store/shared | workspace | Prisma client, shared types |
| vitest | ^4.1 | Testing framework |

## License

Private — part of the FB Store monorepo.
