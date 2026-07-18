# REST API Contracts: Autenticación + Administración de Grupos

> Phase 1 output — HTTP interface contracts for auth and group management

## Base URL

All endpoints are relative to `https://<host>/api`.

## Authentication

Most endpoints require an `Authorization: Bearer <access_token>` header. See [sessions.md](sessions.md) for token lifecycle details.

## Auth Endpoints

### POST /api/auth/login

Authenticates with email and password. Public endpoint (no auth required).

**Request Body**:
```json
{
  "email": "admin@example.com",
  "password": "supersecret123"
}
```

**Success Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
  "expiresIn": 86400
}
```

**Error Responses**:
- `401` — Invalid credentials (identical response regardless of whether email exists or password is wrong):
  ```json
  {
    "error": {
      "code": "AUTH_INVALID_CREDENTIALS",
      "message": "Invalid email or password",
      "requestId": "req-abc123",
      "timestamp": "2026-07-18T12:00:00Z"
    }
  }
  ```
- `429` — Rate limited (too many requests)

### POST /api/auth/refresh

Exchanges a refresh token for a new access + refresh pair. Public endpoint.

**Request Body**:
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Success Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "bmV3IHJlZnJlc2ggdG9r...",
  "expiresIn": 86400
}
```

**Error Responses**:
- `401` — Invalid, revoked, expired, or already-used refresh token:
  ```json
  {
    "error": {
      "code": "AUTH_INVALID_REFRESH_TOKEN",
      "message": "Refresh token is invalid or has been revoked",
      "requestId": "req-def456",
      "timestamp": "2026-07-18T12:00:00Z"
    }
  }
  ```

**Rotation behavior**: Each successful refresh revokes the previous session and creates a new one. Reusing the same refresh token twice will fail because the first use already revoked it.

### POST /api/auth/logout

Revokes the current session. Requires valid access token.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**: None

**Success Response** (200):
```json
{
  "message": "Session revoked"
}
```

**Error Responses**:
- `401` — Missing, expired, or invalid access token

### GET /api/auth/me

Returns the currently authenticated user's profile. Requires valid access token.

**Headers**: `Authorization: Bearer <access_token>`

**Success Response** (200):
```json
{
  "data": {
    "id": "uuid-abc",
    "email": "admin@example.com",
    "displayName": "Admin"
  }
}
```

**Error Responses**:
- `401` — Missing, expired, or invalid access token

## Group Endpoints

### GET /api/groups

Lists all Facebook groups. Public endpoint (no auth required).

**Query Parameters**:
- `page` (optional): Page number, default 1, min 1
- `limit` (optional): Items per page, default 20, max 100

**Success Response** (200):
```json
{
  "data": [
    {
      "id": "group-123",
      "name": "Ventas La Habana",
      "url": "https://facebook.com/groups/ventashabana",
      "maxPosts": 30,
      "isActive": true,
      "lastScraped": "2026-07-18T10:00:00Z",
      "lastError": null,
      "createdAt": "2026-07-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### POST /api/groups

Creates a new Facebook group. Requires valid access token.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "id": "group-456",
  "name": "Alquileres Ciudad Habana",
  "url": "https://facebook.com/groups/alquilereshabana",
  "maxPosts": 50,
  "isActive": true
}
```

**Success Response** (201):
```json
{
  "data": {
    "id": "group-456",
    "name": "Alquileres Ciudad Habana",
    "url": "https://facebook.com/groups/alquilereshabana",
    "maxPosts": 50,
    "isActive": true,
    "lastScraped": null,
    "lastError": null,
    "createdAt": "2026-07-18T12:00:00Z"
  }
}
```

**Error Responses**:
- `400` — Validation error (missing required fields, invalid format)
- `401` — Missing or invalid access token
- `409` — Duplicate group URL:
  ```json
  {
    "error": {
      "code": "GROUP_DUPLICATE_URL",
      "message": "A group with this URL already exists",
      "requestId": "req-ghi789",
      "timestamp": "2026-07-18T12:00:00Z"
    }
  }
  ```

### GET /api/groups/:id

Returns a single group by ID. Requires valid access token.

**Headers**: `Authorization: Bearer <access_token>`

**Success Response** (200): Same structure as single item in list response.

**Error Responses**:
- `401` — Missing or invalid access token
- `404` — Group not found

### PUT /api/groups/:id

Updates an existing group. Requires valid access token.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body** (all fields optional, only provided fields are updated):
```json
{
  "name": "Ventas La Habana Actualizado",
  "url": "https://facebook.com/groups/ventashabana",
  "maxPosts": 40,
  "isActive": false
}
```

**Success Response** (200): Updated group object.

**Error Responses**:
- `400` — Validation error
- `401` — Missing or invalid access token
- `404` — Group not found
- `409` — Updated URL conflicts with existing group

### DELETE /api/groups/:id

Deletes a group. Requires valid access token.

**Headers**: `Authorization: Bearer <access_token>`

**Success Response** (200):
```json
{
  "message": "Group deleted"
}
```

**Error Responses**:
- `401` — Missing or invalid access token
- `404` — Group not found

## Protected Endpoint Map

| Endpoint | Auth Required | Notes |
|----------|---------------|-------|
| `POST /api/auth/login` | No | Rate-limited |
| `POST /api/auth/refresh` | No | — |
| `POST /api/auth/logout` | Yes | Access token |
| `GET /api/auth/me` | Yes | Access token |
| `GET /api/groups` | No | Public read-only |
| `POST /api/groups` | Yes | Access token |
| `GET /api/groups/:id` | Yes | Access token |
| `PUT /api/groups/:id` | Yes | Access token |
| `DELETE /api/groups/:id` | Yes | Access token |
| `POST /api/scrape` | Yes | Access token (existing, add guard) |
| `POST /api/ai-process` | Yes | Access token (existing, add guard) |
| `PUT /api/schedule` | Yes | Access token (existing, add guard) |
| `GET /api/listings` | No | Public (existing, no change) |
| `GET /api/health` | No | Public (existing, no change) |

## Error Format

All errors follow the established envelope from Spec 001:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "req-xxx",
    "timestamp": "2026-07-18T12:00:00Z"
  }
}
```

Error categories used in this spec:
- `validation` — Input validation failures (missing fields, invalid format)
- `authorization` — Missing, expired, or invalid auth tokens
- `business` — Business rule violations (duplicate URL, etc.)
