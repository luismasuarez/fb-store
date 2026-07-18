# Research: Autenticación + Administración de Grupos

> Phase 0 output — technology decisions, best practices, and resolved unknowns

## Overview

No [NEEDS CLARIFICATION] markers existed in the spec. This research documents the architectural decisions for implementing JWT dual auth, group CRUD, and dashboard controls within the existing NestJS + Fastify stack.

## Decisions

### Decision 1: JWT Dual (Access + Refresh) with Rotation

- **Decision**: Implement JWT dual token pattern with refresh rotation
- **Rationale**: 
  - Access tokens (short-lived, 24h default) are stateless — validated by signature alone, no DB lookup needed. This keeps API fast and avoids DB pressure on every request.
  - Refresh tokens (longer-lived, 7 days) are stateful — stored as SHA-256 hashes in `auth_sessions`. This enables revocation (logout, rotation).
  - Rotation means each refresh invalidates the previous refresh token. If an attacker steals a refresh token and the legitimate user refreshes, the attacker's copy becomes invalid. If the attacker uses the stolen token before the legitimate user, both parties get a new token (detection via "token already used" error on next legitimate attempt).
- **Alternatives considered**:
  - Single JWT (no refresh): Simple but no revocation mechanism. If stolen, valid until expiration.
  - Session-only (server-side state for all requests): More DB queries per request, defeats Fastify/NestJS performance benefits.
  - OAuth2 with auth code flow: Overkill for single-admin system.

### Decision 2: Password Hashing with scrypt

- **Decision**: Use `scryptSync` from Node.js `crypto` module with 16-byte random salt and `timingSafeEqual` for comparison
- **Rationale**:
  - scrypt is memory-hard (resistant to GPU/ASIC attacks) and available natively in Node.js without extra dependencies
  - 16-byte salt (128 bits) follows OWASP recommendations
  - `timingSafeEqual` prevents timing side-channel attacks on password comparison
  - No dependency on `bcrypt` or `argon2` packages — keeps the dependency tree lean
- **Alternatives considered**:
  - bcrypt: Well-proven but adds a native dependency; scrypt is equally suitable and native
  - argon2: Stronger but requires external library (`@node-rs/argon2` or similar)

### Decision 3: Passport.js JWT Strategy with NestJS

- **Decision**: Use `@nestjs/passport` with `passport-jwt` strategy for both access and refresh token validation
- **Rationale**:
  - NestJS has first-class Passport integration via `@nestjs/passport` and `@nestjs/jwt`
  - Two strategies: `JwtStrategy` (Bearer token from Authorization header, validates `typ === "access"`) and `RefreshJwtStrategy` (token from `body.refreshToken`, validates `typ === "refresh"`)
  - `JwtAuthGuard` extends `AuthGuard('jwt')` for easy `@UseGuards()` decoration on controllers
  - Consistent with patterns from portal_cloud (the reference project)
- **Alternatives considered**:
  - Custom middleware: More control but loses NestJS guard ecosystem and declarative `@UseGuards()` pattern
  - Fastify hooks: Valid but not idiomatic NestJS

### Decision 4: AuthSession Table with SHA-256 Token Hashes

- **Decision**: Store refresh tokens as SHA-256 hashes in `auth_sessions` table. Never store raw refresh tokens.
- **Rationale**:
  - If the database is compromised, refresh tokens cannot be used (they're hashed)
  - SHA-256 is deterministic (needed for lookup — we hash the incoming token and search by hash)
  - Access tokens are not stored (stateless validation by JWT signature)
  - Each session row tracks: userId, tokenHash, expiresAt, revokedAt
  - On refresh: revoke old session row (set revokedAt), insert new row with new token hash
  - On logout: set revokedAt on active session
- **Alternatives considered**:
  - Store raw tokens with lastUsedAt: Riskier if DB compromised
  - Encrypt tokens with app secret: More complex, same security profile as hashing

### Decision 5: Group CRUD with Existing Schema

- **Decision**: Expose the existing `Group` Prisma model via CRUD endpoints with no schema changes
- **Rationale**:
  - The `Group` model already exists with id, name, url, maxPosts, lastScraped, isActive, createdAt
  - Creating a group requires the user to provide an `id` (existing model uses manual IDs, not auto-generated UUIDs)
  - Updates allowed on: name, url, maxPosts, isActive. `id` is immutable, `createdAt` and `lastScraped` are system-managed.
  - Group uniqueness enforced on `url` via application-level validation (not DB unique constraint currently)
- **Pattern**: Groups follow the same feature module pattern as other features:
  - `groups.controller.ts` → validates + delegates
  - `groups.service.ts` → business logic (duplicate URL check, field mapping)
  - `group.repository.ts` → Prisma queries

### Decision 6: Admin UI Auth with React Context

- **Decision**: Use React Context for auth state management with `@tanstack/react-query` for API mutations
- **Rationale**:
  - Context provider `AuthContext` stores tokens in memory + localStorage for persistence across page reloads
  - Automatic refresh: before every API call, check if access token is expired; if so, attempt refresh before proceeding
  - On refresh failure or 401 response: clear tokens, redirect to `/login`
  - `ProtectedRoute` wrapper component checks auth state and redirects to `/login` if not authenticated
  - React Query mutations for scrape/AI trigger with polling for status updates
- **Alternatives considered**:
  - Redux/Zustand: Overkill for single-auth-state
  - axios interceptors: Works alongside React Context for automatic token attachment and refresh

### Decision 7: Seed Mechanism for Initial Admin

- **Decision**: Seed via dedicated seed script that reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars and creates the initial User + generates an AuthSession
- **Rationale**:
  - Simple, no additional UI needed for first-time setup
  - The seed script is idempotent (skips if admin already exists)
  - Can be run as part of Docker Compose startup (`command` or `entrypoint`)
  - Falls back to service startup seeding (run seed before API listens)
- **Alternatives considered**:
  - Bootstrap endpoint (`POST /api/auth/setup`): Requires HTTPS + one-time token, more complex
  - Hardcoded defaults: Insecure, violates security best practices
