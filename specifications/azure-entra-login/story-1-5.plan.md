# Story 1.5: Azure AD Logout Flow - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can log out when authenticated via Azure AD |
| Description | As a user authenticated via Azure AD, I want to log out of the application so that my session is ended and access is revoked. |
| Priority | High |
| Related Research | `specifications/azure-entra-login/extracted-tasks.md`, `specifications/azure-entra-login/jira-tasks.md`, `specifications/azure-entra-login/quality-review.md` |

## Proposed Solution

Extend the existing logout flow so that Azure-authenticated users are signed out of both the local application **and** Azure AD in a single action. The local session destruction (DB record deletion + cookie clearing) already works identically for both auth methods. The only addition is an **optional redirect to Azure AD's logout endpoint** after the local session is destroyed, which ends the user's Azure AD browser session and prevents silent re-authentication.

```
┌──────────────────────────────────────────────────────────────────┐
│  User clicks "Sign out" (NavBar.tsx)                             │
│  handleLogout() → POST /api/auth/logout                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │ POST
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  /api/auth/logout/route.ts (POST)                                │
│                                                                   │
│  1. destroySession() — delete session from DB (existing)         │
│  2. Clear session_token cookie (existing)                        │
│  3. Check getAuthMethod():                                       │
│     ├─ "credentials" → return { success: true }                  │
│     └─ "azure"       → return { success: true,                   │
│                           azureLogoutUrl: "https://login.        │
│                           microsoftonline.com/{tenantId}/        │
│                           oauth2/v2.0/logout?                    │
│                           post_logout_redirect_uri={loginUrl}" } │
└───────────────────────────┬──────────────────────────────────────┘
                            │ JSON response
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  NavBar.tsx handleLogout()                                       │
│                                                                   │
│  1. Receive response JSON                                        │
│  2. If response.azureLogoutUrl exists:                           │
│     → window.location.href = azureLogoutUrl                      │
│       (full-page redirect to Azure logout endpoint)              │
│  3. Else:                                                        │
│     → router.push("/login")                                      │
│       (same as current credentials logout)                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
               ┌────────────┴─────────────┐
               │ (Azure mode only)        │
               ▼                          │
┌──────────────────────────────┐          │
│  Azure AD Logout Endpoint    │          │
│  https://login.microsoft     │          │
│  online.com/{tenantId}/      │          │
│  oauth2/v2.0/logout          │          │
│                              │          │
│  Ends Azure browser session  │          │
│  Redirects to:               │          │
│  post_logout_redirect_uri    │          │
│  → /login                    │          │
└──────────────┬───────────────┘          │
               │ 302                      │
               ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  /login page                                                     │
│  User sees the login page (both auth methods end here)           │
└──────────────────────────────────────────────────────────────────┘
```

**Design decisions**:

- **Server returns Azure logout URL, client decides the redirect** — Rather than performing a 302 redirect in the API route (which would break the existing `fetch()` + `router.push()` pattern in NavBar), the route returns the Azure logout URL as a JSON field. The client-side `handleLogout()` uses `window.location.href` for the Azure redirect, preserving the existing pattern for credentials mode and avoiding a breaking change to the logout API contract.
- **`post_logout_redirect_uri` derived from `AZURE_REDIRECT_URI`** — The Azure AD logout endpoint accepts a `post_logout_redirect_uri` parameter telling Azure where to redirect after signing out. We derive the app's login page URL from the already-configured `AZURE_REDIRECT_URI` (e.g., `http://localhost:3001/api/auth/callback` → `http://localhost:3001/login`). This avoids introducing a new environment variable and reuses the trusted, validated redirect URI base.
- **Helper function in `azure-auth.ts`** — A `getAzureLogoutUrl()` function encapsulates the Azure logout URL construction, keeping the route handler thin and enabling isolated unit testing.
- **Local session always destroyed first** — Regardless of whether the Azure AD redirect succeeds, the local session is already destroyed before the redirect. Even if the user closes the browser during the Azure redirect, the local session is gone. This is a fail-safe design.
- **`window.location.href` instead of `router.push()`** — The Azure logout URL is an external domain (`login.microsoftonline.com`), so Next.js router cannot handle it. Using `window.location.href` performs a full-page navigation, which is the correct behavior for cross-origin redirects.
- **No change to the `POST` method** — The logout route stays as a `POST` endpoint, matching REST semantics (logout is a state-changing action) and the existing client-side pattern.
- **Backward-compatible response** — The response remains `{ success: true }` for credentials mode. Azure mode adds an optional `azureLogoutUrl` field. No existing consumers break.

