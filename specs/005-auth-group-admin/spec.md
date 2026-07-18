# Feature Specification: Autenticación + Administración de Grupos

**Feature Branch**: `005-auth-group-admin`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Spec 002 — Autenticación + Administración de Grupos. Login seguro con JWT dual + refresh rotation, CRUD de grupos de Facebook desde API y web, dashboard con controles funcionales, y protección de endpoints sensibles."

## User Scenarios & Testing

### User Story 1 — Inicio de Sesión Seguro con JWT Dual (Priority: P1)

Como administrador del sistema, quiero iniciar sesión con mi email y contraseña, obtener un par de tokens (access + refresh), y que la sesión se mantenga activa con renovación automática, para acceder al sistema de forma segura sin tener que autenticarme constantemente.

**Why this priority**: Sin autenticación, cualquier persona con acceso a la red puede disparar scrapes (que cuestan dinero en IA) y ver datos. Es la base de seguridad del sistema.

**Independent Test**: Puede probarse completamente haciendo `POST /api/auth/login` con credenciales válidas, verificando que devuelve `{ accessToken, refreshToken, expiresIn }`, usando el access token en un endpoint protegido, y renovando con `POST /api/auth/refresh`.

**Acceptance Scenarios**:

1. **Given** un administrador con credenciales válidas, **When** hace `POST /api/auth/login` con email y password correctos, **Then** recibe `{ accessToken, refreshToken, expiresIn }` con status 200
2. **Given** un administrador registrado, **When** hace `POST /api/auth/login` con password incorrecta, **Then** recibe error 401 sin revelar si el email existe o no
3. **Given** un access token válido, **When** se usa en un endpoint protegido, **Then** el request se procesa normalmente
4. **Given** un access token expirado pero refresh token válido, **When** hace `POST /api/auth/refresh` con el refresh token, **Then** recibe un nuevo par de tokens (access + refresh) y el refresh anterior se revoca
5. **Given** un refresh token ya utilizado, **When** se intenta usar de nuevo, **Then** recibe error 401 (refresh rotation evita replay)
6. **Given** un access token válido, **When** hace `POST /api/auth/logout`, **Then** la sesión se revoca y el token ya no es aceptado

---

### User Story 2 — Dashboard con Controles Operativos (Priority: P1)

Como administrador del sistema, quiero un dashboard que me permita disparar scrapes y procesamiento con IA desde la web con feedback visual, para operar el sistema sin abrir una terminal.

**Why this priority**: El dashboard actual muestra instrucciones CLI — irónico para un producto cuyo objetivo es eliminar el uso de la terminal. Esta historia convierte el dashboard en funcional.

**Independent Test**: Puede probarse haciendo clic en "Scrapear ahora", verificando que muestra un spinner durante el procesamiento, y que al completarse muestra la hora del último scrape exitoso y el botón se reactiva.

**Acceptance Scenarios**:

1. **Given** el administrador autenticado en el dashboard, **When** hace clic en "Scrapear ahora", **Then** se muestra un spinner y el botón se deshabilita
2. **Given** un scrape en progreso, **When** el scraper termina exitosamente, **Then** el spinner desaparece y se muestra la hora del último scrape exitoso
3. **Given** un scrape en progreso, **When** el scraper falla, **Then** se muestra un mensaje de error claro
4. **Given** el dashboard, **When** hay un job en progreso, **Then** los botones de acción permanecen deshabilitados hasta que termine
5. **Given** el dashboard, **When** hace clic en "Procesar con IA", **Then** sigue el mismo patrón de feedback que el scrape

---

### User Story 3 — Administración de Grupos de Facebook (Priority: P2)

Como administrador del sistema, quiero gestionar los grupos de Facebook desde la web (crear, editar, activar/desactivar, eliminar) sin tocar archivos de configuración, para configurar dinámicamente las fuentes de datos del sistema.

**Why this priority**: Hoy los grupos se configuran solo en `FB_GROUPS` del `.env`. Añadir un grupo requiere editar el archivo, reiniciar el contenedor y redesplegar. En un producto profesional esto debe hacerse desde la interfaz.

