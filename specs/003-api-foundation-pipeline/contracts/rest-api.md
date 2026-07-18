# REST API Contracts: Spec 001

> Phase 1 output — API endpoint contracts for this feature

## Base URL

All endpoints are prefixed with `/api`. Production: `http://localhost:3000/api`.

## Common Response Envelope

### Success — Paginated List

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Success — Single Resource

```json
{
  "data": { ... }
}
```

### Error

```json
{
  "error": {
    "code": "validation",
    "message": "Validation failed",
    "requestId": "req_abc123",
    "timestamp": "2026-07-18T12:00:00.000Z"
  }
}
```

**Error Codes**: `validation` | `authorization` | `rate_limit` | `business` | `unknown`

## Headers

| Header | Description | Required |
|--------|-------------|----------|
| `x-request-id` | Returned on all responses | Auto-generated |
| `x-api-key` | API authentication key | Required on all requests |

---

## Endpoints

### GET /api/listings

List listings with filters.

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| listing_type | string | — | Filter: sale, rent, swap |
| property_type | string | — | Filter: apartment, house, room, land, commercial |
| province | string | — | Filter by province |
| municipality | string | — | Filter by municipality |
| neighborhood | string | — | Filter by neighborhood |
| bedrooms | number | — | Min bedrooms |
| bathrooms | number | — | Min bathrooms |
| min_price | number | — | Minimum price |
| max_price | number | — | Maximum price |
| currency | string | — | Currency filter |
| status | string | active | Listing status |
| search | string | — | Full-text search |
| sort | string | newest | newest, oldest, price_asc, price_desc |

**Response**: `{ data: Listing[], pagination }`

**Status Codes**: 200, 401 (missing/invalid API key)

---

### GET /api/listings/:id

Get single listing detail.

**Path Parameters**: `id` — UUID

**Response**: `{ data: Listing }`

**Status Codes**: 200, 401 (missing/invalid API key), 404

---

### POST /api/scrape

Trigger a scrape job. Returns immediately with jobId.

**Request Body** (optional):
```json
{
  "groupId": "optional-uuid",
  "maxPosts": 50
}
```

**Response** (202):
```json
{
  "jobId": "bullmq-job-id"
}
```

**Status Codes**: 202 (accepted), 400 (validation error), 401 (missing/invalid API key)

---

### GET /api/scrape/status/:jobId

Check status of a scrape job.

**Path Parameters**: `jobId` — BullMQ job ID

**Response**:
```json
{
  "data": {
    "jobId": "bullmq-job-id",
    "status": "completed",
    "progress": 100,
    "result": {
      "postsFound": 15,
      "postsNew": 12
    },
    "failedReason": null,
    "timestamp": "2026-07-18T12:00:00.000Z"
  }
}
```

**Status Codes**: 200, 401 (missing/invalid API key)

**Status values**: `waiting` | `active` | `completed` | `failed`

---

### POST /api/ai-process

Trigger AI processing. Returns immediately with jobId.

**Request Body** (optional):
```json
{
  "rawPostIds": ["uuid1", "uuid2"]
}
```

**Response** (202):
```json
{
  "jobId": "bullmq-job-id"
}
```

**Status Codes**: 202 (accepted), 400 (validation error), 401 (missing/invalid API key)

---

### GET /api/schedule

Get current scheduler configuration.

**Response**:
```json
{
  "data": {
    "intervalMinutes": 240,
    "hourStart": 8,
    "hourEnd": 22,
    "enabled": true
  }
}
```

**Status Codes**: 200, 401 (missing/invalid API key)

---

### PUT /api/schedule

Update scheduler configuration.

**Request Body**:
```json
{
  "intervalMinutes": 120,
  "hourStart": 6,
  "hourEnd": 23,
  "enabled": true
}
```

**Response**: Updated schedule config + `{ "data": { ... } }`

**Status Codes**: 200, 400 (validation), 401 (missing/invalid API key)

---

### GET /api/raw-posts

List raw posts with filters.

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| status | string | — | pending, processed, skipped |
| group_id | string | — | Filter by group |
| scrapedAt[gte] | string | — | ISO date, start range |
| scrapedAt[lte] | string | — | ISO date, end range |

**Response**: `{ data: RawPost[], pagination }`

**Status Codes**: 200, 401 (missing/invalid API key)

---

### GET /api/groups (stub — full CRUD in Spec 002)

**Response**: `{ "data": [] }` — returns empty until groups CRUD is implemented

---

### GET /api/health

Health check endpoint.

**Response** (existing, unchanged):
```json
{ "status": "ok" }
```

**Status Codes**: 200, 401 (missing/invalid API key) — or may bypass auth guard for healthcheck compatibility
