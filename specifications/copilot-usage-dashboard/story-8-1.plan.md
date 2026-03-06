# Story 8.1: Consolidate management pages under a tabbed Management section — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 8.1 |
| Title | Consolidate management pages under a tabbed Management section |
| Description | Restructure all management-related pages (Configuration, Departments, Project Teams, Jobs, Users, Seats) into a single Management section with an internal tabbed interface. Each tab displays the corresponding management content. Tab state is preserved in the URL for shareability. Default tab is Configuration; the last-used tab is restored via URL state. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 8, Story 8.1) |

## Proposed Solution

Create a new `/management` route with a client-side tabbed layout component (`ManagementPageLayout`) that embeds the six management panels as tab contents. Tab state is stored in URL search params (`?tab=<tab-id>`) using Next.js `useSearchParams()` for shareability and bookmarking. Existing panel components are reused directly — most already perform their own client-side data fetching. Two new thin wrapper components (`ConfigurationTabContent` and `JobsTabContent`) handle client-side data loading for the Configuration and Jobs tabs, which currently rely on server-side data fetching in the settings page.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  /management?tab=<tab-id>                                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │         src/app/(app)/management/page.tsx                  │  │
│  │         (Server Component - metadata + layout wrapper)     │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │     ManagementPageLayout (Client Component)                │  │
│  │     - Reads ?tab=<id> from URL search params               │  │
│  │     - Renders tab bar + active panel                       │  │
│  │     - Updates URL on tab change (shallow navigation)       │  │
│  │                                                            │  │
│  │  ┌─────────┬──────────┬───────┬──────┬───────┬──────────┐ │  │
│  │  │ Config  │  Depts   │ Teams │ Jobs │ Users │  Seats   │ │  │
│  │  └────┬────┴─────┬────┴───┬───┴──┬───┴───┬───┴─────┬────┘ │  │
│  │       │          │        │      │       │         │       │  │
│  │       ▼          ▼        ▼      ▼       ▼         ▼       │  │
│  │ ConfigTab  DeptMgmt  TeamMgmt JobsTab  UserMgmt SeatList   │  │
│  │ Content    Panel     Panel    Content  Panel    Panel      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  API Endpoints (existing):                                       │
│  GET /api/configuration ─────── ConfigurationTabContent          │
│  GET /api/job-status ────────── JobsTabContent                   │
│  GET /api/departments ───────── DepartmentManagementPanel        │
│  GET /api/teams ─────────────── TeamManagementPanel              │
│  GET /api/users ─────────────── UserManagementPanel              │
│  GET /api/seats ─────────────── SeatListPanel                    │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Client-side tabs with `useSearchParams()`**: Follows the existing `UsagePageLayout` tab pattern but adds URL state persistence. Using `router.replace()` with search params ensures tab changes are shallow (no full page reload) while URLs remain shareable and bookmarkable.

2. **Reuse existing panels directly**: `DepartmentManagementPanel`, `TeamManagementPanel`, `UserManagementPanel`, and `SeatListPanel` are all self-contained client components that fetch their own data via API calls. They are embedded as tab content without modification.

3. **New wrapper components for Configuration and Jobs**: The current settings page fetches configuration and job status data server-side and passes it as props. Since the management layout is a client component, two thin wrappers (`ConfigurationTabContent` and `JobsTabContent`) are introduced to fetch this data client-side from existing API endpoints (`GET /api/configuration` and `GET /api/job-status`). This avoids modifying the existing components' prop interfaces.

4. **Splitting Settings into Configuration + Jobs**: The current `/settings` page combines configuration editing, job status, and month recollection in one page. Story 8.1 specifies separate "Configuration" and "Jobs" tabs. Configuration tab contains `ConfigurationForm`. Jobs tab contains `JobStatusPanel` + `MonthRecollectionPanel`.

5. **Old routes kept as redirects**: The existing routes (`/settings`, `/departments`, `/teams`, `/users`, `/seats`) are converted to redirect to the corresponding management tab. This preserves existing bookmarks and any in-app links while the nav update is handled separately in Story 8.2.

6. **Container width**: Management page uses `max-w-5xl` (matching the main layout width) since the Seats tab has a wide table. Narrower panels naturally centre within the available space.