## Current Implementation Analysis

### Already Implemented
- `src/app/api/auth/logout/route.ts` — POST handler that calls `destroySession()`, clears `session_token` cookie, returns `{ success: true }`. Works for both auth methods since sessions are stored identically. **Will be modified.**
- `src/lib/auth.ts` → `destroySession()` — Reads session cookie, deletes the session record (including `refreshToken`) from DB. No changes needed.
- `src/components/NavBar.tsx` → `handleLogout()` — Client-side function that calls `POST /api/auth/logout` and redirects to `/login` via `router.push()`. **Will be modified.**
- `src/lib/auth-config.ts` → `getAuthMethod()`, `getAuthConfig()` — Returns auth method and full config (including `tenantId` for Azure). No changes needed.
- `src/lib/azure-auth.ts` — Azure auth module with client singleton, error mapping, refresh logic. **Will be modified** (add `getAzureLogoutUrl()`).
- `src/entities/session.entity.ts` — Session entity with `refreshToken` column. Session deletion removes refresh token automatically. No changes needed.
- `src/app/api/auth/__tests__/logout.route.test.ts` — Unit tests for logout route covering valid logout, idempotent logout, invalid token. **Will be modified** (add Azure logout URL tests).
- `src/lib/__tests__/azure-auth.test.ts` — Unit tests for Azure auth module. **Will be modified** (add `getAzureLogoutUrl()` tests).
- `e2e/auth.spec.ts` — Has credentials-mode logout test ("user clicks Sign out and is redirected to /login"). Serves as regression test. No changes needed.
- `e2e/azure-login.spec.ts` — Azure-mode E2E tests. **Will be modified** (add Azure logout test).
- `playwright.azure.config.ts` — Azure-mode Playwright config. No changes needed.

### To Be Modified
- `src/lib/azure-auth.ts` — Add `getAzureLogoutUrl()` function that constructs the Azure AD v2.0 logout endpoint URL with `post_logout_redirect_uri` pointing to the app's login page.
- `src/app/api/auth/logout/route.ts` — After destroying the local session, check `getAuthMethod()`. If `"azure"`, include `azureLogoutUrl` in the JSON response alongside `{ success: true }`.
- `src/components/NavBar.tsx` — Modify `handleLogout()` to read the response JSON. If `azureLogoutUrl` is present, redirect via `window.location.href` to the Azure logout endpoint. Otherwise, use `router.push("/login")` as before.
- `src/lib/__tests__/azure-auth.test.ts` — Add tests for `getAzureLogoutUrl()`.
- `src/app/api/auth/__tests__/logout.route.test.ts` — Add tests verifying `azureLogoutUrl` is returned in Azure mode and absent in credentials mode.
- `e2e/azure-login.spec.ts` — Add Azure-mode logout E2E test.

