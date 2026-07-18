# Session Management Contract: JWT Dual + Refresh Rotation

> Phase 1 output — token structure, lifecycle, and validation rules

## Token Types

### Access Token (stateless)

- **Purpose**: Authorizes API requests. Sent as `Authorization: Bearer <token>` header.
- **Lifetime**: Configurable (default 24 hours). Short-lived to limit exposure if stolen.
- **Storage**: Not stored server-side. Validated by JWT signature + claims.
- **Contains**: Standard JWT claims + custom claims.

**JWT Claims**:
```json
{
  "sub": "user-uuid",
  "typ": "access",
  "jti": "unique-token-id",
  "iat": 1689696000,
  "exp": 1689782400
}
```

### Refresh Token (stateful)

- **Purpose**: Obtains new access + refresh token pair when the access token expires.
- **Lifetime**: Configurable (default 7 days). Longer-lived to allow session continuity without re-login.
- **Storage**: Stored as SHA-256 hash in `auth_sessions` table. The raw token is returned to the client at login/refresh and never stored server-side in plain text.
- **Validation**: Server hashes the incoming refresh token with SHA-256 and looks up the hash in `auth_sessions`. Session must not be revoked and must not be expired.

**JWT Claims**:
```json
{
  "sub": "user-uuid",
  "typ": "refresh",
  "jti": "unique-token-id",
  "iat": 1689696000,
  "exp": 1690300800
}
```

## Token Lifecycle

### Login

```
POST /api/auth/login
  │
  ├── Validate email + password (scrypt + timingSafeEqual)
  │
  ├── Generate access token (typ: "access", exp: +24h)
  ├── Generate refresh token (typ: "refresh", exp: +7d)
  │
  ├── Hash refresh token (SHA-256)
  ├── Create AuthSession row (userId, tokenHash, expiresAt)
  │
  └── Return { accessToken, refreshToken, expiresIn }
```

### Refresh (with rotation)

```
POST /api/auth/refresh
  │
  ├── Hash incoming refresh token (SHA-256)
  ├── Look up session by tokenHash
  │   ├── Not found → 401 "Invalid refresh token"
  │   ├── revokedAt IS NOT NULL → 401 "Token already used" (rotation protection)
  │   └── expiresAt < NOW → 401 "Token expired"
  │
  ├── Revoke old session (set revokedAt = now())
  │
  ├── Generate NEW access token (typ: "access", exp: +24h)
  ├── Generate NEW refresh token (typ: "refresh", exp: +7d)
  │
  ├── Hash new refresh token (SHA-256)
  ├── Create NEW AuthSession row
  │
  └── Return { accessToken, refreshToken, expiresIn }
```

### Logout

```
POST /api/auth/logout (Authorization: Bearer <access_token>)
  │
  ├── Decode access token (validate signature + typ + exp)
  ├── Find active session for this user (latest unrevoked session)
  ├── Set revokedAt = now() on found session
  │
  └── Return 200 "Session revoked"
```

### Request Authorization

```
Any protected endpoint
  │
  ├── Extract Bearer token from Authorization header
  ├── Validate JWT signature (HMAC with server secret)
  ├── Validate typ === "access" (reject if refresh token used here)
  ├── Validate exp < now() (if expired → 401 TokenExpiredError)
  │
  └── Attach decoded payload to request.auth
```

## Rotation Protection

Refresh rotation prevents token replay attacks:

1. User has session A (refresh token `rt_A`)
2. Attacker steals `rt_A` but cannot use it yet
3. Legitimate user calls `/auth/refresh` with `rt_A` → gets new pair (session B, `rt_B`), session A revoked
4. Attacker tries to use `rt_A` → hash lookup finds session A with `revokedAt` set → 401 "Token already used"
5. Legitimate user's next refresh works fine with `rt_B`

**If attacker uses `rt_A` first**:
1. Attacker calls `/auth/refresh` → gets session B, session A revoked
2. Legitimate user tries `rt_A` → 401 (session A revoked)
3. Legitimate user knows their session was compromised, must re-login

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Confidentiality | Tokens transmitted only over HTTPS |
| Integrity | JWT HMAC signature prevents tampering |
| Stateless validation | Access tokens validated by signature alone (no DB) |
| Revocation | Refresh tokens revocable via `revokedAt` column |
| Rotation | Each refresh invalidates the previous token |
| Storage safety | Refresh tokens hashed (SHA-256) in DB |
| Timing attack protection | Password comparison uses `timingSafeEqual` |
| Token confusion | `typ` claim prevents using refresh token as access token |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required) | HMAC secret for JWT signing |
| `JWT_ACCESS_EXPIRES_IN` | `86400` | Access token TTL in seconds (24h) |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token TTL in seconds (7d) |
| `ADMIN_EMAIL` | (required for seed) | Initial admin email |
| `ADMIN_PASSWORD` | (required for seed) | Initial admin password |
