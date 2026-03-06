# Story 1.2: Login Page Adapts to Configured Authentication Method - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User sees appropriate login interface based on configuration |
| Description | As a user, I want to see the appropriate login interface based on how the system is configured so that I know how to authenticate. |
| Priority | High |
| Related Research | `specifications/azure-entra-login/extracted-tasks.md`, `specifications/azure-entra-login/jira-tasks.md` |

## Proposed Solution

Modify the existing login page (Next.js server component) to read the active authentication method via `getAuthMethod()` (already implemented in Story 1.1) and conditionally render either the existing `LoginForm` (credentials mode) or a new `AzureLoginButton` component (Azure mode). Because the login page is a server component, the auth method check happens server-side — no client-side fetch or flash of incorrect content.

```
┌─────────────────────────────────────────────────────────┐
│          src/app/login/page.tsx (Server Component)       │
│                                                          │
│  1. seedDefaultAdmin()                                   │
│  2. Check session → redirect if authenticated            │
│  3. getAuthMethod() → 'credentials' | 'azure'           │
│  4. Render page wrapper + conditional child:             │
│     ├─ credentials → <LoginForm />          (unchanged)  │
│     └─ azure       → <AzureLoginButton />   (new)       │
│  5. Subtitle text adapts per auth method                 │
└──────────────────────┬────────────────┬─────────────────┘
                       │                │
                       ▼                ▼
          ┌──────────────────┐  ┌───────────────────────┐
          │  LoginForm.tsx   │  │  AzureLoginButton.tsx  │
          │  (existing, no   │  │  (new client component)│
          │   changes)       │  │                        │
          │  • Username      │  │  • Azure AD icon/logo  │
          │  • Password      │  │  • "Login with Azure   │
          │  • Sign in btn   │  │    AD" button           │
          └──────────────────┘  │  • Links to             │
                                │    /api/auth/azure      │
                                │    (Story 1.3 endpoint) │
                                └───────────────────────┘
```

**Design decisions**:
- **Server-side conditional rendering** — The login page is already a server component. Reading `getAuthMethod()` directly avoids creating a new API endpoint and eliminates client-side flash of wrong UI. This is the idiomatic Next.js pattern.
- **Separate component for Azure button** — Rather than adding Azure logic into `LoginForm`, a new `AzureLoginButton` component keeps concerns cleanly separated. `LoginForm` remains untouched, eliminating regression risk.
- **`<a>` tag styled as button for Azure login** — The Azure PKCE flow (Story 1.3) requires a full-page navigation to the Azure authorization endpoint via a server route (`/api/auth/azure`). An `<a>` tag is semantically correct for navigation and works without JavaScript.
- **No new API endpoint** — The auth method is read server-side in the page component. No `/api/auth/method` endpoint is needed since no client component requires this information.
- **LoginForm unchanged** — The existing credentials form is rendered as-is when `AUTH_METHOD=credentials`. Zero changes to `LoginForm.tsx` means zero regression risk for the existing login flow.

## Current Implementation Analysis

### Already Implemented
- `src/lib/auth-config.ts` — `getAuthMethod()` returns `'credentials' | 'azure'` from cached, validated env config. No changes needed.
- `src/components/auth/LoginForm.tsx` — Client component with username/password form, Zod validation, and error handling. No changes needed.
- `src/app/api/auth/login/route.ts` — POST handler for credentials login. No changes needed.
- `src/app/api/auth/logout/route.ts` — POST handler for logout. No changes needed.
- `src/lib/auth.ts` — Session management, password hashing, `seedDefaultAdmin()`. No changes needed.
- `e2e/auth.spec.ts` — Existing E2E tests for credentials login flow. Serve as regression tests.

### To Be Modified
- `src/app/login/page.tsx` — Import `getAuthMethod()`, conditionally render `LoginForm` or `AzureLoginButton`, adapt heading subtitle per auth method.

### To Be Created
- `src/components/auth/AzureLoginButton.tsx` — New client component: visually prominent "Login with Azure AD" button linking to `/api/auth/azure` (implemented in Story 1.3).
- `e2e/azure-login.spec.ts` — E2E tests verifying the login page shows the correct UI per auth method.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What should the Azure login button do when clicked (since Story 1.3's endpoint doesn't exist yet)? | The button links to `/api/auth/azure` — the standard PKCE initiation route. It will 404 until Story 1.3 implements the handler. This is acceptable because Story 1.2 focuses on UI rendering, not flow execution. The button is fully styled and navigable; the endpoint is Story 1.3's responsibility. | ✅ Resolved |
| 2 | Should `seedDefaultAdmin()` be skipped on the login page when `AUTH_METHOD=azure`? | No — this is Story 1.4's scope (disabling user management under Azure). The `seedDefaultAdmin()` call is harmless (no-op when users exist) and doesn't affect the UI. Removing it here would blur story boundaries. | ✅ Resolved |
| 3 | How to E2E-test Azure mode when the Playwright dev server starts with default credentials? | Create a separate E2E spec (`azure-login.spec.ts`) that tests Azure mode UI by configuring the server environment. To address the env-var-at-startup constraint, the spec uses a separate Playwright project in the config with `AUTH_METHOD=azure` in the webServer env. The project runs on a different port to avoid conflicts. | ✅ Resolved |

