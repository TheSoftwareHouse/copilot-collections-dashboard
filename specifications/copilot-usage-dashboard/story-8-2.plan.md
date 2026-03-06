# Story 8.2: Simplify main navigation to three items — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 8.2 |
| Title | Simplify main navigation to three items |
| Description | Simplify the top-level navigation bar to show only three items: Dashboard, Usage, and Management. Remove the individual links for Teams, Departments, Settings, Users, and Seats. The Management link navigates to the tabbed Management section (delivered in Story 8.1). Active state must highlight correctly for all three sections. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 8, Story 8.2) |

## Proposed Solution

Modify the `NavBar` component to reduce the `navLinks` array from 7 items to 3 items: Dashboard (`/dashboard`), Usage (`/usage`), and Management (`/management`). The `isActiveLink` function needs a small adjustment so the Management link highlights as active when the user is on _any_ `/management` path (with any tab query param), rather than requiring an exact match of path + query params.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  NavBar (src/components/NavBar.tsx)                               │
│                                                                  │
│  BEFORE (7 links):                                               │
│  Dashboard | Usage | Seats | Teams | Departments | Users | Settings│
│                                                                  │
│  AFTER (3 links):                                                │
│  Dashboard | Usage | Management                                  │
│                                                                  │
│  Active-state logic:                                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Dashboard  → pathname === "/dashboard"                      │ │
│  │ Usage      → pathname === "/usage"                          │ │
│  │ Management → pathname === "/management" (ignores ?tab=...)  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Three-item navLinks array**: Replace the existing 7-item array with `[{ href: "/dashboard", label: "Dashboard" }, { href: "/usage", label: "Usage" }, { href: "/management", label: "Management" }]`. The Management link points to `/management` (without a `?tab=` param) so the tabbed Management page applies its default tab logic (Configuration) or restores URL state if already present.

2. **Simplified active-state matching**: The current `isActiveLink` function has special logic for query params (to differentiate which management tab-link is active). With only three links — all uniquely identifiable by pathname alone — the function simplifies to `pathname === href` or `pathname.startsWith(href)` for Management. Since `/management` doesn't conflict with `/dashboard` or `/usage`, a simple `pathname === href` check is sufficient (the Management page path is exactly `/management`).

3. **No routing changes**: Story 8.1 already created `/management` with tabbed layout, old routes already redirect to management tabs. No new routes or redirects needed.

4. **E2E test updates**: Several E2E tests navigate by clicking old nav links (e.g., "Seats", "Teams", "Departments", "Settings"). These tests need updating to either navigate via the Management link and then click the appropriate tab, or navigate directly to the management URL. Tests that verify the presence of old nav items must be updated to verify the new three-item navigation.

## Current Implementation Analysis

### Already Implemented
- `src/components/NavBar.tsx` — Main navigation bar component; currently renders 7 links, needs to be reduced to 3
- `src/app/(app)/management/page.tsx` — Management route with tabbed layout (created by Story 8.1)
- `src/components/management/ManagementPageLayout.tsx` — Tabbed interface with 6 tabs (Configuration, Departments, Project Teams, Jobs, Users, Seats), URL state via `?tab=` param, default tab normalization
- `src/app/(app)/layout.tsx` — App layout that renders `<NavBar />` wrapped in `<Suspense>`

### To Be Modified
- `src/components/NavBar.tsx` — Reduce `navLinks` array to 3 items; simplify `isActiveLink` to use pathname-only matching
- `e2e/configuration-settings.spec.ts` — Test "navigation bar is present with working links" checks for `"Dashboard"` and `"Settings"` nav links; update to verify `"Dashboard"`, `"Usage"`, `"Management"` and navigate via Management link
- `e2e/seat-list.spec.ts` — Test "Seats navigation link is visible and navigates to management seats tab" clicks a `"Seats"` link in the nav; update to navigate directly to `/management?tab=seats` or via Management link + tab click
- `e2e/team-management.spec.ts` — Test "can navigate to Teams page via navigation link" clicks a `"Teams"` link; update navigation path
- `e2e/department-management.spec.ts` — Test "can navigate to Departments page via navigation link" clicks a `"Departments"` link; update navigation path

### To Be Created
- Nothing — all changes are modifications to existing files

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the Management link include a default `?tab=` param in the href? | No. The `ManagementPageLayout` component already normalizes URLs by adding `?tab=configuration` via `useEffect` when no `tab` param is present. Keeping the href as `/management` is cleaner and lets the tabbed component handle defaults. | ✅ Resolved |
| 2 | Does the active state for Management need to highlight when on any `/management?tab=...` URL? | Yes. The link href is `/management` (no query param) so the active check must match on pathname only (`pathname === "/management"`), ignoring query params. | ✅ Resolved |

## Implementation Plan

### Phase 1: Simplify NavBar Component

#### Task 1.1 - [MODIFY] Reduce `navLinks` to three items in `NavBar.tsx`
**Description**: Replace the existing 7-item `navLinks` array with exactly 3 items: Dashboard (`/dashboard`), Usage (`/usage`), and Management (`/management`). None of the new links use query params.

**Definition of Done**:
- [x] `navLinks` array contains exactly 3 entries: `{ href: "/dashboard", label: "Dashboard" }`, `{ href: "/usage", label: "Usage" }`, `{ href: "/management", label: "Management" }`
- [x] Old entries for Seats, Teams, Departments, Users, and Settings are removed
- [x] Application renders only three navigation links in the browser

