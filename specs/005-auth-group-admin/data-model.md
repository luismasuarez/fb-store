# Data Model: Autenticación + Administración de Grupos

> Phase 1 output — entities, relationships, validation rules, and state transitions

## Entity Diagram

```
┌──────────────┐       ┌───────────────┐
│    User      │       │ AuthSession   │
│──────────────│       │───────────────│
│ id (PK)      │◄──────│ userId (FK)   │
│ email (UQ)   │       │ tokenHash     │
│ passwordHash │       │ expiresAt     │
│ displayName  │       │ revokedAt?    │
│ createdAt    │       │ createdAt     │
│ updatedAt    │       └───────────────┘
└──────────────┘

┌──────────────┐
│    Group     │  (existing — no schema changes)
│──────────────│
│ id (PK)      │
│ name         │
│ url?         │
│ maxPosts     │
│ lastScraped? │
│ lastError?   │
│ isActive     │
│ createdAt    │
└──────────────┘
```

## Entity Specifications

### User (New table)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | Auto | uuid() | Primary key |
| email | string | Yes | — | Admin email, must be unique |
| passwordHash | string | Yes | — | scrypt hash with 16-byte salt, format: `algorithm:params:salt:hash` |
| displayName | string | Yes | — | Human-readable admin name |
| createdAt | timestamp | Auto | now() | Row creation timestamp |
| updatedAt | timestamp | Auto | updatedAt | Row update timestamp |

**Unique constraints**: email

**Validation rules**:
- email: valid email format, max 255 chars
- passwordHash: never exposed via API; set only via seed mechanism
- displayName: 1-100 chars, trimmed

**Lifecycle**:
1. Created once via seed mechanism (env vars `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
2. No update/delete endpoints — single admin for life of instance
3. Referenced by AuthSession.userId

### AuthSession (New table)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | Auto | uuid() | Primary key |
| userId | UUID | Yes | — | FK → User.id, identifies session owner |
| tokenHash | string | Yes | — | SHA-256 hash of the refresh token, must be unique |
| expiresAt | timestamp | Yes | — | When the session expires (refresh token expiration) |
| revokedAt | timestamp | No | null | When the session was revoked (logout or rotation) |
| createdAt | timestamp | Auto | now() | Row creation timestamp |

**Unique constraints**: tokenHash

**Indexes**: userId (for lookup), expiresAt (for cleanup), revokedAt (for filtering active sessions)

**Validation rules**:
- tokenHash: SHA-256 hex string (64 chars), deterministic — used for lookup
- expiresAt: must be in the future at creation time
- revokedAt: if set, session is considered invalid regardless of expiresAt

**State transitions**:
```
Created (valid) ──► Revoked (logout or rotation)
                ──► Expired (past expiresAt, auto-invalid)
                ──► Replaced (new refresh token issued for same user)
```

A session is valid iff: `revokedAt IS NULL AND expiresAt > NOW()`.

**Lifecycle**:
1. Created on successful `POST /api/auth/login` (one session row per login)
2. Revoked on:
   - `POST /api/auth/logout` — set revokedAt = now()
   - Refresh rotation — old session revoked, new session created
3. Auto-invalid after expiresAt (checked at validation time, no background cleanup needed)
4. Reuse of a refresh token that maps to a revoked or expired row → rejected with 401

### Group (Existing — No schema changes)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| id | string | Yes | — | Manual ID (Facebook group ID or custom) |
| name | string | Yes | — | Human-readable group name |
| url | string | No | null | Facebook group URL |
| maxPosts | int | No | 30 | Max posts to scrape per cycle |
| lastScraped | timestamp | No | null | Last successful scrape timestamp (system-managed) |
| lastError | string | No | null | Last error message (system-managed) |
| isActive | boolean | No | true | Whether the group is included in scraping cycles |
| createdAt | timestamp | Auto | now() | Row creation timestamp |

**Validation rules**:
- id: 1-255 chars, must be unique (user-provided at creation, immutable after)
- name: 1-255 chars, required
- url: valid URL format if provided
- maxPosts: integer >= 1, default 30
- isActive: boolean, default true
- url: application-level unique constraint (no DB unique index currently)

## Validation Rules

| Entity | Field | Rule | Error Code |
|--------|-------|------|------------|
| Login | email | Required, valid email format, max 255 chars | validation |
| Login | password | Required, min 8 chars | validation |
| CreateGroup | name | Required, 1-255 chars | validation |
| CreateGroup | url | Required at API layer (Zod DTO), DB column nullable — validated as required per FR-016, valid URL format | validation |
| CreateGroup | maxPosts | >= 1, integer, default 30 | validation |
| CreateGroup | isActive | boolean, default true | validation |
| UpdateGroup | name | Optional, 1-255 chars if provided | validation |
| UpdateGroup | url | Optional, valid URL if provided; unique check on change | validation |
| UpdateGroup | maxPosts | Optional, >= 1 if provided | validation |
| UpdateGroup | isActive | Optional, boolean if provided | validation |
| All inputs | unknown fields | Stripped by global ZodValidationPipe (whitelist mode) | validation |
| All inputs | type coercion | Transformed by global ZodValidationPipe (transform mode) | validation |
| Duplicate group url | — | Business rule check in service layer | business |
| Expired access token | — | JWT signature validation fails | authorization |
| Invalid refresh token | — | tokenHash not found or session revoked/expired | authorization |
| Reused refresh token | — | Session already revoked (rotation) | authorization |

## State Transitions

### Auth Flow

```
Anonymous ──POST /api/auth/login──► Authenticated (has tokens)
Authenticated ──token expires──► Anonymous (must re-login or refresh)
Authenticated ──POST /api/auth/refresh──► Authenticated (new tokens, old revoked)
Authenticated ──POST /api/auth/logout──► Anonymous (session revoked)
```

### Group Lifecycle

```
Created ──► Active (isActive=true, included in scrape cycles)
Active ──PUT /api/groups/:id──► Updated (fields modified)
Active ──DELETE /api/groups/:id──► Deleted (removed from system)
Active ──PUT isActive=false──► Inactive (excluded from scrape cycles)
Inactive ──PUT isActive=true──► Active (re-included in scrape cycles)
```