## Implementation Plan

### Phase 1: Azure Login Button Component

#### Task 1.1 - [CREATE] `AzureLoginButton` client component
**Description**: Create `src/components/auth/AzureLoginButton.tsx` — a client component that renders a visually prominent "Login with Azure AD" button. The button is an `<a>` tag styled as a button that navigates to `/api/auth/azure` (the PKCE initiation endpoint created in Story 1.3). The component must be accessible (proper focus styles, keyboard navigation, aria label) and visually distinct from the existing credentials form button.

**Definition of Done**:
- [x] `src/components/auth/AzureLoginButton.tsx` exists as a server component (no `"use client"` needed — pure static `<a>` tag)
- [x] Component renders a single `<a>` element with `href="/api/auth/azure"` styled as a button
- [x] Button text is "Login with Azure AD"
- [x] Button uses distinct styling (e.g., larger padding, different colour palette) to be visually prominent
- [x] Button has proper focus ring styling consistent with existing form button (`focus:ring-2 focus:ring-offset-2`)
- [x] Button is full-width (`w-full`) to match the existing login form layout
- [x] Component has no props (self-contained)

### Phase 2: Login Page Conditional Rendering

#### Task 2.1 - [MODIFY] Conditionally render login UI based on auth method
**Description**: Modify `src/app/login/page.tsx` to import `getAuthMethod()` from `@/lib/auth-config` and use it to determine which component to render. When `AUTH_METHOD=credentials`, render `<LoginForm />` (unchanged). When `AUTH_METHOD=azure`, render `<AzureLoginButton />`. Also adapt the page subtitle text to match the active auth method.

**Definition of Done**:
- [x] `src/app/login/page.tsx` imports `getAuthMethod` from `@/lib/auth-config`
- [x] `src/app/login/page.tsx` imports `AzureLoginButton` from `@/components/auth/AzureLoginButton`
- [x] When `getAuthMethod()` returns `'credentials'`, page renders `<LoginForm />` and subtitle "Enter your credentials to access the dashboard." (current behaviour preserved exactly)
- [x] When `getAuthMethod()` returns `'azure'`, page renders `<AzureLoginButton />` and subtitle "Sign in with your organization's Azure account."
- [x] When `getAuthMethod()` returns `'azure'`, no username/password fields are rendered on the page
- [x] Page heading "Sign in to Copilot Dashboard" remains the same for both modes
- [x] Existing `seedDefaultAdmin()` and session redirect logic remain unchanged
- [x] Existing `metadata` export remains unchanged

### Phase 3: E2E Tests

#### Task 3.1 - [MODIFY] Add credentials-mode regression assertion to existing auth E2E
**Description**: Add a focused test to `e2e/auth.spec.ts` that explicitly verifies the credentials login form is shown and the Azure login button is NOT shown. This ensures Story 1.2 changes don't accidentally show Azure UI in credentials mode.

**Definition of Done**:
- [x] New test in `e2e/auth.spec.ts`: "login page shows credentials form and no Azure button"
- [x] Test asserts `Username` label is visible
- [x] Test asserts `Password` label is visible
- [x] Test asserts `Sign in` button is visible
- [x] Test asserts "Login with Azure AD" button is NOT visible
- [x] All existing tests in `e2e/auth.spec.ts` continue to pass

#### Task 3.2 - [MODIFY] Add Azure-mode Playwright project configuration
**Description**: Add a new Playwright project to `playwright.config.ts` that starts the dev server with `AUTH_METHOD=azure` and the required Azure env vars (dummy values sufficient since Story 1.3's endpoint isn't implemented yet — the test only verifies UI rendering). The project runs on a separate port to avoid conflicts with the credentials-mode server.

