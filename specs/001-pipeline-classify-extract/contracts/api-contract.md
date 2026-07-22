# Contract: API Endpoints

## GET /api/v1/listings

Updated query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `"active"` | Filter by status. Can be "active", "review", "rejected", "sold", or comma-separated combination |
| `status_ne` | string | — | Exclude a status (e.g., `?status_ne=rejected` shows active+review+sold) |

When `status` is not provided, defaults to `active` only (backward compatible).

## GET /api/v1/listings/review

Returns all listings with `status = "review"` ordered by scrapedAt ASC.

Response:
```json
{
  "data": [/* listings */],
  "total": 5,
  "pendingReview": 5
}
```

## POST /api/v1/listings/:id/approve

Changes listing status from "review" to "active".

## POST /api/v1/listings/:id/reject

Changes listing status from "review" (or "active") to "rejected".

## POST /api/v1/listings/:id/restore

Changes listing status from "rejected" to "review".

## GET /api/v1/groups/:id

Updated response includes new fields:
```json
{
  "id": "group-id",
  "name": "Casas en Cuba",
  "purpose": "inmuebles",
  "rejectThreshold": 0.2,
  "classifyThreshold": 0.5,
  "maxPosts": 30,
  "isActive": true
}
```
