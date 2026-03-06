# Story 1.4: User Management Disabled Under Azure Authentication - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User management is disabled when Azure login is configured |
| Description | As a system operator, I want local user management to be unavailable when Azure authentication is active so that all access control is managed centrally through Azure AD. |
| Priority | High |
| Related Research | `specifications/azure-entra-login/extracted-tasks.md`, `specifications/azure-entra-login/jira-tasks.md` |

## Proposed Solution

Add an auth-method guard to the user management API mutation endpoints (POST, PUT, DELETE) and conditionally replace the Users tab content in the management UI with an informational notice when `AUTH_METHOD=azure`. The auth method is read server-side (existing `getAuthMethod()` from Story 1.1) and passed to the client component as a prop. Additionally, skip `seedDefaultAdmin()` on the login page in Azure mode since local credential-based accounts are not used.

```
┌────────────────────────────────────────────────────────────────┐
│  API Layer (Defense in Depth)                                  │
│                                                                │
│  POST /api/users        ──┐                                    │
│  PUT  /api/users/[id]   ──┼── getAuthMethod() === 'azure'?    │
│  DELETE /api/users/[id] ──┘    → 403 "User management is      │
│                                  disabled… managed through     │
│  GET /api/users ──────────────  Azure AD."                     │
│    → unchanged (read-only,      Otherwise → existing handler   │
│      safe in both modes)                                       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  UI Layer                                                      │
│                                                                │
│  ManagementPage (server component)                             │
│    ├── getAuthMethod() → pass authMethod prop to layout        │
│    └── ManagementPageLayout (client component)                 │
│         ├── Tabs: Configuration | Departments | Teams | ...    │
│         └── Users tab:                                         │
│              ├── credentials → <UserManagementPanel />         │
│              └── azure       → <AzureUserManagementNotice />   │
│                                 "User management is not        │
│                                  available when Azure AD       │
│                                  authentication is active."    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Login Page                                                    │
│                                                                │
│  getAuthMethod() === 'azure'?                                  │
│    → Skip seedDefaultAdmin() (no local accounts needed)        │
│    → Render AzureLoginButton (existing, unchanged)             │
│  getAuthMethod() === 'credentials'?                            │
│    → seedDefaultAdmin() (existing behaviour preserved)         │
│    → Render LoginForm (existing, unchanged)                    │
└────────────────────────────────────────────────────────────────┘
```

**Design decisions**:
- **Per-handler guard over middleware** — The Azure mode guard is added directly at the top of each mutation handler (POST, PUT, DELETE) rather than creating a separate middleware function. With only 3 handlers to guard, a new abstraction would be over-engineering. Each guard is ~4 lines and the pattern is explicit and easy to audit.
- **GET /api/users remains accessible** — The acceptance criteria explicitly mentions "creating, editing, and deleting users" — GET is excluded. Listing users is read-only and informational, useful for debugging or monitoring even in Azure mode.
- **Users tab stays visible with info notice** — Rather than hiding the tab entirely, the "Users" tab remains in the tab bar but renders an informational notice instead of the management panel. This matches the spec's requirement for "an informational message where the user management panel would normally appear" and is less confusing than a silently missing tab.
- **Auth method passed as prop** — `ManagementPageLayout` is a client component (uses `useSearchParams`, `useRouter`) and cannot call `getAuthMethod()` (server-side `process.env`). The auth method is read in the parent server component and passed down as a prop — the standard Next.js pattern for server-to-client data flow.
- **Skip seedDefaultAdmin in Azure mode** — In Azure mode, all users authenticate via Azure AD. Seeding a default admin creates a local user with credentials that can never be used (no credentials form in Azure mode). Skipping it keeps the user table clean. The login page already imports `getAuthMethod()`, so the change is minimal.
- **403 status code for Azure guard** — Consistent with the existing pattern in the `DELETE` handler (returns 403 for "Cannot delete your own account"). 403 (Forbidden) correctly communicates that the action is understood but not allowed in the current configuration.
- **No database changes** — No migrations or schema changes needed. The guard is purely application-level logic based on the `AUTH_METHOD` environment variable.

