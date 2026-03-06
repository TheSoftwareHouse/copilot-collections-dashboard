# Story 2.1: User can log in with username and password — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 2.1 |
| Title | User can log in with username and password |
| Description | Enable users to securely access the application through username/password authentication with server-side session management. Unauthenticated users are redirected to a login page. Sessions expire after a period of inactivity. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md` |

## Proposed Solution

Implement custom session-based authentication using **bcryptjs** for password hashing, **database-backed sessions** with cryptographic tokens stored in **HTTP-only cookies**, and a **Zod**-validated login API. The auth guard is integrated into the existing `(app)` route group layout alongside the configuration guard.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Next.js App                                │
│                                                                      │
│  ┌──────────────┐                                                    │
│  │  /login page  │─── POST /api/auth/login ──┐                       │
│  │ (Server Comp.)│                            │                       │
│  │ + LoginForm   │◀── Set-Cookie: session ────┤                       │
│  └──────────────┘                            │                       │
│                                               ▼                       │
│  ┌───────────────────────────────────────────────────────────┐       │
│  │                    (app) Route Group                       │       │
│  │  ┌─────────────────────────────────────┐                  │       │
│  │  │         (app)/layout.tsx             │                  │       │
│  │  │  1. Check config → /setup           │                  │       │
│  │  │  2. Check session → /login          │                  │       │
│  │  │  3. Render NavBar + children        │                  │       │
│  │  └─────────────┬───────────────────────┘                  │       │
│  │                │                                          │       │
│  │   ┌────────────┼──────────────┐                           │       │
│  │   ▼            ▼              ▼                           │       │
│  │ /dashboard   /settings   (future pages)                   │       │
│  └───────────────────────────────────────────────────────────┘       │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐       │
│  │              Protected API Routes                          │       │
│  │  GET/PUT /api/configuration ──┐                            │       │
│  │  GET /api/job-status ─────────┤── requireAuth() ── 401 ── │       │
│  └───────────────────────────────┤────────────────────────────┘       │
│                                  ▼                                    │
│  ┌──────────┐     ┌──────────────────────────────────────┐           │
│  │PostgreSQL │     │  Auth Utilities                      │           │
│  │           │◀────│  src/lib/auth.ts + src/lib/api-auth.ts│          │
│  │ app_user  │     │  - hashPassword / verifyPassword     │           │
│  │ session   │     │  - createSession / getSession        │           │
│  └──────────┘     │  - destroySession / requireAuth      │           │
│                    │  - seedDefaultAdmin                  │           │
│                    └──────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Custom auth over NextAuth.js**: The project only needs username/password auth for an internal admin dashboard. NextAuth would be overkill and introduce schema/session management that conflicts with the existing TypeORM setup. Custom implementation keeps dependencies minimal, consistent with the project philosophy.

2. **Database-backed sessions over JWT**: Server-side session storage enables session invalidation on logout, forced expiry on inactivity (acceptance criterion), and future user removal (Story 2.2 requirement where removed users lose access). The DB query per request is acceptable for a low-traffic admin tool.

3. **bcryptjs (pure JS)**: No native compilation required — works cleanly in Docker, CI, and all Node.js environments. Industry-standard for password hashing with configurable cost factor (10 rounds).

4. **HTTP-only cookie for session token**: Prevents XSS-based session theft. `SameSite=Lax` allows normal navigation. `Secure` flag enabled in production. Session token is 32 cryptographically random bytes (64 hex chars).

5. **Sliding-window session expiry**: On every authenticated request, `expiresAt` is refreshed to `now + timeout` (default 24 hours). This implements the "expires after inactivity" acceptance criterion without premature logouts for active users.

6. **Default admin auto-seeding**: On login page load, if no users exist and `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` environment variables are set, a default admin is created automatically. Follows 12-factor app principles — credentials are never hardcoded.

7. **Auth guard in `(app)` layout**: Extends the existing configuration guard pattern. Config check runs first (redirects to `/setup`), then auth check (redirects to `/login`). Login and setup pages are outside the `(app)` route group and always accessible.

8. **Table naming**: User table is `app_user` (not `user`) to avoid PostgreSQL reserved word conflicts.

### Data Model

```
┌──────────────────────────────┐       ┌──────────────────────────────┐
│          app_user            │       │           session             │
├──────────────────────────────┤       ├──────────────────────────────┤
│ id          : serial (PK)   │◀──┐   │ id         : serial (PK)     │
│ username    : varchar(255)   │   │   │ token      : varchar(64) UQ  │
│              UNIQUE          │   └───│ userId     : int (FK)        │
│ passwordHash: varchar(255)   │       │ expiresAt  : timestamptz     │
│ createdAt   : timestamptz    │       │ createdAt  : timestamptz     │
│ updatedAt   : timestamptz    │       └──────────────────────────────┘
└──────────────────────────────┘
                                       Indices:
                                       - IDX_session_token (token)
                                       - IDX_session_userId (userId)
                                       FK: session.userId → app_user.id ON DELETE CASCADE