**Independent Test**: Puede probarse creando un grupo desde la UI, verificando que aparece en la tabla, editando sus datos, desactivándolo, y eliminándolo — todo sin reiniciar el servidor.

**Acceptance Scenarios**:

1. **Given** el administrador en la página de grupos, **When** hace clic en "Crear grupo" y completa el formulario, **Then** el grupo aparece en la tabla sin recargar la página
2. **Given** un grupo existente, **When** hace clic en "Editar" y modifica campos, **Then** los cambios se guardan y la tabla se actualiza
3. **Given** un grupo existente, **When** cambia el toggle de activo/inactivo, **Then** el estado cambia sin recargar la página
4. **Given** un grupo existente, **When** hace clic en "Eliminar", **Then** aparece un diálogo de confirmación y al confirmar el grupo desaparece
5. **Given** la página de grupos, **When** carga, **Then** muestra una tabla con columnas: nombre, URL, maxPosts, activo, última ejecución

---

### User Story 4 — Protección de Endpoints Sensibles (Priority: P1 — Foundation)

Como administrador del sistema, quiero que los endpoints que modifican datos o consumen recursos (scrape, AI process, schedule, grupos) estén protegidos por autenticación, mientras que los endpoints de solo lectura (listings) sigan siendo públicos, para balancear seguridad y usabilidad.

**Why this priority**: Complementa la historia US1. Sin esta protección, tener un sistema de login no sirve de nada.

**Independent Test**: Puede probarse haciendo `POST /api/scrape` sin token (debe dar 401), con token válido (debe funcionar), y verificando que `GET /api/listings` funciona sin token.

**Acceptance Scenarios**:

1. **Given** un request sin token, **When** accede a `POST /api/scrape`, **Then** recibe error 401
2. **Given** un request sin token, **When** accede a `POST /api/ai-process`, **Then** recibe error 401
3. **Given** un request sin token, **When** accede a `PUT /api/schedule`, **Then** recibe error 401
4. **Given** un request sin token, **When** accede a `POST /api/groups`, `PUT /api/groups/:id` o `DELETE /api/groups/:id`, **Then** recibe error 401
5. **Given** un request sin token, **When** accede a `GET /api/listings` o `GET /api/groups`, **Then** la request se procesa normalmente
6. **Given** un request con token expirado, **When** accede a cualquier endpoint protegido, **Then** recibe error 401 con mensaje descriptivo

---

### Edge Cases

- ¿Qué pasa si el login se intenta múltiples veces con credenciales incorrectas? El endpoint debe tener rate limiting para prevenir fuerza bruta
- ¿Qué pasa si se intenta crear un grupo con una URL duplicada? El sistema debe rechazar con error de negocio claro
- ¿Qué pasa si se intenta eliminar un grupo que el scraper está usando actualmente? La eliminación debe permitirse; el scraper fallará gracefulmente en el próximo ciclo
- ¿Qué pasa si no hay seed de admin inicial? El sistema debe tener un mecanismo para crear el primer admin (seed command, env var, o bootstrap endpoint)
- ¿Qué pasa si el refresh token está malformado o es inválido? El sistema debe responder con error 401 sin exponer detalles técnicos
- ¿Qué pasa si el token de acceso está malformado? El sistema debe responder con error 401 genérico

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide `POST /api/auth/login` accepting email and password, returning `{ accessToken, refreshToken, expiresIn }` on success
- **FR-002**: System MUST validate credentials using a one-way password hashing algorithm with a unique salt per user, comparing with timing-safe equality
- **FR-003**: System MUST respond with HTTP 401 for invalid credentials, without distinguishing between "email not found" and "wrong password"
- **FR-004**: System MUST implement access tokens that expire after a configurable period (default 24 hours)
- **FR-005**: System MUST implement refresh tokens that can be exchanged for a new access + refresh pair via `POST /api/auth/refresh`
- **FR-006**: System MUST implement refresh rotation — each refresh request revokes the previous refresh token and issues a new pair; reusing an old refresh token MUST be rejected
- **FR-007**: System MUST provide `POST /api/auth/logout` that revokes the current session, requiring a valid access token
- **FR-008**: System MUST require a valid access token on `POST /api/scrape`, `POST /api/ai-process`, `PUT /api/schedule`, `POST /api/groups`, `PUT /api/groups/:id`, and `DELETE /api/groups/:id`
- **FR-009**: System MUST allow unauthenticated access to `GET /api/listings`, `GET /api/groups`, `GET /api/health`, and `POST /api/auth/login`
- **FR-010**: System MUST provide `GET /api/groups` that returns all groups, paginated with envelope format `{ data, pagination }`
- **FR-011**: System MUST provide `POST /api/groups` (authenticated) to create a group with name, URL, maxPosts, and isActive fields
- **FR-012**: System MUST reject duplicate group URLs with a business error
- **FR-013**: System MUST provide `PUT /api/groups/:id` (authenticated) to update an existing group's configuration
- **FR-014**: System MUST provide `DELETE /api/groups/:id` (authenticated) to remove a group
- **FR-015**: System MUST return HTTP 404 when requesting, updating, or deleting a non-existent group
- **FR-016**: System MUST validate all group input: name required, URL required and valid format, maxPosts >= 1, isActive defaults to true
- **FR-017**: System MUST have a seed mechanism to create the initial admin user (via seed command at startup or environment variable), with only one admin user per system instance
- **FR-018**: System MUST log all authentication attempts (success and failure) with timestamp for audit
- **FR-019**: System MUST store refresh tokens as SHA-256 hashes in the `auth_sessions` table, never as plain text
- **FR-020**: System MUST provide a dashboard UI with "Scrapear ahora" and "Procesar con IA" buttons that show loading state during execution and prevent duplicate submissions