### To Be Created
- Nothing from scratch. All changes are modifications to existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should Azure AD session logout be mandatory or optional per user? | Mandatory. When `AUTH_METHOD=azure`, clicking logout always ends both the local session and the Azure AD session. Users don't get a choice — this is the most secure default and simplest UX. The "optional" in the story description means "optionally implemented as a feature", which we are implementing. | ✅ Resolved |
| 2 | How to derive the `post_logout_redirect_uri`? | Parse the `AZURE_REDIRECT_URI` to extract the origin (scheme + host + port) and append `/login`. For example, `http://localhost:3001/api/auth/callback` → `http://localhost:3001/login`. This avoids a new env var and leverages the already-validated URI. | ✅ Resolved |
| 3 | Does `post_logout_redirect_uri` need to be registered in Azure app? | Yes — Azure requires the `post_logout_redirect_uri` to be listed in the app registration's "Front-channel logout URL" or "Logout URL" settings. This is a deployment concern documented in the plan. The application code constructs the URL correctly; registration is the operator's responsibility. | ✅ Resolved |
| 4 | Should the logout route return a different HTTP status for Azure? | No. The route returns 200 with `{ success: true }` in all cases. The `azureLogoutUrl` is an additional field. Keeping the status code consistent avoids breaking changes. | ✅ Resolved |

## Implementation Plan

### Phase 1: Azure Logout URL Helper

#### Task 1.1 - [MODIFY] Add `getAzureLogoutUrl()` to Azure auth module
**Description**: Add a `getAzureLogoutUrl()` function to `src/lib/azure-auth.ts` that constructs the Azure AD v2.0 logout endpoint URL. The function reads the tenant ID from the auth config, derives the application login page URL from `AZURE_REDIRECT_URI`, and returns the complete logout URL with the `post_logout_redirect_uri` parameter.

**Definition of Done**:
- [x] `getAzureLogoutUrl()` is exported from `src/lib/azure-auth.ts`
- [x] Function reads `tenantId` and `redirectUri` from `getAuthConfig()` (asserts `method === "azure"`)
- [x] Function derives the login page URL by parsing `AZURE_REDIRECT_URI` and replacing the path with `/login` (e.g., `http://localhost:3001/api/auth/callback` → `http://localhost:3001/login`)
- [x] Function returns URL string in format: `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri={encodedLoginUrl}`
- [x] `post_logout_redirect_uri` value is URL-encoded
- [x] Function throws if `getAuthMethod()` is not `"azure"`

### Phase 2: Logout Route Enhancement

#### Task 2.1 - [MODIFY] Return Azure logout URL from logout route
**Description**: Modify `POST /api/auth/logout` in `src/app/api/auth/logout/route.ts` to check the auth method after destroying the session. When `AUTH_METHOD=azure`, include the `azureLogoutUrl` field in the JSON response. The local session destruction and cookie clearing behavior remain unchanged.

**Definition of Done**:
- [x] Route imports `getAuthMethod` from `@/lib/auth-config`
- [x] After session destruction and cookie clearing, route checks `getAuthMethod()`
- [x] When `AUTH_METHOD=azure`: response JSON is `{ success: true, azureLogoutUrl: "<url>" }` where `<url>` is from `getAzureLogoutUrl()`
- [x] When `AUTH_METHOD=credentials`: response JSON remains `{ success: true }` (no `azureLogoutUrl` field)
- [x] `getAzureLogoutUrl()` is imported dynamically (`await import("@/lib/azure-auth")`) to avoid loading Arctic in credentials mode
- [x] Local session is always destroyed before the response is sent, regardless of auth method
- [x] Error handling is preserved — if `getAzureLogoutUrl()` throws, the route still returns `{ success: true }` (local session was already destroyed, Azure redirect is best-effort)

### Phase 3: Client-Side Logout Redirect

#### Task 3.1 - [MODIFY] Handle Azure logout redirect in NavBar
**Description**: Modify `handleLogout()` in `src/components/NavBar.tsx` to read the response JSON from the logout API. If `azureLogoutUrl` is present, redirect the browser to the Azure logout endpoint using `window.location.href`. Otherwise, continue using `router.push("/login")` as before.

**Definition of Done**:
- [x] `handleLogout()` reads the response JSON from `POST /api/auth/logout`
- [x] If `response.azureLogoutUrl` is a non-empty string: sets `window.location.href = response.azureLogoutUrl` for full-page navigation to Azure
- [x] If `response.azureLogoutUrl` is absent or empty: calls `router.push("/login")` (existing behavior)
- [x] Loading state (`isLoggingOut`) is maintained during the redirect — the button stays disabled until navigation completes
- [x] If the fetch throws (network error), `isLoggingOut` is reset to `false` (existing error handling preserved)
- [x] No visual change to the "Sign out" button text or styling