7. **ARIA tab pattern**: Tab bar uses `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, and `aria-labelledby` attributes, consistent with the existing `UsagePageLayout` implementation and WCAG requirements.

## Current Implementation Analysis

### Already Implemented
- `src/components/NavBar.tsx` — Main navigation bar with 7 top-level links (will need modification in Story 8.2, not this story)
- `src/components/setup/ConfigurationForm.tsx` — Configuration editing form, accepts `mode` and `initialValues` props
- `src/components/settings/JobStatusPanel.tsx` — Job status display, accepts serialized job execution data via props
- `src/components/settings/MonthRecollectionPanel.tsx` — Month recollection trigger, fully self-contained client component
- `src/components/departments/DepartmentManagementPanel.tsx` — Department CRUD, self-contained client component
- `src/components/teams/TeamManagementPanel.tsx` — Team CRUD, self-contained client component
- `src/components/users/UserManagementPanel.tsx` — User CRUD, self-contained client component
- `src/components/seats/SeatListPanel.tsx` — Seat list with filtering/sorting/pagination, self-contained client component
- `src/components/usage/UsagePageLayout.tsx` — Existing tab layout pattern (reference implementation for tab UI)
- `src/app/api/configuration/route.ts` — `GET /api/configuration` endpoint (returns config data)
- `src/app/api/job-status/route.ts` — `GET /api/job-status` endpoint (returns latest job executions)
- `src/app/(app)/settings/page.tsx` — Settings page (server-side data fetching, renders ConfigurationForm + JobStatusPanel + MonthRecollectionPanel)
- `src/app/(app)/departments/page.tsx` — Departments page (renders DepartmentManagementPanel)
- `src/app/(app)/teams/page.tsx` — Teams page (renders TeamManagementPanel)
- `src/app/(app)/users/page.tsx` — Users page (renders UserManagementPanel)
- `src/app/(app)/seats/page.tsx` — Seats page (renders SeatListPanel)

### To Be Modified
- `src/app/(app)/settings/page.tsx` — Convert to redirect to `/management?tab=configuration`
- `src/app/(app)/departments/page.tsx` — Convert to redirect to `/management?tab=departments`
- `src/app/(app)/teams/page.tsx` — Convert to redirect to `/management?tab=teams`
- `src/app/(app)/users/page.tsx` — Convert to redirect to `/management?tab=users`
- `src/app/(app)/seats/page.tsx` — Convert to redirect to `/management?tab=seats`
- E2E tests (`e2e/configuration-settings.spec.ts`, `e2e/department-management.spec.ts`, `e2e/team-management.spec.ts`, `e2e/user-management.spec.ts`, `e2e/seat-list.spec.ts`, `e2e/seat-list-controls.spec.ts`, `e2e/seat-edit.spec.ts`, `e2e/job-status.spec.ts`, `e2e/month-recollection.spec.ts`, `e2e/seat-usage.spec.ts`, `e2e/team-usage.spec.ts`, `e2e/department-usage.spec.ts`, `e2e/team-members.spec.ts`) — Update navigation paths to use `/management?tab=...` or verify redirects work

### To Be Created
- `src/app/(app)/management/page.tsx` — New management route (server component, renders ManagementPageLayout)
- `src/components/management/ManagementPageLayout.tsx` — Client component with tabbed interface and URL state management
- `src/components/management/ConfigurationTabContent.tsx` — Client wrapper that fetches config from API and renders ConfigurationForm
- `src/components/management/JobsTabContent.tsx` — Client wrapper that fetches job status from API and renders JobStatusPanel + MonthRecollectionPanel
- `e2e/management-tabs.spec.ts` — E2E tests for tab navigation, URL state, and tab content rendering

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should old routes return permanent (308) or temporary (307) redirects? | Use `permanentRedirect()` (308) since this is an intentional structural change. If Story 8.2 is reverted, the redirect pages can be changed back. | ✅ Resolved |
| 2 | Should the "Jobs" tab label be "Jobs" or "Job Status"? | Use "Jobs" as specified in the story requirements. | ✅ Resolved |
| 3 | Should the Seats tab use a wider container than other tabs? | No — use `max-w-5xl` at the management page level. The Seats panel already handles its own internal layout. Other panels will have natural whitespace. | ✅ Resolved |
| 4 | Should the tab query param key be `tab` or a longer name? | Use `tab` — short, conventional, and readable in URLs (e.g., `/management?tab=configuration`). | ✅ Resolved |

## Implementation Plan

### Phase 1: Create Management Tab Wrapper Components

#### Task 1.1 - [CREATE] `ConfigurationTabContent` client component
**Description**: Create a client component that fetches configuration data from `GET /api/configuration` and renders the existing `ConfigurationForm` component with the fetched values. This replaces the server-side data fetching that the current settings page performs.

**Definition of Done**:
- [x] Component fetches configuration from `GET /api/configuration` on mount
- [x] Shows a loading state while fetching
- [x] Renders `ConfigurationForm` with `mode="edit"` and fetched `initialValues` on success
- [x] Displays an error message if the fetch fails or returns a non-OK status
- [x] Handles 401 responses (session expired) with an appropriate message
- [x] Component is located at `src/components/management/ConfigurationTabContent.tsx`
- [x] Unit tests verify loading, success, and error states (covered by E2E — project has no component test infrastructure)

#### Task 1.2 - [CREATE] `JobsTabContent` client component
**Description**: Create a client component that fetches job status data from `GET /api/job-status` and renders `JobStatusPanel` with the fetched data, plus `MonthRecollectionPanel` below it. This replaces the server-side job data fetching from the current settings page.

**Definition of Done**:
- [x] Component fetches job status from `GET /api/job-status` on mount
- [x] Shows a loading state while fetching
- [x] Renders `JobStatusPanel` with serialized job execution data on success
- [x] Renders `MonthRecollectionPanel` below `JobStatusPanel`
- [x] Displays an error message if the fetch fails
- [x] Handles 401 responses with an appropriate message
- [x] Component is located at `src/components/management/JobsTabContent.tsx`
- [x] Unit tests verify loading, success, and error states (covered by E2E — project has no component test infrastructure)

### Phase 2: Create Management Page Layout

#### Task 2.1 - [CREATE] `ManagementPageLayout` client component
**Description**: Create the main tabbed layout component for the management section. It renders a tab bar with six tabs (Configuration, Departments, Project Teams, Jobs, Users, Seats) and conditionally displays the corresponding panel content. Tab state is derived from and synced to URL search params (`?tab=<id>`).

**Definition of Done**:
- [x] Component reads the `tab` search param from the URL using `useSearchParams()`
- [x] Defaults to `configuration` tab when no `tab` param is present
- [x] Renders a tab bar with exactly 6 tabs: Configuration, Departments, Project Teams, Jobs, Users, Seats
- [x] Active tab is visually indicated with blue border and text colour (consistent with `UsagePageLayout`)
- [x] Clicking a tab updates the URL search param via `router.replace()` (no full navigation)
- [x] Each tab renders the correct content panel:
  - `configuration` → `ConfigurationTabContent`
  - `departments` → `DepartmentManagementPanel`
  - `teams` → `TeamManagementPanel`
  - `jobs` → `JobsTabContent`
  - `users` → `UserManagementPanel`
  - `seats` → `SeatListPanel`
- [x] ARIA attributes are correct: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`
- [x] Component is located at `src/components/management/ManagementPageLayout.tsx`
- [x] Unit tests verify tab switching logic and URL param handling (covered by E2E — project has no component test infrastructure)
- [x] Invalid `tab` param values fall back to `configuration`

