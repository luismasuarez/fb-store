# Data Model: Fundación API + Pipeline Automático

> Phase 1 output — entities, relationships, validation rules, and state transitions

## Entity Diagram

```
┌──────────────┐       ┌──────────────┐
│   Listing    │       │   RawPost    │
│──────────────│       │──────────────│
│ id (PK)      │◄──────│ listingId(FK)│
│ fbPostId(UQ) │       │ fbPostId     │
│ title        │       │ groupId      │
│ price        │       │ rawData(JSON)│
│ currency     │       │ textContent  │
│ ...fields    │       │ processed(bool)│
│ createdAt    │       │ scrapedAt    │
└──────────────┘       └──────────────┘
                              ▲
                              │
┌──────────────┐       ┌──────┴───────┐       ┌──────────────┐
│   Schedule   │       │  ScrapeLog   │       │    Group     │
│ (config)     │       │──────────────│       │──────────────│
│──────────────│       │ id (PK)      │       │ id (PK)      │
│ intervalMin  │       │ groupId      │       │ name         │
│ hourStart    │       │ postsFound   │       │ url          │
│ hourEnd      │       │ postsNew     │       │ isActive     │
│ enabled      │       │ postsErrors  │       │ maxPosts     │
│              │       │ startedAt    │       │ lastScraped  │
│              │       │ finishedAt   │       │ createdAt    │
│              │       │ durationMs   │       └──────────────┘
│              │       │ error        │
└──────────────┘       └──────────────┘
```

## Entity Specifications

### ScrapeJobData (BullMQ Job Data — No DB table)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| groupId | string | No | Specific group to scrape. If omitted, scrape all active groups |
| maxPosts | number | No | Max posts per group. Falls back to group's configured maxPosts |

**Lifecycle**:
1. `POST /api/scrape` → enqueues job with `{ groupId?, maxPosts? }`
2. Worker picks up → processes group → saves raw_posts → saves ScrapeLog
3. If new posts found → enqueues `ai-process` job with `{ rawPostIds[]? }` with exponential backoff retry (3 attempts)
4. Status trackable via `GET /api/scrape/status/:jobId`

### AiProcessJobData (BullMQ Job Data — No DB table)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rawPostIds | string[] | No | Specific posts to process. If omitted, process all pending |

**Lifecycle**:
1. Enqueued automatically by scraper worker OR by `POST /api/ai-process`
2. Worker picks up → processes raw_posts → creates/updates Listings → marks raw_posts as processed
3. On failure (timeout, rate limit): raw_post stays `processed=false`, retried on next cycle

### Schedule (In-memory config + API — No DB table in this spec)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| intervalMinutes | number | 240 | How often to scrape (every N minutes) |
| hourStart | number | 8 | Window start hour (0-23) |
| hourEnd | number | 22 | Window end hour (0-23) |
| enabled | boolean | true | Whether scheduling is active |

**Validation**: `intervalMinutes >= 30` (minimum 30 min between scrapes). `0 <= hourStart < hourEnd <= 23`.

**Persistence**: In this spec, schedule config lives in memory and is configured via API at runtime. BullMQ `upsertJobScheduler` persists the repeatable job in Redis. DB persistence is deferred to a future spec.

### ScrapeLog (Existing DB table — No schema changes)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| groupId | string | Facebook group ID |
| accountIndex | int | Account profile index |
| postsFound | int | Posts extracted from DOM |
| postsNew | int | Posts inserted (not duplicates) |
| postsErrors | int | Posts that errored during save |
| startedAt | timestamp | When the scrape started |
| finishedAt | timestamp? | When the scrape completed |
| durationMs | int? | Duration in milliseconds |
| error | string? | Error message if failed |

### RawPost (Existing DB table — No schema changes)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| fbPostId | string | Facebook post ID (unique) |
| groupId | string? | Source group |
| rawData | JSON? | Full post data from scraper |
| textContent | string? | Sanitized post text |
| processed | boolean | Whether AI has processed it (default: false) |
| listingId | UUID? | FK to Listing (set when processed) |
| aiProvider | string? | AI provider used |
| scrapedAt | timestamp | When the post was scraped |

**State transitions**: `processed=false` → AI processes → Three outcomes: success (processed=true, listingId set), transient failure (processed stays false, retried with exponential backoff up to 3 attempts), or permanent failure (moved to dead letter queue, raw_post remains pending for manual or next-cycle recovery)

### Listing (Existing DB table — No schema changes in this spec)

| Category | Fields |
|----------|--------|
| **Identification** | id, fbPostId, sourceGroup, sourceGroupId, sourceUrl |
| **Content** | title, description, rawText, summaryShort |
| **Pricing** | price, currency |
| **Classification** | category, listingType, propertyType, status |
| **Location** | location, province, municipality, neighborhood |
| **Property Details** | bedrooms, bathrooms, totalM2, floors, parking, furnished |
| **Contact** | contactPhone, contactName |
| **Media** | images (JSON) |
| **AI** | aiConfidence, aiRawData |
| **Timestamps** | postedAt, scrapedAt, processedAt, createdAt, updatedAt |

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| ScrapeTrigger | groupId | Optional string, UUID format |
| ScrapeTrigger | maxPosts | 1-100, integer |
| Schedule | intervalMinutes | >= 30, default 240 |
| Schedule | hourStart | 0-23 |
| Schedule | hourEnd | 1-24, must be > hourStart |
| All API inputs | unknown fields | Stripped (whitelist mode) |
| All paginated queries | page | >= 1, default 1 |
| All paginated queries | limit | 1-100, default 20 |