### Key Entities

- **AuthSession**: Represents an active session. Contains userId, tokenHash (SHA-256 of refresh token), expiresAt, revokedAt (nullable — set on logout or token rotation), and createdAt. A session is valid if not expired and not revoked.
- **Group**: Represents a Facebook group to scrape. Contains name, URL (unique), maxPosts limit, isActive flag (enables/disables scraping without deletion), lastScraped timestamp, and timestamps (createdAt, updatedAt).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Login with valid credentials completes in under 1 second (network round-trip excluded)
- **SC-002**: Invalid credentials are rejected consistently — the error response is identical whether the email exists or not
- **SC-003**: Refresh token rotation is enforced — reusing a rotated refresh token is rejected with HTTP 401
- **SC-004**: All protected endpoints (scrape, AI process, schedule mutations, group mutations) reject unauthenticated requests with HTTP 401
- **SC-005**: All read-only endpoints (listings, groups list, health) remain accessible without authentication
- **SC-006**: Group CRUD operations respond in under 500ms for standard payloads
- **SC-007**: Dashboard buttons provide visual feedback (loading state, completion, error) within 200ms of user click
- **SC-008**: The initial admin seed mechanism works on first startup — verifiable by starting the system fresh and successfully logging in
- **SC-009**: Duplicate group URLs are rejected with a clear business error — verifiable by creating the same group URL twice

## Out of Scope

- Multi-user support or roles — single admin only
- User registration or password reset via API
- OAuth2 or SSO integration — email/password with JWT only
- Edición de listings (Spec 003)
- Raw posts page (Spec 003)
- Historial de scrapes (Spec 003)
- Group-specific scrape schedules (all groups share the global scheduler from Spec 001)

## Assumptions

- The existing `Group` table already exists in the database (modeled but not yet exposed via CRUD endpoints)
- The existing envelope response format `{ data, pagination }` from Spec 001 applies to group list endpoints
- The existing error format `{ error: { code, message, requestId, timestamp } }` from Spec 001 applies to all errors
- The existing health endpoint `GET /api/health` remains public
- Password minimum length is 8 characters
- The system runs behind HTTPS in production (token security relies on transport encryption)
- Single admin means exactly one administrative user per system instance
- Rate limiting on the login endpoint is handled by infrastructure (reverse proxy or API gateway), not application code
- Access token claims include: `sub` (userId), `typ` ("access" or "refresh"), `jti` (unique token ID)
- The `auth_sessions` table stores only refresh token hashes; access tokens are stateless and validated by signature alone