## Current Implementation Analysis

### Already Implemented
- `src/lib/auth-config.ts` — `getAuthMethod()` returns `'credentials' | 'azure'` from validated, cached config. No changes needed.
- `src/lib/api-auth.ts` — `requireAuth()` / `isAuthFailure()` pattern for protecting API routes. No changes needed.
- `src/components/users/UserManagementPanel.tsx` — Full CRUD client component (600 lines). No changes needed — conditionally rendered.
- `src/components/auth/AzureLoginButton.tsx` — Azure login button. No changes needed.
- `src/components/auth/LoginForm.tsx` — Credentials login form. No changes needed.
- `src/app/api/users/route.ts` — GET and POST handlers with `requireAuth()`. Will be modified (POST only).
- `src/app/api/users/[id]/route.ts` — PUT and DELETE handlers with `requireAuth()`. Will be modified.
- `src/app/api/users/__tests__/route.test.ts` — Unit tests for GET/POST. Will be extended.
- `src/app/api/users/__tests__/[id].route.test.ts` — Unit tests for PUT/DELETE. Will be extended.
- `e2e/user-management.spec.ts` — E2E tests for credentials-mode user management. Serves as regression tests; no changes needed.
- `e2e/azure-login.spec.ts` — Azure-mode E2E tests. Will be extended.
- `playwright.azure.config.ts` — Azure-mode Playwright config. No changes needed.

### To Be Modified
- `src/app/api/users/route.ts` — Add Azure auth guard to the `POST` handler. Import `getAuthMethod` from `@/lib/auth-config`.
- `src/app/api/users/[id]/route.ts` — Add Azure auth guard to the `PUT` and `DELETE` handlers. Import `getAuthMethod` from `@/lib/auth-config`.
- `src/app/(app)/management/page.tsx` — Import `getAuthMethod`, pass `authMethod` prop to `ManagementPageLayout`.
- `src/components/management/ManagementPageLayout.tsx` — Accept `authMethod` prop. When `authMethod === 'azure'` and Users tab is active, render `AzureUserManagementNotice` instead of `UserManagementPanel`.
- `src/app/login/page.tsx` — Skip `seedDefaultAdmin()` call when `getAuthMethod()` returns `'azure'`.
- `src/app/api/users/__tests__/route.test.ts` — Add tests for Azure mode guard on POST; verify GET still works.
- `src/app/api/users/__tests__/[id].route.test.ts` — Add tests for Azure mode guard on PUT and DELETE.
- `e2e/azure-login.spec.ts` — Add tests for Azure mode management page (Users tab shows notice, no CRUD controls).

### To Be Created
- `src/components/users/AzureUserManagementNotice.tsx` — Presentational component displaying an informational message that user management is handled through Azure AD.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should GET /api/users also be blocked in Azure mode? | No. The acceptance criteria specifies "creating, editing, and deleting users" only. GET is read-only and safe. | ✅ Resolved |
| 2 | Should the "Users" tab be hidden entirely or show a notice? | Show a notice. The spec says "an informational message where the user management panel would normally appear", implying the tab remains and the content is replaced. | ✅ Resolved |
| 3 | Should seedDefaultAdmin() be skipped in Azure mode? | Yes. Story 1.2 plan explicitly noted this as Story 1.4's scope. In Azure mode, local credential-based accounts are not used, so seeding an admin is unnecessary. | ✅ Resolved |
| 4 | What HTTP status code should the Azure guard return? | 403 Forbidden — consistent with the existing pattern in DELETE handler. The action is understood but not allowed in the current configuration. | ✅ Resolved |

## Implementation Plan

### Phase 1: API Guards for User Management Endpoints