#### Task 2.2 - [CREATE] Management route page
**Description**: Create the Next.js page route at `src/app/(app)/management/page.tsx` that renders the `ManagementPageLayout` component. This is a `Suspense`-wrapped server component since `useSearchParams()` requires a Suspense boundary above it in the component tree.

**Definition of Done**:
- [x] Page is located at `src/app/(app)/management/page.tsx`
- [x] Page exports appropriate metadata (`title: "Management — Copilot Dashboard"`)
- [x] Page renders `ManagementPageLayout` wrapped in `<Suspense>` for search params support
- [x] Page uses `export const dynamic = "force-dynamic"` consistent with other pages
- [x] Page renders a heading ("Management") and description text
- [x] Navigating to `/management` renders the management page with Configuration tab active

### Phase 3: Redirect Old Routes

#### Task 3.1 - [MODIFY] Remove old management pages
**Description**: Delete each old management page (`settings`, `departments`, `teams`, `users`, `seats`) and their directories entirely. The routes no longer exist — all management functionality lives at `/management?tab=...`.

**Definition of Done**:
- [x] `/settings` page and directory removed
- [x] `/departments` page and directory removed
- [x] `/teams` page and directory removed
- [x] `/users` page and directory removed
- [x] `/seats` page and directory removed
- [x] No old page content or redirect stubs remain

### Phase 4: E2E Tests

#### Task 4.1 - [CREATE] Management tabs E2E tests
**Description**: Create a new E2E test file that verifies the tabbed management interface works correctly, including tab navigation, URL state, and content rendering for each tab.

**Definition of Done**:
- [x] Test file is located at `e2e/management-tabs.spec.ts`
- [x] Test: navigating to `/management` shows Configuration tab active by default
- [x] Test: clicking each tab shows the correct content and updates the URL
- [x] Test: navigating directly to `/management?tab=departments` shows Departments tab active
- [x] Test: navigating directly to `/management?tab=teams` shows Project Teams tab active
- [x] Test: navigating directly to `/management?tab=jobs` shows Jobs tab active
- [x] Test: navigating directly to `/management?tab=users` shows Users tab active
- [x] Test: navigating directly to `/management?tab=seats` shows Seats tab active
- [x] Test: invalid tab param defaults to Configuration tab
- [x] Test: old routes removed (N/A — pages deleted per user request, not redirected)
- [x] Tests follow existing E2E patterns (seed data, auth via API, cleanup)

