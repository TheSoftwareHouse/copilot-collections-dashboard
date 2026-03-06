# Story 1.3: Azure AD PKCE Authentication Flow - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can authenticate via Azure AD PKCE flow |
| Description | As a user, I want to log in by clicking the "Login with Azure AD" button and authenticating with my Azure credentials so that I can access the dashboard without needing a separate local account. |
| Priority | Highest |
| Related Research | `specifications/azure-entra-login/extracted-tasks.md`, `specifications/azure-entra-login/jira-tasks.md` |

## Proposed Solution

Implement the OAuth 2.0 Authorization Code flow with PKCE (RFC 7636) using the **[Arctic](https://arcticjs.dev/)** library — a lightweight (~15 KB, zero dependencies) OAuth 2.0 client with first-class `MicrosoftEntraId` support. Arctic provides built-in PKCE helpers (`generateState`, `generateCodeVerifier`), authorization URL construction (`createAuthorizationURL`), token exchange (`validateAuthorizationCode`), token refresh (`refreshAccessToken`), and ID token decoding (`decodeIdToken`). This eliminates the need for custom crypto code, URL building, and HTTP calls to Azure endpoints.

The flow also includes **silent token refresh**. By requesting the `offline_access` scope, Azure returns a refresh token alongside the access/ID tokens. The refresh token is stored in the session record and used to silently extend expired sessions without redirecting the user back to Azure.

```
┌──────────────────────────────────────────────────────────────────┐
│  User clicks "Login with Azure AD"                               │
│  (AzureLoginButton.tsx → <a href="/api/auth/azure">)             │
└───────────────────────────┬──────────────────────────────────────┘
                            │ GET
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  /api/auth/azure/route.ts (GET)                                  │
│                                                                   │
│  1. Read Azure config via getAuthConfig()                        │
│  2. Get Arctic client: getEntraIdClient()                        │
│  3. Generate state = arctic.generateState()                      │
│  4. Generate codeVerifier = arctic.generateCodeVerifier()        │
│  5. Create URL = entraId.createAuthorizationURL(state,           │
│       codeVerifier, { scopes })                                  │
│     scopes: ["openid", "profile", "email", "offline_access"]    │
│  6. Set HTTP-only cookies: pkce_code_verifier, pkce_state        │
│     (maxAge: 300s, sameSite: lax, httpOnly, secure in prod)      │
│  7. 302 redirect → Azure authorize endpoint                     │
└───────────────────────────┬──────────────────────────────────────┘
                            │ 302
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  Azure AD Authorization Endpoint                                 │
│  https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/       │
│         authorize                                                │
│                                                                   │
│  Params: client_id, redirect_uri, response_type=code,            │
│          scope=openid+profile+email+offline_access,              │
│          code_challenge, code_challenge_method=S256, state       │
│                                                                   │
│  User authenticates with Azure credentials                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │ 302 redirect with ?code=...&state=...
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  /api/auth/callback/route.ts (GET)                               │
│                                                                   │
│  1. Read code, state from query params                           │
│  2. Read pkce_state cookie → validate state matches              │
│  3. Read pkce_code_verifier cookie                               │
│  4. tokens = entraId.validateAuthorizationCode(code, codeVerifier)│
│  5. claims = arctic.decodeIdToken(tokens.idToken())              │
│  6. Validate claims: iss, aud, exp                               │
│  7. refreshToken = tokens.refreshToken()                         │
│  8. Upsert user: find by username=preferred_username             │
│     or create with passwordHash="AZURE_AD_USER"                  │
│  9. createSession(userId, refreshToken) → session token          │
│  10. Set session_token cookie (same pattern as login route)      │
│  11. Clear PKCE cookies                                          │
│  12. 302 redirect → /dashboard                                   │
│                                                                   │
│  Error paths:                                                    │
│    OAuth2RequestError → /login?error=auth_failed                 │
│    ArcticFetchError   → /login?error=provider_unavailable        │
│    Other errors       → /login?error=auth_failed                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  /login page (modified)                                          │
│                                                                   │
│  • Reads ?error= from searchParams                               │
│  • Displays error banner with user-friendly message              │
│  • Maps error codes:                                             │
│    auth_failed → "Authentication failed or was cancelled"        │
│    provider_unavailable → "Identity provider is unavailable"     │
│    token_exchange_failed → "Token exchange failed"               │
│    state_mismatch → "Security validation failed"                 │
│    invalid_callback → "Invalid callback from identity provider"  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Token Refresh (transparent to user)                             │
│                                                                   │
│  When getSession() finds an expired session with a refreshToken: │
│                                                                   │
│  1. Call entraId.refreshAccessToken(refreshToken, scopes)        │
│  2. On success:                                                  │
│     a. Update session.expiresAt (reset timeout)                  │
│     b. Update session.refreshToken (Azure may rotate it)         │
│     c. Return user session (user sees no interruption)           │
│  3. On failure (OAuth2RequestError, ArcticFetchError):           │
│     a. Destroy session                                           │
│     b. Return null → user is redirected to login                 │
└──────────────────────────────────────────────────────────────────┘
```

**Design decisions**:

- **Arctic library** — Provides a purpose-built `MicrosoftEntraId` class with PKCE, token exchange, token refresh, and ID token decoding out of the box. At ~15 KB with zero dependencies, it replaces approximately 120 lines of custom `crypto` and `fetch()` code with well-tested library calls. The API is simple and stateless: `createAuthorizationURL()`, `validateAuthorizationCode()`, `refreshAccessToken()`, `decodeIdToken()`. This significantly reduces the surface area for bugs in security-critical code.
- **No client secret (PKCE public client)** — The `MicrosoftEntraId` constructor accepts `null` for `clientSecret` since the app is a public client using PKCE. Arctic handles the code challenge derivation internally when generating the authorization URL.
- **HTTP-only cookies for PKCE state** — `code_verifier` and `state` are stored in short-lived (5 min) HTTP-only cookies. This avoids adding a server-side store (no Redis, no DB table). Cookies are `sameSite: "lax"` to survive the cross-origin redirect from Azure. Cleared immediately after use in the callback.
- **Reuse existing User entity** — Azure users are stored in the `app_user` table with `preferred_username` (UPN/email) as the `username` field and `passwordHash` set to the constant `"AZURE_AD_USER"` (a non-matchable bcrypt hash). This avoids any schema migration for the user table and lets the existing `getSession()` → `UserEntity` lookup work unchanged.
- **User upsert pattern** — On first login, a new User record is created. On subsequent logins, the existing record is found by username. This handles the case where the same Azure user logs in multiple times without duplicating records.
- **ID token decode without signature verification** — Arctic's `decodeIdToken()` decodes the JWT payload but does not verify the signature. This is correct because the ID token is received directly from Azure's token endpoint over HTTPS (channel-bound). Custom `validateIdTokenClaims()` validates `iss`, `aud`, and `exp` as defense-in-depth.
- **Error mapping from Arctic types** — Arctic throws `OAuth2RequestError` (protocol-level errors from Azure: invalid grant, consent denied, etc.) and `ArcticFetchError` (network errors, timeouts). These are mapped to application-specific error codes for the redirect: `auth_failed` and `provider_unavailable` respectively.
- **Token refresh via `offline_access` scope** — Adding `offline_access` to the requested scopes causes Azure to return a refresh token. The refresh token is stored in the `session` table (new nullable `refreshToken` column) and used to silently extend expired sessions. When `getSession()` finds an expired session with a refresh token, it calls `refreshAccessToken()` via Arctic. If the refresh succeeds, the session is extended transparently. If it fails (revoked token, expired refresh token), the session is destroyed and the user must re-authenticate.
- **Dynamic import for token refresh** — The `getSession()` function uses a dynamic `import()` to load `azure-auth.ts` only when an Azure refresh is needed. This avoids loading Arctic in credentials-mode deployments and prevents unnecessary module initialization on every session check.
- **Refresh token in session table (not a separate table)** — The refresh token is stored as a nullable `TEXT` column on the existing `session` table rather than in a separate table. This keeps the schema simple — one session row = one authentication context. When the session is destroyed (logout), the refresh token is automatically deleted with it.

## Current Implementation Analysis

### Already Implemented
- `src/lib/auth-config.ts` — `getAuthConfig()` returns validated Azure config with `tenantId`, `clientId`, `redirectUri`. `getAuthMethod()` returns `'credentials' | 'azure'`. No changes needed.
- `src/lib/auth.ts` — `createSession(userId)` creates a session token and persists to DB. `getSession()` reads session cookie and returns user. `SESSION_COOKIE_NAME`, `getSessionTimeoutSeconds()`. **Will be modified** (see below).
- `src/lib/api-auth.ts` — `requireAuth()` / `isAuthFailure()` for protecting API routes. No changes needed.
- `src/entities/user.entity.ts` — User entity with `username` (unique), `passwordHash`, timestamps. No changes needed (Azure users reuse the same schema).
- `src/entities/session.entity.ts` — Session entity with `token`, `userId`, `expiresAt`. **Will be modified** (add `refreshToken` column).
- `src/components/auth/AzureLoginButton.tsx` — Links to `/api/auth/azure`. No changes needed.
- `src/components/auth/LoginForm.tsx` — Credentials form with error display. No changes needed.
- `src/app/api/auth/login/route.ts` — POST handler for credentials login. Pattern to follow for session cookie setting. No changes needed.
- `src/app/api/auth/logout/route.ts` — POST handler for logout. Pattern to follow for cookie clearing. No changes needed.
- `e2e/azure-login.spec.ts` — Azure-mode E2E tests. Will be extended.
- `playwright.azure.config.ts` — Azure-mode Playwright config with `AZURE_REDIRECT_URI: "http://localhost:3001/api/auth/callback"`. No changes needed.
- `vitest.config.ts` + `src/test/setup.ts` + `src/test/db-helpers.ts` — Test infrastructure. Pattern to follow.

### To Be Modified
- `package.json` — Add `arctic` as a runtime dependency.
- `src/entities/session.entity.ts` — Add nullable `refreshToken` column (type `text`) to the `Session` interface and `SessionEntity` schema.
- `src/lib/auth.ts` — Modify `createSession()` to accept an optional `refreshToken` parameter. Modify `getSession()` to attempt silent token refresh for expired Azure sessions that have a stored refresh token.
- `src/app/login/page.tsx` — Add `searchParams` reading for `?error=` query parameter. Display error banner with user-friendly message mapped from error codes.
- `e2e/azure-login.spec.ts` — Add E2E tests for PKCE flow initiation (verify redirect to Azure) and error display on login page.

### To Be Created
- `src/lib/azure-auth.ts` — Azure auth module: lazy `MicrosoftEntraId` client singleton, `validateIdTokenClaims()`, `refreshAzureSession()`, error code mapping, re-exports from Arctic (`generateState`, `generateCodeVerifier`, `decodeIdToken`).
- `src/app/api/auth/azure/route.ts` — GET handler to initiate the PKCE flow (generate PKCE params, set cookies, redirect to Azure).
- `src/app/api/auth/callback/route.ts` — GET handler for Azure redirect callback (validate state, exchange code for tokens, upsert user, create session with refresh token, redirect to dashboard).
- `migrations/17729xxxxx-AddRefreshTokenToSession.ts` — TypeORM migration adding `refreshToken TEXT NULL` column to the `session` table.
- `src/lib/__tests__/azure-auth.test.ts` — Unit tests for the Azure auth module functions.
- `src/app/api/auth/__tests__/azure.route.test.ts` — Unit tests for the PKCE initiation route handler.
- `src/app/api/auth/__tests__/callback.route.test.ts` — Unit tests for the callback route handler.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Which Azure ID token claim to use as the local username? | Use `preferred_username` (UPN/email) as the `username` field. Fall back to `sub` (subject) if `preferred_username` is absent. This provides human-readable usernames while maintaining uniqueness within a tenant. | ✅ Resolved |
| 2 | Should Azure users have a real passwordHash? | No. Set `passwordHash` to the constant string `"AZURE_AD_USER"`. This value can never match a bcrypt hash comparison, so Azure users cannot authenticate via the credentials form. Story 1.4 will disable the credentials form entirely in Azure mode. | ✅ Resolved |
| 3 | Should the ID token JWT signature be verified? | No. Arctic's `decodeIdToken()` decodes the JWT payload without signature verification — the token is received directly from Azure's token endpoint over HTTPS, so the transport is the verification. We validate `iss`, `aud`, and `exp` claims as defense-in-depth. | ✅ Resolved |
| 4 | What scopes to request from Azure? | `openid profile email offline_access` — `openid` is required for OIDC, `profile` gives us `name` and `preferred_username`, `email` ensures the email claim is included, `offline_access` causes Azure to return a refresh token for silent session extension. | ✅ Resolved |
| 5 | Should the callback route handle Azure's `error` and `error_description` query params? | Yes. If Azure redirects back with `?error=...` (e.g., user cancelled, consent denied), the callback detects this before attempting token exchange and redirects to `/login?error=auth_failed`. | ✅ Resolved |
| 6 | Which OAuth library to use? | Arctic (`arctic` npm package). Lightweight (~15 KB, zero dependencies), provides `MicrosoftEntraId` class with built-in PKCE, token exchange, token refresh, and ID token decoding. Preferred over MSAL Node (heavy ~1.5 MB, designed for Express sessions, `PublicClientApplication` targets desktop/CLI) and NextAuth.js (opinionated, replaces existing session system). | ✅ Resolved |
| 7 | Where should the token refresh logic live? | In `getSession()` with a dynamic import of `azure-auth.ts`. When a session is expired but has a `refreshToken`, `getSession()` calls `refreshAzureSession()` to attempt silent renewal. Dynamic import ensures Arctic is not loaded for credentials-mode deployments. | ✅ Resolved |
| 8 | Should refresh tokens be stored in a separate table? | No. The refresh token is stored as a nullable `TEXT` column on the existing `session` table. This keeps the 1:1 relationship between sessions and authentication contexts simple. When a session is destroyed (logout or expiry cleanup), the refresh token is deleted with it. | ✅ Resolved |

## Implementation Plan

### Phase 1: Arctic Setup & Azure Auth Module

#### Task 1.1 - [MODIFY] Add Arctic dependency
**Description**: Install the `arctic` npm package as a runtime dependency.

**Definition of Done**:
- [x] `arctic` is listed in `dependencies` in `package.json`
- [x] `npm install` / `npm ci` succeeds without errors

#### Task 1.2 - [CREATE] Azure auth module with Arctic client
**Description**: Create `src/lib/azure-auth.ts` as a thin wrapper around Arctic's `MicrosoftEntraId` class. The module provides a lazily initialized client singleton, claims validation, error code mapping, and a refresh function. Arctic's helpers (`generateState`, `generateCodeVerifier`, `decodeIdToken`) are re-exported for convenience.

**Definition of Done**:
- [x] `src/lib/azure-auth.ts` exports `getEntraIdClient()` that returns a `MicrosoftEntraId` instance initialized from `getAuthConfig()` — `new MicrosoftEntraId(tenantId, clientId, null, redirectUri)` — lazily created on first call (singleton pattern matching `getAuthConfig()`)
- [x] `src/lib/azure-auth.ts` exports `AZURE_SCOPES` constant: `["openid", "profile", "email", "offline_access"]`
- [x] `src/lib/azure-auth.ts` exports `validateIdTokenClaims(claims, config)` that validates: `iss` matches `https://login.microsoftonline.com/{tenantId}/v2.0`, `aud` matches `clientId`, `exp` is not in the past. Throws an `Error` with a descriptive message if validation fails.
- [x] `src/lib/azure-auth.ts` exports `AzureAuthErrorCode` type: `"auth_failed" | "provider_unavailable" | "token_exchange_failed" | "state_mismatch" | "invalid_callback"`
- [x] `src/lib/azure-auth.ts` exports `mapArcticError(error: unknown): AzureAuthErrorCode` that maps `OAuth2RequestError` → `"auth_failed"`, `ArcticFetchError` → `"provider_unavailable"`, unknown errors → `"auth_failed"`
- [x] `src/lib/azure-auth.ts` re-exports `generateState` and `generateCodeVerifier` from `arctic`
- [x] `src/lib/azure-auth.ts` re-exports `decodeIdToken` from `arctic`
- [x] `src/lib/azure-auth.ts` exports `IdTokenClaims` type with properties: `sub`, `oid`, `preferred_username`, `name`, `email`, `iss`, `aud`, `exp` (all optional strings/numbers as per Azure's JWT claims)

### Phase 2: Session Schema Update for Token Refresh

#### Task 2.1 - [MODIFY] Add `refreshToken` column to Session entity
**Description**: Extend the `Session` interface and `SessionEntity` schema in `src/entities/session.entity.ts` with a nullable `refreshToken` field. This column stores the Azure AD refresh token for silent session extension.

**Definition of Done**:
- [x] `Session` interface includes `refreshToken: string | null` property
- [x] `SessionEntity` schema includes `refreshToken` column with `type: "text"` and `nullable: true`
- [x] Existing session functionality (credentials login) is unaffected — `refreshToken` defaults to `null` for non-Azure sessions

#### Task 2.2 - [CREATE] Database migration for `refreshToken` column
**Description**: Create a TypeORM migration that adds the `refreshToken` column to the `session` table. Follow the existing migration naming pattern (`<timestamp>-<CamelCaseName>.ts`).

**Definition of Done**:
- [x] Migration file exists at `migrations/<timestamp>-AddRefreshTokenToSession.ts`
- [x] `up()` method executes: `ALTER TABLE "session" ADD "refreshToken" TEXT`
- [x] `down()` method executes: `ALTER TABLE "session" DROP COLUMN "refreshToken"`
- [x] Migration runs successfully against the development database (`npm run typeorm:migrate`)

#### Task 2.3 - [MODIFY] Extend `createSession()` to accept refresh token
**Description**: Modify `createSession()` in `src/lib/auth.ts` to accept an optional `refreshToken` parameter. When provided, it is stored alongside the session record. The existing credentials login flow is unaffected (no refresh token passed).

**Definition of Done**:
- [x] `createSession()` signature is `createSession(userId: number, refreshToken?: string | null): Promise<string>`
- [x] When `refreshToken` is provided, it is included in the `sessionRepo.save()` call
- [x] When `refreshToken` is omitted or `null`, behavior is identical to the current implementation
- [x] Existing credentials login in `src/app/api/auth/login/route.ts` continues to work without changes (no refresh token argument)

### Phase 3: Azure Auth Module Unit Tests

#### Task 3.1 - [CREATE] Unit tests for Azure auth module
**Description**: Create `src/lib/__tests__/azure-auth.test.ts` with tests for all exported functions. Tests mock `getAuthConfig()` to provide Azure configuration. No database access needed.

**Definition of Done**:
- [x] Test file exists at `src/lib/__tests__/azure-auth.test.ts`
- [x] Test: `getEntraIdClient()` returns a `MicrosoftEntraId` instance when auth method is `azure`
- [x] Test: `getEntraIdClient()` throws when auth method is `credentials` (no Azure config available)
- [x] Test: `getEntraIdClient()` returns the same instance on subsequent calls (singleton)
- [x] Test: `validateIdTokenClaims()` passes for valid claims (correct `iss`, `aud`, non-expired `exp`)
- [x] Test: `validateIdTokenClaims()` throws for wrong issuer
- [x] Test: `validateIdTokenClaims()` throws for wrong audience
- [x] Test: `validateIdTokenClaims()` throws for expired token (`exp` in the past)
- [x] Test: `mapArcticError()` maps `OAuth2RequestError` to `"auth_failed"`
- [x] Test: `mapArcticError()` maps `ArcticFetchError` to `"provider_unavailable"`
- [x] Test: `mapArcticError()` maps unknown errors to `"auth_failed"`
- [x] Test: `AZURE_SCOPES` contains `"openid"`, `"profile"`, `"email"`, `"offline_access"`
- [x] All tests pass (`npx vitest run src/lib/__tests__/azure-auth.test.ts`)

### Phase 4: PKCE Initiation Route

#### Task 4.1 - [CREATE] `/api/auth/azure` GET route handler
**Description**: Create `src/app/api/auth/azure/route.ts` with a GET handler that initiates the PKCE flow using Arctic. The handler reads Azure config, uses Arctic to generate PKCE parameters and the authorization URL, stores the `code_verifier` and `state` in HTTP-only cookies, and redirects to Azure. If `AUTH_METHOD` is not `azure`, the route returns a 404.

**Definition of Done**:
- [x] `src/app/api/auth/azure/route.ts` exports a `GET` function
- [x] Handler calls `getAuthConfig()` and returns 404 JSON `{ error: \"Azure authentication is not configured\" }` if method is not `azure`
- [x] Handler calls `generateState()` from `azure-auth.ts` to create the `state` parameter
- [x] Handler calls `generateCodeVerifier()` from `azure-auth.ts` to create the `codeVerifier`
- [x] Handler calls `entraId.createAuthorizationURL(state, codeVerifier, { scopes: AZURE_SCOPES })` to get the authorization URL
- [x] Handler sets `pkce_code_verifier` cookie: value=codeVerifier, httpOnly=true, secure=(NODE_ENV===\"production\"), sameSite=\"lax\", path=\"/\", maxAge=300
- [x] Handler sets `pkce_state` cookie: value=state, httpOnly=true, secure=(NODE_ENV===\"production\"), sameSite=\"lax\", path=\"/\", maxAge=300
- [x] Handler returns a 302 redirect to the authorization URL
- [x] Handler is wrapped in try/catch; unexpected errors return 500 with logged error

### Phase 5: Callback Route & Session Refresh Logic

#### Task 5.1 - [CREATE] `/api/auth/callback` GET route handler
**Description**: Create `src/app/api/auth/callback/route.ts` with a GET handler that processes the Azure redirect. This handler validates state, uses Arctic to exchange the authorization code for tokens, decodes and validates the ID token, extracts the refresh token, upserts the user record, creates a session (with refresh token), and redirects to the dashboard. All error paths redirect to `/login?error=<code>`.

**Definition of Done**:
- [x] `src/app/api/auth/callback/route.ts` exports a `GET` function
- [x] Handler reads `code` and `state` from `request.url` query parameters
- [x] Handler reads Azure `error` and `error_description` from query params; if present, redirects to `/login?error=auth_failed`
- [x] Handler reads `pkce_state` cookie and compares to `state` query param; mismatches redirect to `/login?error=state_mismatch`
- [x] Handler reads `pkce_code_verifier` cookie; if missing, redirects to `/login?error=invalid_callback`
- [x] Handler calls `entraId.validateAuthorizationCode(code, codeVerifier)` which returns `OAuth2Tokens`
- [x] Handler catches errors from `validateAuthorizationCode()` using `mapArcticError()` and redirects to `/login?error={errorCode}`
- [x] Handler calls `decodeIdToken(tokens.idToken())` to get JWT claims
- [x] Handler calls `validateIdTokenClaims(claims, config)` to validate `iss`, `aud`, `exp`
- [x] Handler extracts username from `claims.preferred_username` with fallback to `claims.sub`
- [x] Handler extracts refresh token via `tokens.refreshToken()` (may be `null` if Azure didn't return one)
- [x] Handler upserts a user in the `app_user` table: finds existing user by `username`, or creates a new user with `username` and `passwordHash="AZURE_AD_USER"`
- [x] Handler calls `createSession(user.id, refreshToken)` to create a session record with the refresh token
- [x] Handler sets `session_token` cookie with same options as the credentials login route (`httpOnly`, `secure`, `sameSite: "lax"`, `path: "/"`, `maxAge` from `getSessionTimeoutSeconds()`)
- [x] Handler clears `pkce_code_verifier` and `pkce_state` cookies (set maxAge=0)
- [x] Handler returns a 302 redirect to `/dashboard`
- [x] Unexpected errors redirect to `/login?error=auth_failed` with the error logged to console

#### Task 5.2 - [CREATE] `refreshAzureSession()` function in azure-auth module
**Description**: Add a `refreshAzureSession()` function to `src/lib/azure-auth.ts` that attempts to refresh an Azure session using the stored refresh token. This function is called by `getSession()` when an expired session has a refresh token.

**Definition of Done**:
- [x] `refreshAzureSession(sessionId: number, refreshToken: string)` is exported from `src/lib/azure-auth.ts`
- [x] Function calls `entraId.refreshAccessToken(refreshToken, [])` to request new tokens from Azure
- [x] On success: updates the session record in the database — sets new `expiresAt` (reset timeout) and new `refreshToken` (from `tokens.refreshToken()`, since Azure may rotate it)
- [x] On success: returns `true`
- [x] On failure (`OAuth2RequestError` or `ArcticFetchError`): deletes the expired session from the database and returns `false`
- [x] Function does not throw — all errors are caught internally and result in `false` return

#### Task 5.3 - [MODIFY] Extend `getSession()` with silent Azure token refresh
**Description**: Modify `getSession()` in `src/lib/auth.ts` to attempt silent token refresh when it finds an expired session that has a stored refresh token. The function uses a dynamic import of `azure-auth.ts` to avoid loading Arctic unless needed.

**Definition of Done**:
- [x] `getSession()` queries sessions WITHOUT the `expiresAt > now` filter — it finds the session by token regardless of expiry
- [x] If the session is still valid (not expired): existing sliding-window behavior is preserved unchanged
- [x] If the session is expired AND `session.refreshToken` is not null AND `getAuthMethod()` returns `'azure'`: calls `refreshAzureSession(session.id, session.refreshToken)` via dynamic import of `@/lib/azure-auth`
- [x] If refresh succeeds: re-queries the session (now with updated `expiresAt`), looks up user, and returns `{ user: { id, username } }`
- [x] If refresh fails: returns `null` (session was already destroyed by `refreshAzureSession`)
- [x] If the session is expired AND has no refresh token (credentials session or Azure session without refresh token): deletes the expired session and returns `null`
- [x] Credentials-mode sessions are completely unaffected — they never have a refresh token, so the new code path is never reached

### Phase 6: Login Page Error Display

#### Task 6.1 - [MODIFY] Display Azure auth error messages on login page
**Description**: Modify `src/app/login/page.tsx` to accept `searchParams` and display an error banner when an `error` query parameter is present. Map error codes to user-friendly messages. The error banner matches the styling of the existing `LoginForm` error alert (`bg-red-50`, `text-red-700`, `border-red-200`).

**Definition of Done**:
- [x] `LoginPage` function signature accepts `searchParams` (Next.js page prop)
- [x] Error code `auth_failed` maps to message: "Authentication failed or was cancelled. Please try again."
- [x] Error code `provider_unavailable` maps to message: "The identity provider is currently unavailable. Please try again later."
- [x] Error code `token_exchange_failed` maps to message: "Authentication could not be completed. Please try again."
- [x] Error code `state_mismatch` maps to message: "Security validation failed. Please try again."
- [x] Error code `invalid_callback` maps to message: "Invalid response from identity provider. Please try again."
- [x] Unknown error codes display a generic message: "An unexpected error occurred. Please try again."
- [x] Error banner uses `role="alert"` for accessibility
- [x] Error banner styling matches existing error pattern: `rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200`
- [x] Error banner is rendered above the login form/button in both auth modes
- [x] When no `error` param is present, no error banner is shown (existing behaviour unchanged)

### Phase 7: Route Handler & Token Refresh Unit Tests

#### Task 7.1 - [CREATE] Unit tests for `/api/auth/azure` route
**Description**: Create `src/app/api/auth/__tests__/azure.route.test.ts` with tests for the PKCE initiation route. Mock `getAuthConfig()` and Arctic functions to control behaviour. Verify the redirect URL and cookie setting behaviour.

**Definition of Done**:
- [x] Test file exists at `src/app/api/auth/__tests__/azure.route.test.ts`
- [x] Test: When `AUTH_METHOD=azure`, GET returns 302 with `Location` header pointing to `https://login.microsoftonline.com/` (mocked Arctic `createAuthorizationURL` return value)
- [x] Test: Response sets `pkce_code_verifier` cookie with `httpOnly`, `maxAge=300`, `sameSite=lax`
- [x] Test: Response sets `pkce_state` cookie with `httpOnly`, `maxAge=300`, `sameSite=lax`
- [x] Test: When `AUTH_METHOD=credentials`, GET returns 404 with error message
- [x] All tests pass (`npx vitest run src/app/api/auth/__tests__/azure.route.test.ts`)

#### Task 7.2 - [CREATE] Unit tests for `/api/auth/callback` route
**Description**: Create `src/app/api/auth/__tests__/callback.route.test.ts` with tests for the callback route. Mock Arctic's `validateAuthorizationCode()` and `decodeIdToken()`. Use the existing test database infrastructure from `src/test/db-helpers.ts` to verify user upsert and session creation (with refresh token).

**Definition of Done**:
- [x] Test file exists at `src/app/api/auth/__tests__/callback.route.test.ts`
- [x] Test: Successful flow — valid code + matching state → 302 redirect to `/dashboard` with `session_token` cookie set
- [x] Test: Successful flow — user record is created in `app_user` table with correct username and `passwordHash="AZURE_AD_USER"`
- [x] Test: Successful flow — session record is created in `session` table with `refreshToken` populated
- [x] Test: Successful flow — PKCE cookies (`pkce_code_verifier`, `pkce_state`) are cleared (maxAge=0)
- [x] Test: Returning user (existing username) — no duplicate user created, session created for existing user
- [x] Test: Azure returns `?error=access_denied` → 302 redirect to `/login?error=auth_failed`
- [x] Test: State mismatch (cookie state ≠ query state) → 302 redirect to `/login?error=state_mismatch`
- [x] Test: Missing code in query params → 302 redirect to `/login?error=invalid_callback`
- [x] Test: Missing pkce_code_verifier cookie → 302 redirect to `/login?error=invalid_callback`
- [x] Test: `validateAuthorizationCode()` throws `OAuth2RequestError` → 302 redirect to `/login?error=auth_failed`
- [x] Test: `validateAuthorizationCode()` throws `ArcticFetchError` → 302 redirect to `/login?error=provider_unavailable`
- [x] All tests pass (`npx vitest run src/app/api/auth/__tests__/callback.route.test.ts`)

#### Task 7.3 - [CREATE] Unit tests for token refresh in `getSession()`
**Description**: Add tests (in a new or existing test file) that verify the token refresh behaviour in `getSession()`. Tests mock `refreshAzureSession()` and `getAuthMethod()` to simulate Azure sessions with expired timestamps and stored refresh tokens.

**Definition of Done**:
- [x] Test: Expired Azure session with refresh token → `refreshAzureSession()` is called → if it returns `true`, session is returned with user data
- [x] Test: Expired Azure session with refresh token → `refreshAzureSession()` returns `false` → `getSession()` returns `null`
- [x] Test: Expired credentials session (no refresh token) → session is destroyed, `getSession()` returns `null`, `refreshAzureSession()` is NOT called
- [x] Test: Valid (non-expired) Azure session with refresh token → sliding window extends expiry, `refreshAzureSession()` is NOT called
- [x] All tests pass

### Phase 8: E2E Tests

#### Task 8.1 - [MODIFY] Add PKCE flow E2E tests to Azure login spec
**Description**: Extend `e2e/azure-login.spec.ts` with tests that verify the PKCE flow initiation and error display. Since we cannot perform a real Azure login in E2E, tests verify: (a) clicking the button initiates a redirect to Azure, (b) the login page displays error messages when `?error=` is in the URL.

**Definition of Done**:
- [x] New test: "clicking Azure login button initiates redirect" — navigates to `/login`, clicks "Login with Azure AD", verifies the browser navigates away from the app (or intercepts the request and checks URL starts with `https://login.microsoftonline.com/`)
- [x] New test: "login page displays auth_failed error message" — navigates to `/login?error=auth_failed`, verifies error banner with text "Authentication failed or was cancelled" is visible
- [x] New test: "login page displays provider_unavailable error message" — navigates to `/login?error=provider_unavailable`, verifies error banner with text "identity provider is currently unavailable" is visible
- [x] New test: "login page displays error with retry button" — navigates to `/login?error=token_exchange_failed`, verifies Azure login button is still visible and clickable
- [x] All existing tests in `e2e/azure-login.spec.ts` continue to pass
- [x] Tests pass when run with `npx playwright test --config playwright.azure.config.ts`

### Phase 9: Code Review

#### Task 9.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent against all files created or modified in this story to verify code quality, security practices, consistency with project patterns, and test coverage.

**Definition of Done**:
- [x] All created/modified files pass code review
- [x] No critical or high-severity issues remain
- [x] PKCE implementation follows RFC 7636 correctly (via Arctic)
- [x] Token refresh uses Arctic's `refreshAccessToken()` correctly with proper error handling
- [x] Cookie settings are secure (httpOnly, secure in production, appropriate sameSite)
- [x] Error handling covers all edge cases (Arctic error types mapped correctly)
- [x] Refresh token is stored securely (nullable column, destroyed on logout)
- [x] No secrets or tokens are logged or exposed in error messages
- [x] Code follows existing project patterns (TypeScript, Zod, TypeORM, Next.js API routes)
- [x] Unit tests provide adequate coverage of success and error paths (including token refresh)
- [x] E2E tests verify user-facing behaviour

## Security Considerations

- **PKCE over implicit flow**: The PKCE (Proof Key for Code Exchange) flow is used instead of the implicit flow, preventing authorization code interception attacks. This is the recommended approach per OAuth 2.1 and RFC 7636. Arctic handles PKCE challenge derivation internally.
- **No client secret**: PKCE eliminates the need for a client secret on the server side. The `MicrosoftEntraId` constructor receives `null` for `clientSecret`. The `code_verifier` (generated per-request, stored in an HTTP-only cookie) serves as the proof of possession.
- **State parameter for CSRF**: A cryptographically random `state` parameter is generated via Arctic's `generateState()` per authorization request and validated in the callback. This prevents CSRF attacks where an attacker could supply a malicious authorization code.
- **HTTP-only cookies for PKCE parameters**: The `code_verifier` and `state` are stored in HTTP-only cookies, making them inaccessible to JavaScript. This prevents XSS-based theft of PKCE parameters. Cookies expire after 5 minutes.
- **SameSite=Lax on PKCE cookies**: The `sameSite: "lax"` setting is required because the callback is a top-level navigation redirect from Azure (cross-origin). `Strict` would block the cookies on the Azure redirect.
- **Secure cookies in production**: All cookies use `secure: true` when `NODE_ENV === "production"`, ensuring they are only sent over HTTPS.
- **ID token claims validation**: Even though the ID token is received directly from Azure over HTTPS, the `iss` (issuer), `aud` (audience), and `exp` (expiration) claims are validated as defense-in-depth against token substitution attacks.
- **Refresh token stored server-side only**: The Azure refresh token is stored in the `session` table (PostgreSQL), never exposed to the client. It is a nullable `TEXT` column, scoped to the session lifecycle — destroyed on logout or session expiry.
- **Refresh token rotation**: Azure may rotate refresh tokens on each use. The `refreshAzureSession()` function always stores the new refresh token returned by `refreshAccessToken()`, ensuring the old token is overwritten.
- **Graceful refresh failure**: If `refreshAccessToken()` fails (revoked token, expired refresh token, network error), the session is destroyed immediately. The user is redirected to the login page and must re-authenticate. No stale sessions remain.
- **Non-matchable password hash for Azure users**: Azure users have `passwordHash="AZURE_AD_USER"`, which can never match a bcrypt comparison. Even if `AUTH_METHOD` is switched back to `credentials`, Azure users cannot log in with the credentials form.
- **Error mapping prevents information leakage**: Arctic's `OAuth2RequestError` and `ArcticFetchError` are mapped to generic application error codes (`auth_failed`, `provider_unavailable`). Raw error details from Azure are never exposed in redirects or to the client.
- **Dynamic import limits attack surface**: The `azure-auth.ts` module (and Arctic) is only loaded when an Azure refresh is actually needed. Credentials-mode deployments never load Azure-specific code in the session check path.
- **OWASP compliance**: The implementation follows OWASP guidelines for OAuth/OIDC: no token in URL fragments, server-side code exchange, state-based CSRF protection, PKCE for public clients, refresh tokens stored server-side only.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Clicking "Login with Azure AD" redirects to Azure authorization endpoint
- [x] Authorization request uses PKCE flow with code verifier and code challenge (via Arctic)
- [x] Authorization request includes `offline_access` scope for refresh token
- [x] After Azure authentication, user is redirected back with authorization code
- [x] System exchanges authorization code for tokens using Arctic's `validateAuthorizationCode()`
- [x] Refresh token from Azure is stored in the session record
- [x] Local session is created and user is redirected to dashboard
- [x] Expired Azure session with refresh token is silently renewed without redirect to Azure
- [x] Failed token refresh destroys the session and returns user to login
- [x] Credentials-mode sessions are unaffected by token refresh logic
- [x] Failed authentication or cancellation shows error on login page
- [x] Azure AD unreachable shows identity provider unavailable message
- [x] Token exchange failure shows error with retry option
- [x] Authorization request includes state parameter for CSRF protection
- [x] All unit tests pass (`npx vitest run`)
- [x] Azure-mode E2E tests pass (`npx playwright test --config playwright.azure.config.ts`)
- [x] Credentials-mode E2E tests pass (`npx playwright test --project=chromium`) — no regressions (3 pre-existing failures in team-members backfill unrelated to Azure auth)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Azure user profile display**: Extract and display the user's full name, email, and avatar from Azure AD claims. Currently only `preferred_username` is used as the `username`.
- **Multi-tenant support**: Allow multiple Azure AD tenants to be configured. Would require changes to the config schema and tenant discovery logic.
- **Rate limiting on callback route**: Add rate limiting to `/api/auth/callback` to prevent abuse. Low risk currently since the callback requires a valid authorization code from Azure.
- **Audit logging for Azure logins**: Log successful and failed Azure authentication attempts for security auditing purposes.
- **Proactive token refresh**: Refresh Azure tokens in the background before they expire (e.g., via a cron job) rather than on-demand when the session expires. Would improve latency for the first request after a long idle period.
- **Session cleanup cron**: Periodically purge expired sessions that were not cleaned up by `getSession()` (e.g., sessions that expired without the user returning).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created with custom Node.js `crypto` implementation |
| 2026-03-03 | Revised: replaced custom crypto with Arctic library (`MicrosoftEntraId`), added token refresh support (Phase 2, Task 5.2, Task 5.3), expanded scopes to include `offline_access`, added `refreshToken` column to Session entity |
| 2026-03-03 | Implementation completed: all 9 phases implemented, 610 unit tests pass, 0 TypeScript/ESLint errors |
| 2026-03-03 | Code review by tsh-code-reviewer: Approved with minor suggestions. Fixed M1 (user upsert race condition — added PG 23505 unique violation handling) and M2 (removed unused `createSession` import). No critical or high-severity issues. |