#### Task 1.1 - [MODIFY] Add Azure auth guard to POST /api/users
**Description**: Add a guard at the top of the `POST` handler in `src/app/api/users/route.ts` that checks `getAuthMethod()`. When the method is `'azure'`, return a 403 response with a clear error message before any other processing. The guard runs after `requireAuth()` to ensure the request is still authenticated.

**Definition of Done**:
- [x] `src/app/api/users/route.ts` imports `getAuthMethod` from `@/lib/auth-config`
- [x] `POST` handler checks `getAuthMethod() === "azure"` immediately after the `requireAuth()` guard
- [x] When `AUTH_METHOD=azure`, POST returns `{ error: "User management is disabled when Azure AD authentication is active. Access is managed through Azure AD." }` with status 403
- [x] When `AUTH_METHOD=credentials`, POST behaves exactly as before (creating users)
- [x] `GET` handler remains unchanged (no Azure guard)

#### Task 1.2 - [MODIFY] Add Azure auth guard to PUT and DELETE /api/users/[id]
**Description**: Add the same Azure auth guard to the `PUT` and `DELETE` handlers in `src/app/api/users/[id]/route.ts`. Both mutation endpoints return 403 when `AUTH_METHOD=azure`.

**Definition of Done**:
- [x] `src/app/api/users/[id]/route.ts` imports `getAuthMethod` from `@/lib/auth-config`
- [x] `PUT` handler checks `getAuthMethod() === "azure"` immediately after the `requireAuth()` guard
- [x] `DELETE` handler checks `getAuthMethod() === "azure"` immediately after the `requireAuth()` guard
- [x] When `AUTH_METHOD=azure`, PUT returns `{ error: "User management is disabled when Azure AD authentication is active. Access is managed through Azure AD." }` with status 403
- [x] When `AUTH_METHOD=azure`, DELETE returns `{ error: "User management is disabled when Azure AD authentication is active. Access is managed through Azure AD." }` with status 403
- [x] When `AUTH_METHOD=credentials`, both handlers behave exactly as before

### Phase 2: UI - Azure User Management Notice

#### Task 2.1 - [CREATE] AzureUserManagementNotice component
**Description**: Create `src/components/users/AzureUserManagementNotice.tsx` — a presentational component that displays an informational message explaining that user management is handled through Azure AD. Uses info-style Tailwind classes (blue colour palette) consistent with project patterns.