#### Task 4.2 - [MODIFY] Update existing E2E tests for new routes
**Description**: Update all existing E2E tests that navigate to old management routes to use the new `/management?tab=...` URLs. Tests that use `page.goto("/settings")`, `page.goto("/departments")`, etc. should be updated, or verified to work via redirects.

**Definition of Done**:
- [x] `e2e/configuration-settings.spec.ts` — Updated to navigate to `/management?tab=configuration`
- [x] `e2e/department-management.spec.ts` — Updated to navigate to `/management?tab=departments`
- [x] `e2e/team-management.spec.ts` — Updated to navigate to `/management?tab=teams`
- [x] `e2e/team-members.spec.ts` — Updated to navigate to `/management?tab=teams`
- [x] `e2e/user-management.spec.ts` — Updated to navigate to `/management?tab=users`
- [x] `e2e/seat-list.spec.ts` — Updated to navigate to `/management?tab=seats`
- [x] `e2e/seat-list-controls.spec.ts` — Updated to navigate to `/management?tab=seats`
- [x] `e2e/seat-edit.spec.ts` — Updated to navigate to `/management?tab=seats`
- [x] `e2e/job-status.spec.ts` — Updated to navigate to `/management?tab=jobs`
- [x] `e2e/month-recollection.spec.ts` — Updated to navigate to `/management?tab=jobs`
- [x] All updated tests pass (131/131)

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Automated code review
**Description**: Run `tsh-code-reviewer` agent to verify the implementation follows project conventions, coding standards, accessibility requirements, and has no regressions.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All identified issues are resolved (Issue 1: URL normalization fix applied)
- [x] All E2E tests pass (131/131)
- [x] All unit tests pass (451/451)
- [x] No lint errors

## Security Considerations

- **No new API endpoints**: All data access goes through existing authenticated API routes (`GET /api/configuration`, `GET /api/job-status`, etc.) which already enforce `requireAuth()`.
- **No new data exposure**: The management page does not expose any additional data beyond what was already accessible on the individual management pages.
- **Session handling**: The `ConfigurationTabContent` and `JobsTabContent` wrappers handle 401 responses gracefully, consistent with other client components in the application.
- **URL parameter validation**: The `tab` search param is validated against a known whitelist of tab IDs. Invalid values fall back to the default tab, preventing injection of unexpected values.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Management section contains tabs: Configuration, Departments, Project Teams, Jobs, Users, Seats
- [ ] Each tab displays the corresponding management content
- [ ] Active tab is visually indicated (blue border and text)
- [ ] Tab state is preserved in the URL for shareability and bookmarking (`?tab=<id>`)
- [ ] Current functionality of each management page is preserved within its tab
- [ ] The default tab when first navigating to Management is Configuration
- [ ] Navigating away and returning with a URL preserves the last-used tab via URL state
- [ ] Old routes (`/settings`, `/departments`, `/teams`, `/users`, `/seats`) redirect to the corresponding management tab
- [ ] All existing E2E tests pass with updated routes
- [ ] New E2E tests for tab navigation and URL state pass
- [ ] ARIA tab attributes are correct for screen reader accessibility
- [ ] No new lint or type errors introduced

## Improvements (Out of Scope)

- **Story 8.2 — Simplify main navigation**: Update `NavBar` to show only Dashboard, Usage, and Management links. Remove old individual links. This is tracked separately.
- **Keyboard navigation for tabs**: Arrow key navigation between tabs (WAI-ARIA Tabs pattern) could enhance accessibility further. Not required by current acceptance criteria.
- **Lazy loading tab content**: Currently all tab panels mount their content immediately when selected. A lazy-loading approach with `React.lazy()` or dynamic imports could improve initial load performance if the management section grows significantly.
- **Tab transition animations**: Fade or slide animations when switching tabs could improve the perceived UX. Not in scope.
- **Persistent tab state**: Using `localStorage` to remember the last active tab even when navigating away and returning without a tab param. Current implementation uses only URL state per the requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Phase 3 changed: old management pages deleted entirely instead of converted to redirects (per user request) |
| 2026-03-01 | NavBar links updated to point to /management?tab=... to prevent broken nav links after old route deletion |
| 2026-03-01 | Phase 4 completed: 8 new management-tabs E2E tests + 13 existing E2E test files updated — 131/131 tests passing |
| 2026-03-01 | Phase 5 completed: code review passed, Issue 1 (NavBar active state on default tab) fixed via URL normalization in ManagementPageLayout |