```

### API Contracts

**POST /api/auth/login**
| Status | Body | Cookie |
|--------|------|--------|
| 200 | `{ username }` | `session_token=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400` |
| 400 | `{ error, details }` | — |
| 401 | `{ error: "Invalid username or password" }` | — |

**POST /api/auth/logout**
| Status | Body | Cookie |
|--------|------|--------|
| 200 | `{ success: true }` | `session_token=; Max-Age=0` |

### Session Configuration

| Parameter | Default | Env Var |
|-----------|---------|---------|
| Cookie name | `session_token` | — |
| Idle timeout | 24 hours | `SESSION_TIMEOUT_HOURS` |
| Token length | 32 bytes (64 hex chars) | — |
| Bcrypt rounds | 10 | — |

## Current Implementation Analysis

### Already Implemented
- `src/app/(app)/layout.tsx` — Route group layout with configuration guard (will be extended with auth guard)
- `src/components/NavBar.tsx` — Navigation bar component (will add logout button)
- `src/lib/db.ts` — Database connection singleton (reused for auth queries)
- `src/lib/data-source.ts` — TypeORM data source configuration (will register new entities)
- `src/lib/data-source.cli.ts` — CLI data source for migrations (will register new entities)
- `src/test/db-helpers.ts` — Test database helpers (will add new entities and cleanup)
- `src/entities/enums.ts` — Shared enum definitions (no changes needed for auth)
- `src/lib/validations/configuration.ts` — Zod validation pattern (reuse same approach for login schema)
- `src/components/setup/ConfigurationForm.tsx` — Form component pattern (reuse same patterns for LoginForm)
- `src/app/api/configuration/route.ts` — Configuration API with GET/POST/PUT handlers (will add auth guard to GET and PUT)
- `src/app/api/job-status/route.ts` — Job status API with GET handler (will add auth guard)

### To Be Modified
- `src/app/(app)/layout.tsx` — Add session validation after config check; redirect to `/login` if unauthenticated
- `src/components/NavBar.tsx` — Add logout button with form-based POST to `/api/auth/logout`
- `src/lib/data-source.ts` — Add `UserEntity` and `SessionEntity` to entities array
- `src/lib/data-source.cli.ts` — Add `UserEntity` and `SessionEntity` to entities array
- `src/test/db-helpers.ts` — Add `UserEntity` and `SessionEntity` to test data source entities; add user/session table cleanup
- `package.json` — Add `bcryptjs` and `@types/bcryptjs` dependencies
- `src/app/api/configuration/route.ts` — Add `requireAuth()` guard to `GET` and `PUT` handlers; `POST` remains public (first-run setup before any user exists)
- `src/app/api/job-status/route.ts` — Add `requireAuth()` guard to `GET` handler
- `e2e/first-run-setup.spec.ts` — Add auth seeding/login helper to tests that access `(app)` pages
- `e2e/configuration-settings.spec.ts` — Add login step to `beforeEach` so tests can access `/settings`
- `e2e/job-status.spec.ts` — Add login step to `beforeEach` so tests can access `/settings`

### To Be Created
- `src/entities/user.entity.ts` — User entity (EntitySchema pattern)
- `src/entities/session.entity.ts` — Session entity (EntitySchema pattern)
- `migrations/XXXX-CreateAppUser.ts` — Migration for `app_user` table
- `migrations/XXXX-CreateSession.ts` — Migration for `session` table
- `src/lib/auth.ts` — Auth utilities (hashPassword, verifyPassword, createSession, getSession, destroySession, seedDefaultAdmin)
- `src/lib/validations/login.ts` — Zod schema for login input validation
- `src/lib/api-auth.ts` — Reusable `requireAuth()` helper for API route protection
- `src/app/api/auth/login/route.ts` — Login API route handler
- `src/app/api/auth/logout/route.ts` — Logout API route handler
- `src/app/login/page.tsx` — Login page (server component)
- `src/components/auth/LoginForm.tsx` — Login form (client component)
- `src/lib/validations/__tests__/login.test.ts` — Login validation unit tests
- `src/app/api/auth/__tests__/login.route.test.ts` — Login API integration tests
- `src/app/api/auth/__tests__/logout.route.test.ts` — Logout API integration tests
- `src/lib/__tests__/api-auth.test.ts` — Unit tests for `requireAuth()` helper
- `e2e/auth.spec.ts` — E2E tests for login/logout flow
- `e2e/helpers/auth.ts` — E2E helper for seeding users and logging in

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | How is the initial admin user created? | Auto-seeded from `DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` environment variables when no users exist. Triggered lazily on login page load. | ✅ Resolved |
| 2 | Should API routes also require authentication? | Yes. Both page-level (layout guard) and API-level protection are in scope. A reusable `requireAuth()` helper returns `401` for unauthenticated API requests. Protected routes: `GET/PUT /api/configuration`, `GET /api/job-status`. Public routes: `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/configuration` (first-run, before any user exists). | ✅ Resolved |
| 3 | Should the `/setup` page require auth after initial setup? | No. The setup page is outside the `(app)` route group and has its own guard (redirects to `/dashboard` if config exists). Authentication for the setup page is out of scope — it was designed pre-auth per Story 1.1 plan. | ✅ Resolved |
| 4 | What session timeout duration should be used? | 24 hours of inactivity (sliding window). Configurable via `SESSION_TIMEOUT_HOURS` env var. | ✅ Resolved |
| 5 | How to handle existing E2E tests that will break with auth? | Update existing E2E tests to include user seeding and login steps. Create shared E2E helper for auth setup. | ✅ Resolved |

## Implementation Plan

### Phase 1: Database Schema & Entities

#### Task 1.1 - [CREATE] User Entity
**Description**: Create the `app_user` database entity using the TypeORM EntitySchema pattern, consistent with existing entities (`configuration.entity.ts`, `job-execution.entity.ts`).

**Definition of Done**:
- [x] Entity file created at `src/entities/user.entity.ts` using `EntitySchema` pattern
- [x] `User` interface exported with fields: `id` (number), `username` (string), `passwordHash` (string), `createdAt` (Date), `updatedAt` (Date)
- [x] `UserEntity` exported as an `EntitySchema<User>` with table name `app_user`
- [x] `username` column has `unique: true` constraint
- [x] `passwordHash` column is `varchar(255)` and not nullable
- [x] `createdAt` uses `createDate: true`, `updatedAt` uses `updateDate: true` — matching existing entity conventions
- [x] File compiles without TypeScript errors

#### Task 1.2 - [CREATE] Session Entity
**Description**: Create the `session` database entity for storing server-side session records.

**Definition of Done**:
- [x] Entity file created at `src/entities/session.entity.ts` using `EntitySchema` pattern
- [x] `Session` interface exported with fields: `id` (number), `token` (string), `userId` (number), `expiresAt` (Date), `createdAt` (Date)
- [x] `SessionEntity` exported as an `EntitySchema<Session>` with table name `session`
- [x] `token` column is `varchar(64)` with `unique: true`
- [x] `userId` column is `int` and not nullable
- [x] Index `IDX_session_token` on `token` column for fast lookups
- [x] Index `IDX_session_userId` on `userId` column
- [x] File compiles without TypeScript errors

#### Task 1.3 - [MODIFY] Register Entities in Data Sources
**Description**: Add `UserEntity` and `SessionEntity` to both the application and CLI data source configurations so TypeORM recognises them for queries and migrations.

**Definition of Done**:
- [x] `src/lib/data-source.ts` imports and includes `UserEntity` and `SessionEntity` in the `entities` array
- [x] `src/lib/data-source.cli.ts` imports and includes `UserEntity` and `SessionEntity` in the `entities` array
- [x] `src/test/db-helpers.ts` imports and includes `UserEntity` and `SessionEntity` in the test data source `entities` array
- [x] `cleanDatabase` function in `db-helpers.ts` also clears `session` and `app_user` tables (session before app_user due to FK constraint)
- [x] Application starts without errors after changes

#### Task 1.4 - [CREATE] Database Migrations
**Description**: Generate TypeORM migrations for the `app_user` and `session` tables.

**Definition of Done**:
- [x] Migration for `app_user` table generated via `npm run typeorm:generate` and placed in `migrations/` directory
- [x] Migration for `session` table generated (may be combined in a single migration if generated together)
- [x] Migration includes foreign key constraint from `session.userId` to `app_user.id` with `ON DELETE CASCADE`
- [x] Migrations apply cleanly on a fresh database (`npm run typeorm:migrate`)
- [x] Migrations revert cleanly (`npm run typeorm:revert`)

### Phase 2: Authentication Core

#### Task 2.1 - [CREATE] Auth Utilities
**Description**: Create the core authentication utility module with password hashing, session management, and default admin seeding functions.

**Definition of Done**:
- [x] File created at `src/lib/auth.ts`
- [x] `hashPassword(password: string): Promise<string>` — uses bcryptjs with 10 salt rounds
- [x] `verifyPassword(password: string, hash: string): Promise<boolean>` — compares plaintext against bcrypt hash
- [x] `createSession(userId: number): Promise<string>` — generates 32-byte random hex token, stores session in DB with expiry (`now + SESSION_TIMEOUT`), returns token
- [x] `getSession(): Promise<{ user: { id: number; username: string } } | null>` — reads `session_token` cookie via `next/headers`, looks up session in DB, returns null if missing or expired, refreshes `expiresAt` for valid sessions (sliding window)
- [x] `destroySession(): Promise<void>` — reads session token from cookie, deletes session record from DB
- [x] `seedDefaultAdmin(): Promise<void>` — if no users exist in DB and `DEFAULT_ADMIN_USERNAME` + `DEFAULT_ADMIN_PASSWORD` env vars are set, creates a user with hashed password
- [x] Session timeout defaults to 24 hours, configurable via `SESSION_TIMEOUT_HOURS` env var
- [x] `SESSION_COOKIE_NAME` constant exported for reuse
- [x] `bcryptjs` and `@types/bcryptjs` added to `package.json` dependencies/devDependencies

#### Task 2.2 - [CREATE] API Route Auth Guard Helper
**Description**: Create a reusable helper function that API route handlers can call to verify the session cookie and reject unauthenticated requests with a consistent `401` response. This ensures API endpoints are protected independently of the layout-level page guard.

**Definition of Done**:
- [x] File created at `src/lib/api-auth.ts`
- [x] `requireAuth()` function exported: reads `session_token` cookie from the incoming request via `next/headers`, calls `getSession()` to validate the session
- [x] Returns `{ user: { id, username } }` on success (session is valid)
- [x] Returns a `NextResponse` with `401` status and `{ error: "Authentication required" }` on failure (missing cookie, expired session, invalid token)
- [x] Refreshes `expiresAt` on valid session access (reuses sliding-window logic from `getSession`)
- [x] Unit tests at `src/lib/__tests__/api-auth.test.ts` verify: returns user for valid session, returns 401 for missing cookie, returns 401 for expired session

#### Task 2.3 - [CREATE] Login Validation Schema
**Description**: Create a Zod schema for validating login input, following the same pattern as `src/lib/validations/configuration.ts`.

**Definition of Done**:
- [x] Schema file created at `src/lib/validations/login.ts`
- [x] `loginSchema` validates `username` as a non-empty trimmed string (max 255 chars)
- [x] `loginSchema` validates `password` as a non-empty string (no trimming — passwords may have leading/trailing spaces)
- [x] `LoginInput` TypeScript type inferred from schema and exported
- [x] Descriptive error messages for each validation rule
- [x] Unit tests at `src/lib/validations/__tests__/login.test.ts` verify: accepts valid input, rejects empty username, rejects empty password, rejects oversized username

#### Task 2.4 - [CREATE] Login API Route
**Description**: Create the `POST /api/auth/login` route handler that validates credentials, creates a session, and sets the session cookie.

**Definition of Done**:
- [x] Route handler created at `src/app/api/auth/login/route.ts`
- [x] `POST` handler parses request body and validates with `loginSchema`
- [x] Returns `400` with structured validation errors for invalid input
- [x] Looks up user by username in `app_user` table
- [x] Verifies password against stored hash using `verifyPassword`
- [x] Returns `401` with `{ error: "Invalid username or password" }` for wrong username or wrong password (generic message — does not reveal which is incorrect)
- [x] On valid credentials: creates session via `createSession`, sets `session_token` HTTP-only cookie, returns `200` with `{ username }`
- [x] Cookie attributes: `HttpOnly`, `Secure` (production only), `SameSite=Lax`, `Path=/`, `Max-Age` matching session timeout
- [x] Calls `seedDefaultAdmin()` before credential check to ensure default admin exists on first access
- [x] Integration tests at `src/app/api/auth/__tests__/login.route.test.ts` verify: valid login returns 200 + cookie, invalid password returns 401, unknown username returns 401, validation errors return 400, default admin seeding works

#### Task 2.5 - [CREATE] Logout API Route
**Description**: Create the `POST /api/auth/logout` route handler that destroys the session and clears the cookie.

**Definition of Done**:
- [x] Route handler created at `src/app/api/auth/logout/route.ts`
- [x] `POST` handler reads session token from cookie
- [x] Deletes session record from DB (if it exists)
- [x] Clears `session_token` cookie by setting `Max-Age=0`
- [x] Returns `200` with `{ success: true }` (idempotent — works even if no session exists)
- [x] Integration tests at `src/app/api/auth/__tests__/logout.route.test.ts` verify: logout with valid session clears it, logout without session still returns 200

### Phase 3: Login UI & Auth Guard

#### Task 3.1 - [CREATE] LoginForm Client Component
**Description**: Build a client component that renders username/password inputs with form submission, validation, loading state, and error display. Follows the same UI patterns as `ConfigurationForm.tsx`.

**Definition of Done**:
- [x] Component created at `src/components/auth/LoginForm.tsx` as a `"use client"` component
- [x] Text input for username with label "Username"
- [x] Password input (type="password") for password with label "Password"
- [x] Client-side validation using `loginSchema` with inline error messages
- [x] Submit button with loading/disabled state during API call (label: "Sign in")
- [x] On submit: sends POST to `/api/auth/login`
- [x] On success (200): redirects to `/dashboard` using `useRouter().push()`
- [x] On auth failure (401): displays server error message ("Invalid username or password")
- [x] On validation error (400): displays field-level error messages
- [x] On network/server error: displays generic error message
- [x] Component is accessible: proper `<label>` associations, `aria-describedby` for errors, `aria-invalid` on invalid fields, keyboard-navigable
- [x] Visual style consistent with existing `ConfigurationForm` (same Tailwind utility class patterns)

#### Task 3.2 - [CREATE] Login Page
**Description**: Create the `/login` page outside the `(app)` route group, accessible without authentication. The page triggers default admin seeding.

**Definition of Done**:
- [x] Page created at `src/app/login/page.tsx` as a Server Component
- [x] Server-side: calls `seedDefaultAdmin()` to ensure default admin exists on first access
- [x] Server-side: calls `getSession()` — if a valid session exists, redirect to `/dashboard` (prevents authenticated users from seeing login page)
- [x] Renders a centred card layout with heading "Sign in to Copilot Dashboard", descriptive text, and `LoginForm` component
- [x] Visual style consistent with the setup page (`/setup`) — centred, clean, minimal
- [x] Page has `<title>` via metadata export: "Sign In — Copilot Dashboard"
- [x] Page is responsive (works on desktop and tablet viewports)

#### Task 3.3 - [MODIFY] App Layout — Add Auth Guard
**Description**: Extend the `(app)/layout.tsx` to check for an authenticated session after the configuration check. Unauthenticated requests redirect to `/login`.

**Definition of Done**:
- [x] `(app)/layout.tsx` calls `getSession()` after confirming configuration exists
- [x] If `getSession()` returns null, calls `redirect('/login')` from `next/navigation`
- [x] If session is valid, renders `NavBar` and `children` as before
- [x] Configuration check still redirects to `/setup` before auth check (config is more fundamental)
- [x] `/setup` and `/login` pages remain accessible without authentication (they are outside `(app)`)
- [x] Verified: navigating to `/dashboard` without session redirects to `/login`
- [x] Verified: navigating to `/dashboard` with valid session renders the dashboard

#### Task 3.4 - [MODIFY] NavBar — Add Logout
**Description**: Add a logout button to the navigation bar, allowing users to end their session.

**Definition of Done**:
- [x] `NavBar.tsx` includes a "Sign out" button positioned on the right side of the nav bar
- [x] Clicking "Sign out" sends a POST request to `/api/auth/logout`
- [x] On successful logout, browser redirects to `/login`
- [x] Button is styled consistently with the existing nav bar design (text button, not overly prominent)
- [x] Button is accessible (proper label, keyboard-operable)

#### Task 3.5 - [MODIFY] Protect Configuration API Route
**Description**: Add authentication checks to the configuration API route. `GET` and `PUT` handlers require a valid session. `POST` remains public because it is used during first-run setup when no users may exist yet.

**Definition of Done**:
- [x] `src/app/api/configuration/route.ts` `GET` handler calls `requireAuth()` at the start; returns `401` if unauthenticated
- [x] `src/app/api/configuration/route.ts` `PUT` handler calls `requireAuth()` at the start; returns `401` if unauthenticated
- [x] `POST` handler remains unchanged (public — first-run setup)
- [x] Existing integration tests updated to provide a valid session for `GET` and `PUT` tests
- [x] New integration tests verify: `GET` without session returns `401`, `PUT` without session returns `401`

#### Task 3.6 - [MODIFY] Protect Job Status API Route
**Description**: Add authentication check to the job status API route.

**Definition of Done**:
- [x] `src/app/api/job-status/route.ts` `GET` handler calls `requireAuth()` at the start; returns `401` if unauthenticated
- [x] Existing integration tests updated to provide a valid session
- [x] New integration test verifies: `GET` without session returns `401`

### Phase 4: Testing

#### Task 4.1 - [CREATE] Login Validation Unit Tests
**Description**: Unit tests for the login Zod schema.

**Definition of Done**:
- [x] Test file at `src/lib/validations/__tests__/login.test.ts`
- [x] Tests verify: valid input accepted, empty username rejected, empty password rejected, oversized username rejected (255+ chars), whitespace-only username rejected
- [x] All tests pass

#### Task 4.2 - [CREATE] API Auth Guard Unit Tests
**Description**: Unit tests for the `requireAuth()` helper.

**Definition of Done**:
- [x] Test file at `src/lib/__tests__/api-auth.test.ts`
- [x] Tests: returns user object when session is valid
- [x] Tests: returns 401 `NextResponse` when no session cookie is present
- [x] Tests: returns 401 `NextResponse` when session is expired
- [x] Tests: returns 401 `NextResponse` when session token is invalid/unknown
- [x] All tests pass

#### Task 4.3 - [CREATE] Login API Integration Tests
**Description**: Integration tests for the login API route using a test database.

**Definition of Done**:
- [x] Test file at `src/app/api/auth/__tests__/login.route.test.ts`
- [x] Mocks `@/lib/db` to return test data source (same pattern as `configuration/route.test.ts`)
- [x] Tests: valid credentials return 200 with `{ username }` and `set-cookie` header
- [x] Tests: invalid password returns 401 with generic error
- [x] Tests: unknown username returns 401 with generic error
- [x] Tests: missing/invalid body returns 400 with validation errors
- [x] Tests: default admin is seeded when no users exist and env vars are set
- [x] Database cleaned between tests for isolation
- [x] All tests pass

#### Task 4.4 - [CREATE] Logout API Integration Tests
**Description**: Integration tests for the logout API route.

**Definition of Done**:
- [x] Test file at `src/app/api/auth/__tests__/logout.route.test.ts`
- [x] Tests: logout with valid session deletes session from DB and clears cookie
- [x] Tests: logout without session returns 200 (idempotent)
- [x] All tests pass

#### Task 4.5 - [MODIFY] Update Existing API Integration Tests for Auth
**Description**: Existing integration tests for `/api/configuration` and `/api/job-status` need to account for the auth guard. Tests that call protected handlers must provide a valid session.

**Definition of Done**:
- [x] `src/app/api/configuration/__tests__/route.test.ts` updated: test setup seeds a user and creates a session; `GET` and `PUT` tests include a valid session cookie mock
- [x] New test cases added: `GET /api/configuration` without session returns `401`, `PUT /api/configuration` without session returns `401`
- [x] `POST /api/configuration` tests continue to work without a session (public endpoint)
- [x] `src/app/api/job-status/__tests__/route.test.ts` updated: test setup includes a valid session; new test verifies `GET` without session returns `401`
- [x] All existing and new integration tests pass

#### Task 4.6 - [CREATE] Auth E2E Tests
**Description**: End-to-end tests for the complete login/logout flow.

**Definition of Done**:
- [x] Test file at `e2e/auth.spec.ts`
- [x] E2E helper file at `e2e/helpers/auth.ts` with functions: `seedTestUser(username, password)`, `loginViaApi(page, username, password)` (POSTs to login API and sets cookie), `clearAuthData()` (deletes sessions and users from DB)
- [x] Test: unauthenticated user visiting `/dashboard` is redirected to `/login`
- [x] Test: user enters valid credentials → redirected to `/dashboard`
- [x] Test: user enters invalid credentials → error message displayed, stays on `/login`
- [x] Test: user enters empty fields → validation errors displayed
- [x] Test: authenticated user visiting `/login` is redirected to `/dashboard`
- [x] Test: user clicks "Sign out" → redirected to `/login`, cannot access `/dashboard` without logging in again
- [x] All E2E tests pass

#### Task 4.7 - [MODIFY] Update Existing E2E Tests for Auth
**Description**: Existing E2E tests (`first-run-setup.spec.ts`, `configuration-settings.spec.ts`, `job-status.spec.ts`) need to account for the auth guard. Tests that access pages inside the `(app)` route group must include a login step.

**Definition of Done**:
- [x] `e2e/configuration-settings.spec.ts` `beforeEach` seeds a test user and logs in via API before navigating to `/settings`
- [x] `e2e/job-status.spec.ts` `beforeEach` seeds a test user and logs in via API before navigating to `/settings`
- [x] `e2e/first-run-setup.spec.ts` updated: tests that verify post-setup redirect to `/dashboard` account for login redirect (after config setup, user may be redirected to `/login` first, then to `/dashboard` after login)
- [x] Shared auth helper imported from `e2e/helpers/auth.ts` in all updated test files
- [x] All existing E2E tests continue to pass with the auth layer active

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (EntitySchema pattern, Zod validation, Tailwind styling, file naming)
- [x] Test coverage is adequate for the feature scope

## Security Considerations

- **Password Storage**: Passwords are hashed with bcryptjs (10 salt rounds) before storage. Plaintext passwords are never persisted or logged. The `passwordHash` column stores only the bcrypt hash.
- **Generic Authentication Errors**: The login endpoint returns "Invalid username or password" for both wrong username and wrong password. This prevents username enumeration attacks.
- **Session Token Security**: Tokens are 32 bytes of cryptographically random data (via `crypto.randomBytes`), hex-encoded to 64 characters. Tokens are stored hashed or in plaintext in the session table (plaintext is acceptable since the session table is server-side only and tokens are short-lived).
- **HTTP-Only Cookies**: The `session_token` cookie is `HttpOnly`, preventing JavaScript access and mitigating XSS-based session theft. `SameSite=Lax` prevents CSRF in most scenarios. `Secure` flag is enabled in production.
- **API Route Protection**: All data-serving API routes (`GET/PUT /api/configuration`, `GET /api/job-status`) require a valid session. Unauthenticated requests receive a `401` response with no data leakage. `POST /api/configuration` is intentionally public to support first-run setup before any user exists.
- **Session Expiry**: Sessions expire after 24 hours of inactivity (sliding window). Expired sessions are cleaned up on next access. The `ON DELETE CASCADE` foreign key ensures sessions are removed when a user is deleted.
- **No Default Credentials in Code**: The default admin credentials are sourced exclusively from environment variables (`DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`). If these env vars are not set, no default admin is created and the login page displays guidance.
- **CSRF Protection**: Logout uses a POST request (not GET). Next.js API routes enforce same-origin via built-in header checks. The login form submits to a same-origin API endpoint.
- **Timing Attacks**: bcryptjs `compare` has constant-time comparison built in, preventing timing-based password guessing.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Login page is displayed when user is not authenticated (visiting any `(app)` page redirects to `/login`)
- [x] User can enter username and password to log in (form with proper inputs)
- [x] Valid credentials grant access to the application (after login, user can access `/dashboard` and `/settings`)
- [x] Invalid credentials display a clear error message ("Invalid username or password")
- [x] Authenticated session is maintained across page navigation (cookie persists, session validated on each request)
- [x] Session expires after a period of inactivity and the user is redirected to the login page
- [x] API routes (`GET /api/configuration`, `PUT /api/configuration`, `GET /api/job-status`) return `401` for unauthenticated requests
- [x] `POST /api/configuration` remains accessible without authentication (first-run setup)
- [x] Default admin user is auto-seeded from environment variables on first access
- [x] Logout button in navigation bar ends the session and redirects to login
- [x] All existing E2E tests pass with the auth layer active
- [x] All new unit/integration tests pass
- [x] All new E2E tests pass
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Rate Limiting**: Add rate limiting to the login endpoint to prevent brute-force attacks (e.g., 5 attempts per minute per IP).
- **Account Lockout**: Lock an account after N consecutive failed login attempts.
- **Password Complexity Requirements**: Enforce minimum password length and complexity rules.
- **Session Cleanup Cron**: Periodically purge expired sessions from the database instead of relying on passive cleanup.
- **"Remember Me" Option**: Allow users to opt into longer session durations.
- **CSRF Tokens**: Add explicit CSRF token validation for state-changing form submissions (currently relying on SameSite cookie and same-origin checks).
- **Audit Logging**: Log login attempts (success and failure) with timestamps and IP addresses for security monitoring.
- **Setup Page Auth**: Protect the `/setup` page with authentication once auth is available to prevent unauthorized reconfiguration.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-27 | Initial plan created |
| 2026-02-27 | Moved API route protection into scope: added `requireAuth()` helper (Task 2.2), Tasks 3.5–3.6 for protecting existing routes, Task 4.2 for guard unit tests, Task 4.5 for updating existing API integration tests |
| 2026-02-28 | Implementation complete: all 5 phases delivered. 61 unit/integration tests pass (7 files), 18 E2E tests pass (4 files), build succeeds. All plan checkboxes and QA criteria checked. |