**Definition of Done**:
- [x] `src/components/users/AzureUserManagementNotice.tsx` exists
- [x] Component renders a styled container with an informational message
- [x] Message text: "User management is not available when Azure AD authentication is active. All access control is managed centrally through Azure AD."
- [x] Uses info styling: `rounded-lg border border-blue-200 bg-blue-50 p-6 text-sm text-blue-700` (consistent with project's alert patterns but blue for informational tone)
- [x] Includes an appropriate role or ARIA attribute for accessibility (`role="status"`)
- [x] Component is a server component (no `"use client"` — pure static content, no interactivity)
- [x] No props required (self-contained)

#### Task 2.2 - [MODIFY] Pass auth method from ManagementPage to ManagementPageLayout
**Description**: Modify the `ManagementPage` server component to import `getAuthMethod()` and pass the authentication method as a prop to `ManagementPageLayout`. Modify `ManagementPageLayout` to accept an `authMethod` prop.

**Definition of Done**:
- [x] `src/app/(app)/management/page.tsx` imports `getAuthMethod` from `@/lib/auth-config`
- [x] `ManagementPage` passes `authMethod={getAuthMethod()}` to `<ManagementPageLayout />`
- [x] `ManagementPageLayout` component accepts an `authMethod` prop of type `AuthMethod` (imported from `@/lib/auth-config`)
- [x] Existing tab logic and rendering are unaffected when `authMethod` is `'credentials'`

#### Task 2.3 - [MODIFY] Conditionally render Users tab content based on auth method
**Description**: In `ManagementPageLayout`, when `authMethod === 'azure'` and the active tab is "users", render `AzureUserManagementNotice` instead of `UserManagementPanel`. All other tabs render their content unchanged regardless of auth method.

**Definition of Done**:
- [x] `ManagementPageLayout` imports `AzureUserManagementNotice` from `@/components/users/AzureUserManagementNotice`
- [x] When `authMethod === 'azure'` and `activeTab === 'users'`, the "users" tabpanel renders `<AzureUserManagementNotice />` instead of `<UserManagementPanel />`
- [x] When `authMethod === 'credentials'` and `activeTab === 'users'`, the "users" tabpanel renders `<UserManagementPanel />` (unchanged)
- [x] The "Users" tab button remains visible and clickable in both auth modes
- [x] All other tabs (configuration, departments, teams, jobs, seats) render their content unchanged regardless of `authMethod`

### Phase 3: Skip Default Admin Seed in Azure Mode

#### Task 3.1 - [MODIFY] Skip seedDefaultAdmin on login page when Azure auth is active
**Description**: Modify `src/app/login/page.tsx` to only call `seedDefaultAdmin()` when `getAuthMethod()` returns `'credentials'`. In Azure mode, local credential-based accounts are not used, so seeding a default admin is unnecessary and would create a stale user record.

**Definition of Done**:
- [x] `seedDefaultAdmin()` is only called when `getAuthMethod() !== 'azure'` (or `=== 'credentials'`)
- [x] In Azure mode, no default admin user is seeded on the login page
- [x] In credentials mode, `seedDefaultAdmin()` continues to be called as before (existing behaviour preserved)
- [x] The `getAuthMethod()` call that already exists in the login page is reused (declared earlier in the function, before the conditional check)

### Phase 4: Unit Tests

#### Task 4.1 - [MODIFY] Add Azure mode unit tests for POST /api/users
**Description**: Extend `src/app/api/users/__tests__/route.test.ts` with tests that mock `getAuthMethod()` to return `'azure'` and verify that POST returns 403, while GET remains unaffected.

**Definition of Done**:
- [x] Test: POST /api/users when `AUTH_METHOD=azure` → returns 403 with error message containing "Azure AD"
- [x] Test: POST /api/users when `AUTH_METHOD=azure` → does NOT create a user in the database
- [x] Test: GET /api/users when `AUTH_METHOD=azure` → returns 200 with user list (unchanged)
- [x] All existing tests in the file continue to pass (credentials mode)
- [x] Tests use `vi.mock` / `vi.mocked` to control `getAuthMethod()` return value

#### Task 4.2 - [MODIFY] Add Azure mode unit tests for PUT and DELETE /api/users/[id]
**Description**: Extend `src/app/api/users/__tests__/[id].route.test.ts` with tests that mock `getAuthMethod()` to return `'azure'` and verify that PUT and DELETE return 403.

**Definition of Done**:
- [x] Test: PUT /api/users/[id] when `AUTH_METHOD=azure` → returns 403 with error message containing "Azure AD"
- [x] Test: DELETE /api/users/[id] when `AUTH_METHOD=azure` → returns 403 with error message containing "Azure AD"
- [x] All existing tests in the file continue to pass (credentials mode)
- [x] Tests use `vi.mock` / `vi.mocked` to control `getAuthMethod()` return value

### Phase 5: E2E Tests

#### Task 5.1 - [MODIFY] Add Azure-mode user management E2E tests
**Description**: Extend `e2e/azure-login.spec.ts` with a new test group that verifies the management page behaviour when `AUTH_METHOD=azure`. Tests navigate to `/management?tab=users` and verify the informational notice is displayed instead of user CRUD controls.

**Definition of Done**:
- [x] New `test.describe("Azure Mode User Management")` block in `e2e/azure-login.spec.ts`
- [x] Test: navigating to `/management?tab=users` shows informational message containing "Azure AD"
- [x] Test: "Add User" button is NOT visible on the management users tab
- [x] Test: "Users" tab is still visible and clickable in the management tab bar
- [x] Test: other management tabs (e.g., "Configuration") still render their content normally
- [x] All existing tests in `e2e/azure-login.spec.ts` continue to pass
- [x] Tests pass when run with `npx playwright test --config playwright.azure.config.ts`

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent against all files changed in this story to verify code quality, security considerations (defense in depth on API), consistency with project patterns, and test coverage.

**Definition of Done**:
- [x] All created/modified files pass code review
- [x] No critical or high-severity issues remain
- [x] API guards enforce Azure mode restrictions at the HTTP layer (defense in depth)
- [x] UI correctly displays informational notice without exposing CRUD controls
- [x] Error messages are clear and actionable
- [x] Unit tests cover both auth modes for all affected endpoints
- [x] E2E tests verify user-facing behaviour in Azure mode
- [x] Code follows existing project patterns (Tailwind styling, TypeScript types, Next.js conventions)

## Security Considerations

- **Defense in depth on API layer**: Even though the UI hides user management controls in Azure mode, the API endpoints independently enforce the restriction. A direct API call (curl, Postman, etc.) to POST/PUT/DELETE `/api/users` will return 403 when `AUTH_METHOD=azure`. This prevents bypassing the UI restriction.
- **GET remains accessible**: The GET endpoint only returns non-sensitive fields (`id`, `username`, `createdAt`, `updatedAt`). No `passwordHash` is ever exposed. Keeping it accessible allows operators to audit which users exist without needing direct database access.
- **No seedDefaultAdmin in Azure mode**: Prevents creating a local user with a password hash that could be exploited if `AUTH_METHOD` is switched back to `credentials`. While Azure users already have non-matchable `passwordHash="AZURE_AD_USER"`, avoiding unnecessary local accounts reduces attack surface.
- **403 error message does not leak configuration details**: The error message states the action is disabled under Azure AD but does not expose environment variable values, tenant IDs, or client IDs.
- **Auth method is server-side only**: The `authMethod` prop passed to `ManagementPageLayout` is either `'credentials'` or `'azure'` — a non-sensitive string. No Azure configuration details (tenant ID, client ID, redirect URI) are exposed in the rendered HTML.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] User management panel is not accessible in UI when `AUTH_METHOD=azure`
- [x] UI shows informational message about Azure AD access management in the Users tab
- [x] POST /api/users returns 403 with Azure AD error when `AUTH_METHOD=azure`
- [x] PUT /api/users/[id] returns 403 with Azure AD error when `AUTH_METHOD=azure`
- [x] DELETE /api/users/[id] returns 403 with Azure AD error when `AUTH_METHOD=azure`
- [x] GET /api/users still returns user list in Azure mode (read-only, unaffected)
- [x] `seedDefaultAdmin()` is not called on the login page when `AUTH_METHOD=azure`
- [x] User management works unchanged when `AUTH_METHOD=credentials` (regression)
- [x] All unit tests pass (`npx vitest run`)
- [x] Azure-mode E2E tests pass (`npx playwright test --config playwright.azure.config.ts`)
- [x] Credentials-mode E2E tests pass (`npx playwright test --project=chromium`) — no regressions

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Hide "Users" tab entirely in Azure mode**: Instead of showing the tab with an info notice, completely remove it from the tab bar. This would simplify the UI but loses the discoverability of the informational message.
- **Admin role mapping from Azure AD groups**: Map Azure AD groups to local roles (admin/viewer) to support granular access control. Currently not needed since the app has no role system.
- **Azure user listing in management panel**: Show a read-only list of Azure-authenticated users (from the `app_user` table) in the Users tab, even in Azure mode. Would help operators see who has accessed the system.
- **Redirect `/management?tab=users` to a different default tab in Azure mode**: Automatically redirect to the "Configuration" tab when a user navigates directly to the Users tab URL in Azure mode.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
