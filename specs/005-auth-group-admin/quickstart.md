# Quickstart: Autenticación + Administración de Grupos

> Phase 1 output — validation guide to prove the feature works end-to-end

## Prerequisites

- Spec 001 (Fundación API + Pipeline Automático) fully implemented
- Docker Compose stack running: `docker compose up --build -d`
- Database migrated: `pnpm --filter shared prisma:migrate`
- Seed admin user: `pnpm --filter api seed:admin`
- Admin SPA dev server running: `pnpm --filter admin dev`

## End-to-End Validation Scenarios

### Scenario 1: Login + Token Lifecycle

**Goal**: Verify that the login flow works end-to-end, including token refresh and rotation.

**Steps**:
1. `POST /api/auth/login` with valid admin credentials
   - Expected: 200 with `{ accessToken, refreshToken, expiresIn }`
2. Use access token in `GET /api/auth/me` (header `Authorization: Bearer <access_token>`)
   - Expected: 200 with admin user profile
3. `POST /api/auth/refresh` with the refresh token from step 1
   - Expected: 200 with new `{ accessToken, refreshToken, expiresIn }`
4. Try step 1's refresh token again (rotation check)
   - Expected: 401 with "token already used" error
5. `POST /api/auth/logout` with the access token from step 3
   - Expected: 200 with "Session revoked"
6. Try step 3's access token on a protected endpoint
   - Expected: 401 (session revoked)

**Commands**:
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"supersecret123"}'

# Get current user (replace TOKEN)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer TOKEN"

# Refresh (replace REFRESH_TOKEN)
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"REFRESH_TOKEN"}'

# Logout (replace TOKEN)
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer TOKEN"
```

### Scenario 2: Endpoint Protection

**Goal**: Verify that sensitive endpoints reject unauthenticated requests.

**Steps**:
1. `POST /api/scrape` without token
   - Expected: 401
2. `POST /api/scrape` with valid access token
   - Expected: 202 with `{ jobId }`
3. `GET /api/groups` without token (public)
   - Expected: 200 with group list
4. `POST /api/groups` without token
   - Expected: 401
5. `GET /api/listings` without token (public)
   - Expected: 200 with listings
6. `GET /api/health` without token (public)
   - Expected: 200

**Commands**:
```bash
# Protected without token → 401
curl -X POST http://localhost:3000/api/scrape

# Protected with token → 202
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer TOKEN"

# Public read → 200
curl http://localhost:3000/api/groups
curl http://localhost:3000/api/listings
```

### Scenario 3: Group CRUD

**Goal**: Verify full CRUD lifecycle for groups.

**Steps**:
1. `POST /api/groups` with valid data and access token → 201
   - Create: id="test-group-1", name="Test Group", url="https://facebook.com/groups/test"
2. `GET /api/groups` → 200, verify new group appears in list
3. `PUT /api/groups/:id` with updated fields → 200
   - Change name to "Test Group Updated", maxPosts to 50
4. `GET /api/groups/:id` → 200, verify updated fields
5. `POST /api/groups` with duplicate URL → 409
6. `DELETE /api/groups/:id` → 200
7. `GET /api/groups/:id` on deleted group → 404

**Commands**:
```bash
# Create (replace TOKEN)
curl -X POST http://localhost:3000/api/groups \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"test-group-1","name":"Test Group","url":"https://facebook.com/groups/test","maxPosts":30}'

# List
curl http://localhost:3000/api/groups

# Update (replace ID and TOKEN)
curl -X PUT http://localhost:3000/api/groups/test-group-1 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Group Updated","maxPosts":50}'

# Duplicate URL → 409
curl -X POST http://localhost:3000/api/groups \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"test-group-2","name":"Duplicate","url":"https://facebook.com/groups/test"}'

# Delete
curl -X DELETE http://localhost:3000/api/groups/test-group-1 \
  -H "Authorization: Bearer TOKEN"
```

### Scenario 4: Admin UI — Login + Dashboard

**Goal**: Verify the admin SPA login flow and dashboard controls.

**Steps**:
1. Open `http://localhost:5173` (admin dev server)
   - Expected: Redirect to `/login` (no token)
2. Enter admin email + password, click "Iniciar sesión"
   - Expected: Redirect to `/` (dashboard), header shows "Admin" + logout button
3. Click "Scrapear ahora"
   - Expected: Button shows spinner, disables, then re-enables with "Último scrape: hace X minutos"
4. Click the admin name → "Cerrar sesión"
   - Expected: Redirect to `/login`, protected routes inaccessible

### Scenario 5: Admin UI — Group Management

**Goal**: Verify the group CRUD interface.

**Steps**:
1. Navigate to `/groups` (sidebar link "Grupos")
   - Expected: Table with existing groups (if any) or empty state
2. Click "Crear grupo"
   - Expected: Modal form with fields: id, name, URL, maxPosts, isActive toggle
3. Fill and submit
   - Expected: Group appears in table without page reload, with active badge
4. Click toggle on a group
   - Expected: Badge changes from active to inactive immediately
5. Click "Editar" on a group
   - Expected: Modal pre-populated with current values
6. Modify and save
   - Expected: Table updates with new values
7. Click "Eliminar" on a group
   - Expected: Confirmation dialog appears
8. Confirm deletion
   - Expected: Group disappears from table

## Verification Checklist

- [ ] Login returns dual tokens (access + refresh)
- [ ] Access token authorizes protected endpoints
- [ ] Refresh token rotation prevents replay
- [ ] Protected endpoints reject unauthenticated requests
- [ ] Public read endpoints (listings, groups, health) accessible without token
- [ ] Group CRUD: create, list, read, update, delete
- [ ] Duplicate group URL rejected with business error
- [ ] Non-existent group returns 404
- [ ] Dashboard buttons trigger scrape/AI and show visual feedback
- [ ] Group page lists all groups with active/inactive toggle
- [ ] Logout revokes session and redirects to login
- [ ] Expired token returns 401