#### Task 1.2 - [MODIFY] Simplify `isActiveLink` function in `NavBar.tsx`
**Description**: Since none of the three navigation links use query params, simplify the `isActiveLink` function. The current function has logic to parse query params for matching management tab-specific links. This is no longer needed. A simple `pathname === href` comparison is sufficient because all three paths (`/dashboard`, `/usage`, `/management`) are distinct and none is a prefix of another.

**Definition of Done**:
- [x] `isActiveLink` correctly returns `true` for Dashboard when pathname is `/dashboard`
- [x] `isActiveLink` correctly returns `true` for Usage when pathname is `/usage`
- [x] `isActiveLink` correctly returns `true` for Management when pathname is `/management` (regardless of `?tab=` query param)
- [x] `isActiveLink` returns `false` for non-matching paths
- [x] The `useSearchParams` import can be removed from NavBar if no longer needed (reducing the need for the `<Suspense>` wrapper — though keeping it is harmless)

### Phase 2: Update E2E Tests

#### Task 2.1 - [MODIFY] Update navigation test in `configuration-settings.spec.ts`
**Description**: The test "navigation bar is present with working links" currently checks for `"Dashboard"` and `"Settings"` links and navigates between them. Update it to verify the three new nav items (`Dashboard`, `Usage`, `Management`) and navigate to Management → Configuration tab instead of the old Settings link.

**Definition of Done**:
- [x] Test verifies that the navigation contains links for "Dashboard", "Usage", and "Management"
- [x] Test verifies that the "Settings" link no longer exists in the navigation
- [x] Test navigates from Dashboard to Management and verifies arrival at `/management` with the Configuration tab active
- [x] Test passes successfully

#### Task 2.2 - [MODIFY] Update navigation test in `seat-list.spec.ts`
**Description**: The test "Seats navigation link is visible and navigates to management seats tab" currently clicks a `"Seats"` nav link. Since "Seats" no longer exists in the top navigation, update the test to navigate to the Management page first via the nav link, then click the Seats tab.

**Definition of Done**:
- [x] Test navigates via the "Management" nav link instead of the removed "Seats" link
- [x] Test clicks the "Seats" tab within the Management tabbed interface
- [x] Test verifies arrival at `/management?tab=seats` with the Seats tab active
- [x] Test passes successfully

#### Task 2.3 - [MODIFY] Update navigation test in `team-management.spec.ts`
**Description**: The test "can navigate to Teams page via navigation link" currently clicks a `"Teams"` nav link. Update it to navigate via the Management nav link and then click the Project Teams tab.

**Definition of Done**:
- [x] Test navigates via the "Management" nav link instead of the removed "Teams" link
- [x] Test clicks the "Project Teams" tab within the Management tabbed interface
- [x] Test verifies arrival at `/management?tab=teams` with the Project Teams tab active
- [x] Test passes successfully

#### Task 2.4 - [MODIFY] Update navigation test in `department-management.spec.ts`
**Description**: The test "can navigate to Departments page via navigation link" currently clicks a `"Departments"` nav link. Update it to navigate via the Management nav link and then click the Departments tab.

**Definition of Done**:
- [x] Test navigates via the "Management" nav link instead of the removed "Departments" link
- [x] Test clicks the "Departments" tab within the Management tabbed interface
- [x] Test verifies arrival at `/management?tab=departments` with the Departments tab active
- [x] Test passes successfully

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all modified files to validate code quality, accessibility, and consistency with project patterns.

**Definition of Done**:
- [x] All modified files pass code review by `tsh-code-reviewer`
- [x] No accessibility regressions (ARIA attributes on nav links remain correct)
- [x] No unused imports remain in modified files

## Security Considerations

- **No new security concerns**: This change is purely a UI navigation simplification. No new routes, API endpoints, or authentication flows are introduced. All existing access controls remain unchanged.
- **ARIA compliance**: The `aria-label="Main navigation"` on the `<nav>` element and `aria-current="page"` on active links must be preserved to maintain accessibility.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Main navigation displays exactly three items: Dashboard, Usage, Management
- [x] Previous individual links (Teams, Departments, Settings, Users, Seats) are removed from the top-level navigation
- [x] Management link navigates to the tabbed Management section (`/management`)
- [x] Active state highlights correctly for Dashboard when on `/dashboard`
- [x] Active state highlights correctly for Usage when on `/usage`
- [x] Active state highlights correctly for Management when on `/management?tab=configuration`, `/management?tab=seats`, `/management?tab=teams`, `/management?tab=departments`, `/management?tab=jobs`, `/management?tab=users`
- [x] All existing E2E tests pass after updates
- [x] Navigation remains accessible (proper ARIA attributes, keyboard navigation)

## Improvements (Out of Scope)

- **Remove `useSearchParams` dependency from NavBar**: After this change, `NavBar` no longer needs `useSearchParams` since all active-state matching is pathname-based. The `<Suspense>` wrapper in the layout could also be simplified. This is a minor cleanup and doesn't affect functionality.
- **Add dedicated NavBar unit tests**: Currently there are no unit/integration tests for the NavBar component. Adding vitest + React Testing Library tests for the three-item navigation and active state logic would improve confidence in future changes.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation completed — Phase 1 (NavBar simplified to 3 links, isActiveLink simplified, useSearchParams removed), Phase 2 (4 E2E tests updated). All 131 E2E tests pass. |
| 2026-03-01 | Code review performed by `tsh-code-reviewer` — **Approved**. No issues found. 1 informational observation: residual `<Suspense>` wrapper in layout.tsx is harmless but could be removed as future cleanup (already marked out of scope in plan). |
