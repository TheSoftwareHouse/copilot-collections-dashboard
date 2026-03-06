# Story 1.1: Configure Authentication Method via Environment Variables - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | System operator can configure authentication method via environment variables |
| Description | As a system operator, I want to configure the authentication method via environment variables so that I can switch between credentials-based and Azure AD login at deployment time without changing the application code or database. |
| Priority | Highest |
| Related Research | `specifications/azure-entra-login/extracted-tasks.md`, `specifications/azure-entra-login/jira-tasks.md` |

## Proposed Solution

Create a dedicated auth configuration module (`src/lib/auth-config.ts`) that reads and validates the `AUTH_METHOD` environment variable and, when set to `azure`, also validates the presence of required Azure-specific environment variables (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_REDIRECT_URI`). The module uses Zod for schema validation — consistent with the project's existing validation pattern (`src/lib/validations/*.ts`). A startup-time validation call is integrated into the existing `instrumentation.ts` `register()` function so the application fails fast with a clear error message if the configuration is invalid.

```
┌─────────────────────────────────────────────────────┐
│                  Environment Variables               │
│  AUTH_METHOD, AZURE_TENANT_ID, AZURE_CLIENT_ID,     │
│  AZURE_REDIRECT_URI                                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            src/lib/auth-config.ts                    │
│                                                      │
│  ┌──────────────────────────────────┐               │
│  │  Zod Validation Schema           │               │
│  │  (authMethodSchema +             │               │
│  │   azureConfigSchema)             │               │
│  └──────────────┬───────────────────┘               │
│                 │                                    │
│                 ▼                                    │
│  ┌──────────────────────────────────┐               │
│  │  validateAuthConfig()            │               │
│  │  → throws on invalid config      │               │
│  └──────────────┬───────────────────┘               │
│                 │                                    │
│                 ▼                                    │
│  ┌──────────────────────────────────┐               │
│  │  getAuthConfig()                 │               │
│  │  → returns cached AuthConfig      │               │
│  │                                   │               │
│  │  getAuthMethod()                 │               │
│  │  → returns 'credentials'|'azure' │               │
│  └──────────────────────────────────┘               │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          ▼                          ▼
┌──────────────────┐     ┌───────────────────────┐
│  instrumentation │     │  Future stories        │
│  .ts (startup)   │     │  (1.2, 1.3, 1.4, 1.5) │
│  fail-fast guard │     │  import getAuthConfig() │
└──────────────────┘     └───────────────────────┘
```

**Design decisions**:
- **Zod validation** — aligns with existing project patterns (all validation schemas use Zod)
- **Module-level cache** — `getAuthConfig()` reads env vars once and caches the result; subsequent calls return the same object. This avoids re-parsing on every request.
- **Discriminated union type** — `AuthConfig` is a discriminated union (`{ method: 'credentials' } | { method: 'azure', tenantId, clientId, redirectUri }`) so downstream consumers get proper type narrowing.
- **Startup validation in `instrumentation.ts`** — the `register()` function already runs once on server start and is guarded by `NEXT_RUNTIME === "nodejs"`. Adding auth config validation here ensures the app fails before accepting any requests.
- **No database changes** — auth method is a deployment-time concern, not runtime state.

## Current Implementation Analysis

### Already Implemented
- `src/lib/auth.ts` — Session management (create, get, destroy), password hashing, default admin seeding. Will continue to work unchanged for credentials mode.
- `src/lib/api-auth.ts` — `requireAuth()` / `isAuthFailure()` helpers. No changes needed for this story.
- `src/entities/user.entity.ts` — User entity with `username`, `passwordHash`. No changes needed for this story.
- `src/entities/session.entity.ts` — Session entity with `token`, `userId`, `expiresAt`. No changes needed for this story.
- `src/lib/validations/*.ts` — Existing Zod validation schemas (login, user, configuration). Pattern to follow.
- `instrumentation.ts` — Startup logic with `register()` function. Will be modified to add auth config validation.
- `docker-compose.yml` — Docker Compose with existing env vars. Will be modified to include new auth env vars.
- `vitest.config.ts` + `src/test/setup.ts` + `src/test/db-helpers.ts` — Test infrastructure. Test pattern to follow.

### To Be Modified
- `instrumentation.ts` — Add call to `validateAuthConfig()` at the start of `register()` so invalid config prevents startup.
- `docker-compose.yml` — Add `AUTH_METHOD`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_REDIRECT_URI` environment variables to the `app` service.

### To Be Created
- `src/lib/auth-config.ts` — Auth configuration module with Zod validation, typed config, and helpers (`getAuthConfig()`, `getAuthMethod()`).
- `src/lib/__tests__/auth-config.test.ts` — Unit tests for the auth configuration module.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should AZURE_REDIRECT_URI be validated as a proper URL? | Yes — using `z.string().url()` to prevent malformed redirect URIs, which would cause opaque failures during the OAuth flow in Story 1.3. | ✅ Resolved |
| 2 | Should the config module log which auth method is active at startup? | Yes — a single `console.log` after successful validation is helpful for operators confirming their configuration, consistent with existing startup logs in `instrumentation.ts`. | ✅ Resolved |
| 3 | Should empty string AUTH_METHOD be treated the same as unset (default to credentials)? | Yes — empty strings from env vars should be treated as unset to avoid confusing errors. | ✅ Resolved |

## Implementation Plan

### Phase 1: Auth Configuration Module

#### Task 1.1 - [CREATE] Auth config Zod validation schema and typed config
**Description**: Create `src/lib/auth-config.ts` with the Zod schema for validating `AUTH_METHOD` and the required Azure environment variables. Define the `AuthMethod` type (`'credentials' | 'azure'`), the `AuthConfig` discriminated union type, and the `SUPPORTED_AUTH_METHODS` constant. The Zod schema should validate:
- `AUTH_METHOD` accepts only `'credentials'` or `'azure'` (empty/undefined defaults to `'credentials'`)
- When method is `'azure'`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_REDIRECT_URI` must be non-empty strings
- `AZURE_REDIRECT_URI` must be a valid URL

**Definition of Done**:
- [x] `src/lib/auth-config.ts` exists and exports `AuthMethod` type, `AuthConfig` discriminated union type, `SUPPORTED_AUTH_METHODS` constant
- [x] Zod schema validates AUTH_METHOD as `'credentials'` or `'azure'`; undefined/empty defaults to `'credentials'`
- [x] Zod schema requires `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_REDIRECT_URI` when method is `'azure'`
- [x] `AZURE_REDIRECT_URI` is validated as a URL via `z.string().url()`
- [x] Invalid `AUTH_METHOD` values produce an error message listing the supported values (`credentials`, `azure`)
- [x] Missing Azure vars produce an error message listing each missing variable by name

#### Task 1.2 - [CREATE] `getAuthConfig()` and `getAuthMethod()` helpers
**Description**: In the same `src/lib/auth-config.ts` module, implement `validateAuthConfig()` (throws on invalid config), `getAuthConfig()` (returns cached validated config or throws), and a convenience `getAuthMethod()` helper. The config is validated once and cached in a module-level variable so subsequent calls are zero-cost.

**Definition of Done**:
- [x] `validateAuthConfig()` reads from `process.env`, validates with the Zod schema, caches the result, and throws a descriptive `Error` on failure
- [x] `getAuthConfig()` returns the cached `AuthConfig`; throws if `validateAuthConfig()` was not called first
- [x] `getAuthMethod()` returns `'credentials'` or `'azure'` from the cached config
- [x] All three functions are exported from `src/lib/auth-config.ts`
- [x] Error messages thrown by `validateAuthConfig()` are clear and actionable for a system operator

### Phase 2: Unit Tests

#### Task 2.1 - [CREATE] Unit tests for auth config module
**Description**: Create `src/lib/__tests__/auth-config.test.ts` with comprehensive tests covering all validation branches. Tests must save and restore `process.env` to avoid leaking state between tests. Use dynamic `import()` with `vi.resetModules()` to ensure the module-level cache is cleared between tests.

**Definition of Done**:
- [x] Test file exists at `src/lib/__tests__/auth-config.test.ts`
- [x] Test: `AUTH_METHOD` not set → `getAuthConfig()` returns `{ method: 'credentials' }`
- [x] Test: `AUTH_METHOD='credentials'` → returns `{ method: 'credentials' }`
- [x] Test: `AUTH_METHOD='azure'` with all three Azure vars set → returns `{ method: 'azure', tenantId, clientId, redirectUri }`
- [x] Test: `AUTH_METHOD='azure'` with `AZURE_TENANT_ID` missing → throws error mentioning `AZURE_TENANT_ID`
- [x] Test: `AUTH_METHOD='azure'` with `AZURE_CLIENT_ID` missing → throws error mentioning `AZURE_CLIENT_ID`
- [x] Test: `AUTH_METHOD='azure'` with `AZURE_REDIRECT_URI` missing → throws error mentioning `AZURE_REDIRECT_URI`
- [x] Test: `AUTH_METHOD='azure'` with multiple Azure vars missing → error lists all missing vars
- [x] Test: `AUTH_METHOD='google'` (unrecognized value) → throws error listing supported values (`credentials`, `azure`)
- [x] Test: `AUTH_METHOD=''` (empty string) → defaults to `{ method: 'credentials' }`
- [x] Test: `AZURE_REDIRECT_URI` with invalid URL → throws validation error
- [x] All tests pass (`npx vitest run src/lib/__tests__/auth-config.test.ts`)

### Phase 3: Startup Integration

#### Task 3.1 - [MODIFY] Add auth config validation to `instrumentation.ts`
**Description**: Import and call `validateAuthConfig()` at the beginning of the `register()` function in `instrumentation.ts`, right after the `NEXT_RUNTIME` guard. If validation fails, the thrown error will prevent the server from starting — which is the desired behaviour. Add a `console.log` after successful validation to confirm the active auth method.

**Definition of Done**:
- [x] `instrumentation.ts` imports `validateAuthConfig` and `getAuthMethod` from `@/lib/auth-config`
- [x] `validateAuthConfig()` is called immediately after the `NEXT_RUNTIME !== "nodejs"` guard, before any cron scheduling logic
- [x] A `console.log` line outputs the active authentication method after successful validation (e.g., `Authentication method: credentials`)
- [x] When `AUTH_METHOD` is set to an unrecognized value, the server fails to start with a clear error in stdout
- [x] When `AUTH_METHOD=azure` but required Azure vars are missing, the server fails to start with a clear error in stdout
- [x] Existing cron scheduling behaviour is unaffected

#### Task 3.2 - [MODIFY] Add auth environment variables to `docker-compose.yml`
**Description**: Add the new environment variables to the `app` service in `docker-compose.yml` with safe defaults. `AUTH_METHOD` defaults to `credentials` to preserve existing behaviour. Azure variables default to empty strings (only required when `AUTH_METHOD=azure`).

**Definition of Done**:
- [x] `docker-compose.yml` `app.environment` includes `AUTH_METHOD: ${AUTH_METHOD:-credentials}`
- [x] `docker-compose.yml` `app.environment` includes `AZURE_TENANT_ID: ${AZURE_TENANT_ID:-}`
- [x] `docker-compose.yml` `app.environment` includes `AZURE_CLIENT_ID: ${AZURE_CLIENT_ID:-}`
- [x] `docker-compose.yml` `app.environment` includes `AZURE_REDIRECT_URI: ${AZURE_REDIRECT_URI:-}`
- [x] Existing environment variables and services are unchanged
- [x] Default `docker compose up` continues to work with credentials auth (no Azure vars needed)

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent against all files changed in this story to verify code quality, consistency with project patterns, security considerations, and test coverage.

**Definition of Done**:
- [x] All created/modified files pass code review
- [x] No critical or high-severity issues remain
- [x] Code follows existing project patterns (Zod validation, TypeScript types, test structure)
- [x] Error messages are clear and actionable for operators

## Security Considerations

- **No secrets in error messages**: Error messages for missing Azure vars must list variable *names* only (e.g., "AZURE_TENANT_ID is required") and never log their *values*.
- **URL validation on redirect URI**: `AZURE_REDIRECT_URI` is validated as a proper URL (`z.string().url()`) to prevent malformed redirect URIs that could lead to open redirect vulnerabilities in Story 1.3.
- **No client secret**: The PKCE flow (Story 1.3) does not use a client secret, so no `AZURE_CLIENT_SECRET` variable is defined. This is intentional and aligns with OAuth 2.0 public client best practices.
- **Fail-fast on invalid config**: Invalid auth configuration prevents the server from starting entirely, ensuring no requests are served with an ambiguous or broken auth state.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] `AUTH_METHOD` env var accepts values `"credentials"` and `"azure"`
- [x] System defaults to `credentials` when `AUTH_METHOD` is not set
- [x] System requires `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_REDIRECT_URI` when `AUTH_METHOD=azure`
- [x] System fails to start with clear error when `AUTH_METHOD=azure` but required Azure vars are missing
- [x] System behaves unchanged when `AUTH_METHOD=credentials`
- [x] System fails to start with clear error when `AUTH_METHOD` is set to an unrecognized value
- [x] All unit tests pass
- [x] No regressions in existing tests (`npx vitest run`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Environment variable documentation**: Create a `.env.example` file documenting all supported environment variables with descriptions and defaults.
- **Runtime config reload**: Support changing auth method without restarting the server (hot-reload). Currently out of scope — auth method is a deployment-time concern.
- **Multi-tenant Azure support**: Support multiple Azure tenants. Currently out of scope per project assumptions.
- **Azure AD group/role mapping**: Map Azure AD groups to local permissions. Currently out of scope — no role-based access exists.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
| 2026-03-03 | Implementation completed (Phases 1-3). All 579 tests pass, no regressions. |
| 2026-03-03 | Code review by `tsh-code-reviewer`: approved with fixes. MEDIUM: added `expect.assertions(3)` to multi-missing-vars test and removed redundant assertion. LOW: removed unused `_resetAuthConfigCache()` dead code. Both fixed. |