**Definition of Done**:
- [x] `playwright.azure.config.ts` defines a new project `"azure-mode"` with `testMatch` filtering to `azure-login.spec.ts` (separate config file used instead of multiple webServer entries — Next.js `.next` lock prevents two dev servers in the same project directory)
- [x] The Azure-mode project uses a separate webServer instance on port 3001 with `AUTH_METHOD: "azure"`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_REDIRECT_URI` set to valid dummy values
- [x] The default `"chromium"` project's `testIgnore` excludes `azure-login.spec.ts` to avoid running Azure tests against the credentials server
- [x] Running `npx playwright test --project=chromium` still works as before (credentials mode only)
- [x] Running `npx playwright test --config playwright.azure.config.ts` starts the Azure-mode server and runs Azure-specific tests

#### Task 3.3 - [CREATE] Azure-mode E2E spec
**Description**: Create `e2e/azure-login.spec.ts` with tests that verify the login page renders correctly when `AUTH_METHOD=azure`. Tests navigate to `/login` and assert the Azure-specific UI elements.

**Definition of Done**:
- [x] `e2e/azure-login.spec.ts` exists
- [x] Test: "login page shows Azure AD login button" — asserts a link/button with text "Login with Azure AD" is visible
- [x] Test: "login page does not show username/password fields" — asserts no element with label "Username" or "Password" is visible
- [x] Test: "login page shows Azure-specific subtitle" — asserts text "Sign in with your organization's Azure account" is visible
- [x] Test: "Azure AD button links to /api/auth/azure" — asserts the button/link `href` contains `/api/auth/azure`
- [x] Test: "page heading remains unchanged" — asserts "Sign in to Copilot Dashboard" heading is visible
- [x] All tests pass when run with `npx playwright test --config playwright.azure.config.ts`

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent against all files changed in this story to verify code quality, consistency with project patterns, accessibility, and test coverage.

**Definition of Done**:
- [x] All created/modified files pass code review
- [x] No critical or high-severity issues remain
- [x] `AzureLoginButton` follows the same coding patterns as `LoginForm` (client component, Tailwind styling, accessibility attributes)
- [x] Login page conditional rendering is clean and does not introduce unnecessary complexity
- [x] E2E tests follow the existing spec patterns in `e2e/auth.spec.ts`

## Security Considerations

- **No sensitive data in rendered HTML**: The login page does not expose `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, or `AZURE_REDIRECT_URI` in the HTML. Only the auth method (`'credentials'` or `'azure'`) influences the rendered output, and this is not sensitive information.
- **No open redirect risk**: The `AzureLoginButton` links to `/api/auth/azure` — a fixed, internal route on the same origin. There is no user-controlled URL in the button href.
- **Server-side rendering**: The auth method check happens server-side in the page component. A client-side request cannot trick the server into rendering the wrong login UI.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Login page shows "Login with Azure AD" button when `AUTH_METHOD=azure`
- [x] Login page shows username/password form when `AUTH_METHOD=credentials` (default)
- [x] "Login with Azure AD" button is clearly labelled and visually prominent
- [x] No username/password fields are visible when Azure auth is active
- [x] Existing credentials login flow works unchanged (regression)
- [x] E2E tests pass for credentials mode (`npx playwright test --project=chromium`)
- [x] E2E tests pass for Azure mode (`npx playwright test --config playwright.azure.config.ts`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Microsoft branding / icon on Azure button**: Adding the official Microsoft logo or Azure icon to the button for better visual recognition. Requires licensing consideration.
- **Animated transition between auth modes**: Fade or slide transition when switching modes — not applicable since mode is determined at server render time.
- **Skip `seedDefaultAdmin()` in Azure mode**: When `AUTH_METHOD=azure`, the default admin seed on the login page is unnecessary. This belongs in Story 1.4 (disable user management under Azure).
- **Dark mode support for Azure button**: The current app uses light theme only. Dark mode styling is out of scope.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-03 | Initial plan created |
| 2026-03-03 | Implementation deviation: `getAuthConfig()` in `src/lib/auth-config.ts` changed from throwing when uninitialised to lazily calling `validateAuthConfig()`. Required because Next.js dev-mode module isolation prevents the `instrumentation.ts` cache from being shared with page rendering context. Unit test updated accordingly. |
| 2026-03-03 | Implementation deviation: Azure-mode E2E uses a separate Playwright config file (`playwright.azure.config.ts`) instead of multiple `webServer` entries in a single config. Reason: Next.js `.next/dev/lock` prevents two `next dev` instances sharing the same project directory. Run Azure tests via `npx playwright test --config playwright.azure.config.ts`. |
| 2026-03-03 | Code review by `tsh-code-reviewer`: approved. MEDIUM: removed unnecessary `"use client"` from `AzureLoginButton` (pure static `<a>` tag needs no hydration). LOW: eliminated non-null assertion in `getAuthConfig()` by returning `validateAuthConfig()` directly. LOW: focus ring shade difference (500 vs 600) noted but kept intentionally for visual distinction. |