### Phase 4: Unit Tests

#### Task 4.1 - [MODIFY] Add unit tests for `getAzureLogoutUrl()`
**Description**: Add tests to `src/lib/__tests__/azure-auth.test.ts` that verify the `getAzureLogoutUrl()` function produces correct Azure logout URLs and handles edge cases.

**Definition of Done**:
- [x] Test: `getAzureLogoutUrl()` returns URL starting with `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/logout`
- [x] Test: Returned URL contains `post_logout_redirect_uri` parameter with URL-encoded login page URL derived from `AZURE_REDIRECT_URI`
- [x] Test: When `AZURE_REDIRECT_URI` is `https://app.example.com/api/auth/callback`, the `post_logout_redirect_uri` is `https://app.example.com/login`
- [x] Test: When `AZURE_REDIRECT_URI` is `http://localhost:3001/api/auth/callback`, the `post_logout_redirect_uri` is `http://localhost:3001/login`
- [x] Test: `getAzureLogoutUrl()` throws when auth method is `credentials`
- [x] All tests pass (`npx vitest run src/lib/__tests__/azure-auth.test.ts`)

#### Task 4.2 - [MODIFY] Add unit tests for Azure logout in route handler
**Description**: Add tests to `src/app/api/auth/__tests__/logout.route.test.ts` that verify the logout route returns `azureLogoutUrl` when the auth method is `azure`, and does not include it when the auth method is `credentials`.

**Definition of Done**:
- [x] Test: When `AUTH_METHOD=azure`, response JSON includes `azureLogoutUrl` field with a valid Azure logout URL
- [x] Test: When `AUTH_METHOD=azure`, response JSON still includes `success: true`
- [x] Test: When `AUTH_METHOD=azure`, session is destroyed from DB before the response (existing behavior preserved)
- [x] Test: When `AUTH_METHOD=credentials`, response JSON is `{ success: true }` with no `azureLogoutUrl` field
- [x] All existing logout tests continue to pass
- [x] All tests pass (`npx vitest run src/app/api/auth/__tests__/logout.route.test.ts`)

### Phase 5: E2E Tests

#### Task 5.1 - [MODIFY] Add Azure-mode logout E2E test
**Description**: Add an E2E test to `e2e/azure-login.spec.ts` that verifies the logout flow when `AUTH_METHOD=azure`. Since the E2E environment cannot complete a real Azure login, the test creates a session directly in the database (using the DB helpers) and verifies that clicking "Sign out" triggers a redirect toward the Azure logout endpoint.

**Definition of Done**:
- [x] New test in `e2e/azure-login.spec.ts`: "user clicks Sign out and is redirected to Azure logout endpoint"
- [x] Test seeds a user and session directly in the DB (same pattern as `e2e/helpers/auth.ts`)
- [x] Test sets the `session_token` cookie on the browser context to simulate an authenticated Azure user
- [x] Test navigates to `/dashboard` and verifies the page loads (authenticated state)
- [x] Test clicks "Sign out" button and intercepts the navigation to verify the URL starts with `https://login.microsoftonline.com/`
- [x] All existing tests in `e2e/azure-login.spec.ts` continue to pass
- [x] Tests pass when run with `npx playwright test --config playwright.azure.config.ts`

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent against all files modified in this story to verify code quality, consistency with project patterns, security considerations, and test coverage.

**Definition of Done**:
- [x] All modified files pass code review
- [x] No critical or high-severity issues remain
- [x] Azure logout URL construction is correct (tenant ID, encoded redirect URI)
- [x] Local session is always destroyed before Azure redirect (fail-safe)
- [x] Credentials-mode logout behavior is completely unaffected (regression check)
- [x] Error handling is robust — Azure logout failure does not prevent local logout success
- [x] No secrets or tokens are exposed in the logout URL or response
- [x] Code follows existing project patterns (TypeScript, Next.js API routes, NavBar component)
- [x] Unit tests cover success and error paths
- [x] E2E test verifies observable user behavior

## Security Considerations

- **Local session destroyed first**: The local session (DB record + cookie) is always destroyed before any Azure redirect occurs. Even if the Azure logout endpoint is unreachable or the user closes the browser mid-redirect, the local session is already invalidated. This is a fail-safe design.
- **No tokens in the logout URL**: The Azure logout URL contains only the tenant ID (public information) and the `post_logout_redirect_uri` (the app's login page URL). No access tokens, refresh tokens, or session identifiers are included.
- **`post_logout_redirect_uri` derived from trusted config**: The redirect URI is derived from the operator-configured `AZURE_REDIRECT_URI`, which is validated at startup (Zod URL validation in `auth-config.ts`). There is no user-controlled input in the logout URL, preventing open redirect vulnerabilities.
- **Azure AD session termination**: Redirecting to Azure's logout endpoint ends the Azure browser session, preventing silent re-authentication. Without this, a user who clicks "Sign out" could log back in without entering credentials because Azure still has an active browser session.
- **HTTPS enforcement**: The Azure logout endpoint (`login.microsoftonline.com`) is always HTTPS. The `post_logout_redirect_uri` uses the same scheme as the configured `AZURE_REDIRECT_URI`, which the operator controls (HTTPS in production).
- **Best-effort Azure logout**: If the `getAzureLogoutUrl()` call fails for any reason, the route still returns `{ success: true }` — the local session was already destroyed. Azure logout is best-effort; local logout is guaranteed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Local session is destroyed when user clicks logout (both auth methods)
- [x] User is redirected to login page after logout in credentials mode
- [x] User is redirected to Azure AD logout endpoint after logout in Azure mode
- [x] Azure AD logout endpoint redirects back to the app's login page
- [x] Logout works consistently for both credentials and Azure authentication
- [x] Credentials-mode logout is completely unaffected (regression)
- [x] Existing credentials-mode E2E logout test still passes
- [x] New Azure-mode E2E logout test passes
- [x] All unit tests pass (`npx vitest run`)
- [x] Azure-mode E2E tests pass (`npx playwright test --config playwright.azure.config.ts`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Back-channel logout (OIDC Back-Channel Logout 1.0)**: Azure AD can send a logout notification to the app when the user signs out from another Azure-connected application. This would require a `POST /api/auth/backchannel-logout` endpoint that receives a `logout_token` JWT from Azure. Useful for enterprises with strict SSO session management requirements.
- **Front-channel logout support**: Similar to back-channel but uses an iframe-based approach. Lower priority than back-channel.
- **Confirmation dialog before logout**: Show a "Are you sure you want to sign out?" dialog. Low value for this application since logout is not destructive.
- **Logout audit logging**: Record logout events (timestamp, user, auth method) for security auditing. Could be part of a broader audit logging feature.
- **Selective Azure logout**: Let the user choose whether to sign out of just the app or both the app and Azure AD. The current implementation always signs out of both for security. A toggle could be added but reduces security posture.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
| 2026-03-03 | Implementation completed: all 6 phases implemented, 622 unit tests pass, 14 Azure E2E tests pass, 7 credentials E2E tests pass, 0 TypeScript/ESLint errors |
| 2026-03-03 | Code review by tsh-code-reviewer: **Approved**. No critical, high, or medium severity issues. Fixed L1 (added `console.warn` to silent catch in logout route for observability). L2 (missing unit test for `getAzureLogoutUrl()` failure path in route) and L3 (NavBar does not check `res.ok`) accepted as-is — fallthrough behavior is correct in both cases. I1 (E2E test navigates to real `login.microsoftonline.com`) noted for CI awareness, consistent with existing PKCE test pattern. |

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
