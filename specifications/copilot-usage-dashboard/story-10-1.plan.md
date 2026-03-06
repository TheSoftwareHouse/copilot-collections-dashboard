# Proper Back Navigation from Usage Detail Pages - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.1 |
| Title | Proper back navigation from usage detail pages |
| Description | Fix browser back button navigation from usage detail pages (team, department, seat) so it returns to the Usage section with the correct tab active and month/year context preserved. Add a visible breadcrumb as an alternative navigation path. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (lines 1562–1600) |

## Proposed Solution

The root cause is twofold:

1. **No URL-based tab state on the Usage page** — `UsagePageLayout` stores the active tab (`seat`, `team`, `department`) in local React state only. When the user navigates to a detail page and then presses browser back, the page reloads at `/usage` with the default "seat" tab, losing the user's context.

2. **Back links don't preserve context** — The "← Back to Usage" `<Link href="/usage">` in all three detail panels (`TeamDetailPanel`, `DepartmentDetailPanel`, `SeatDetailPanel`) doesn't include `?tab=X&month=Y&year=Z` query parameters, so navigating back always resets both the tab and the date filter.

**Solution approach:**

- **Sync the active tab to the URL** via a `tab` search parameter on the Usage page. `UsagePageLayout` will read `?tab=team` (or `department`, `seat`) from the URL on mount and use `window.history.pushState` when the tab changes, so the browser back button cycles through previously visited tabs. A `popstate` event listener restores tab state when navigating back.

- **Update all back links** in detail panels to point to `/usage?tab=<type>` (e.g., `/usage?tab=team` from `TeamDetailPanel`). This ensures both the explicit back link and the browser back button return to the correct tab.

- **Preserve month/year context** by threading `month` and `year` search params into the back link URL: `/usage?tab=team&month=X&year=Y`.

- **Add a breadcrumb** at the top of each detail panel replacing the plain "← Back to Usage" text. Format: `Usage > Teams > [Team Name]` (where "Usage" and "Teams" are clickable links). This provides hierarchical navigation without relying on the browser back button.

**Why not `router.back()`?** Using `router.back()` relies on the browser history stack, which is unpredictable (the user may have arrived from an external link, management page, or bookmark). Explicit links with query params give deterministic behavior regardless of how the user got to the detail page.

**Why `pushState` for tab changes and `replaceState` for month/year changes?** Tab switching is a meaningful navigation action (user explicitly moves between Seat, Team, Department views), so `pushState` creates history entries allowing the browser back button to cycle through previously opened tabs. Month/year changes are filter refinements within the same view, so `replaceState` avoids polluting the history stack with date filter changes.

```
Navigation flow:

/usage?tab=seat&month=3&year=2026
    ↓ (click team row)
/usage/teams/5?month=3&year=2026
    ↓ (browser back OR breadcrumb click)
/usage?tab=team&month=3&year=2026    ← correct tab restored

/usage?tab=department&month=2&year=2026
    ↓ (click department row)
/usage/departments/3?month=2&year=2026
    ↓ (browser back OR breadcrumb click)
/usage?tab=department&month=2&year=2026    ← correct tab restored
```

## Current Implementation Analysis

### Already Implemented
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — Tab switching with three panels (seat, team, department), month filter, fetches available months
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — Team detail view with "← Back to Usage" link
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — Department detail view with "← Back to Usage" link
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — Seat detail view with "← Back to Usage" link
- `TeamUsageTable` — `src/components/usage/TeamUsageTable.tsx` — Links to `/usage/teams/[id]?month=X&year=Y`
- `DepartmentUsageTable` — `src/components/usage/DepartmentUsageTable.tsx` — Links to `/usage/departments/[id]?month=X&year=Y`
- `MonthFilter` — `src/components/dashboard/MonthFilter.tsx` — Month/year selector dropdown
- E2E tests for back link in `e2e/team-usage.spec.ts`, `e2e/department-usage.spec.ts`, `e2e/seat-usage.spec.ts`

### To Be Modified
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — Add URL-based tab state synchronisation via `useSearchParams`; read initial `tab`, `month`, `year` from URL; update URL with `replaceState` on tab/month changes
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — Replace "← Back to Usage" with breadcrumb linking to `/usage?tab=team&month=X&year=Y`
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — Replace "← Back to Usage" with breadcrumb linking to `/usage?tab=department&month=X&year=Y`
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — Replace "← Back to Usage" with breadcrumb linking to `/usage?tab=seat&month=X&year=Y`
- `e2e/team-usage.spec.ts` — Update back link test to verify tab=team is active after navigation
- `e2e/department-usage.spec.ts` — Update back link test to verify tab=department is active after navigation
- `e2e/seat-usage.spec.ts` — Update back link test to verify tab=seat is active after navigation

### To Be Created
- `UsageBreadcrumb` — `src/components/usage/UsageBreadcrumb.tsx` — Reusable breadcrumb component for usage detail pages
- E2E test cases — New tests for breadcrumb rendering and browser back button tab restoration
- Unit tests for `UsageBreadcrumb` component

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should breadcrumb be `nav` with `aria-label="Breadcrumb"` following WAI-ARIA pattern? | Yes — follow WAI-ARIA breadcrumb pattern with `<nav aria-label="Breadcrumb">` and `<ol>` | ✅ Resolved |
| 2 | Should the seat detail page breadcrumb show the tab-level segment (e.g., "Seats")? | Yes — breadcrumb for seat: `Usage > Seats > [username]` | ✅ Resolved |

## Implementation Plan

### Phase 1: URL-Based Tab State in UsagePageLayout

#### Task 1.1 - [MODIFY] Add URL tab synchronisation to UsagePageLayout
**Description**: Modify `UsagePageLayout` to read the initial `tab` value from `window.location.search` (or `useSearchParams` from Next.js) and synchronise tab changes back to the URL using `window.history.replaceState`. Also read `month` and `year` from searchParams to initialise the date filter, and update the URL when the month changes.

**Definition of Done**:
- [x] `UsagePageLayout` reads `?tab=seat|team|department` from URL search params on mount
- [x] Invalid or missing `tab` values default to `"seat"`
- [x] `UsagePageLayout` reads `?month=X&year=Y` from URL to override `initialMonth`/`initialYear` when present
- [x] Changing the active tab updates the URL via `window.history.pushState` (creates history entry for browser back)
- [x] Changing the month/year updates the URL via `window.history.replaceState` (no new history entry)
- [x] The URL always reflects the current `tab`, `month`, and `year` state
- [x] No TypeScript or lint errors

#### Task 1.2 - [MODIFY] Update Usage page server component to pass searchParams
**Description**: Update `src/app/(app)/usage/page.tsx` to read `month`, `year`, and `tab` from `searchParams` and pass them to `UsagePageLayout`, so the server-rendered initial state matches the URL.

**Definition of Done**:
- [x] `UsagePage` reads `searchParams.month`, `searchParams.year`, `searchParams.tab` with proper defaults
- [x] `initialMonth`, `initialYear`, and `initialTab` are passed as props to `UsagePageLayout`
- [x] Navigating to `/usage?tab=team&month=2&year=2026` renders with team tab selected and February 2026 month filter

### Phase 2: Breadcrumb Component

#### Task 2.1 - [CREATE] Create UsageBreadcrumb component
**Description**: Create a reusable breadcrumb component that renders hierarchical navigation for usage detail pages. It accepts the current section type (seat/team/department), entity name, and month/year context. The breadcrumb follows WAI-ARIA breadcrumb pattern.

**Definition of Done**:
- [x] Component renders `<nav aria-label="Breadcrumb">` with an ordered list
- [x] Breadcrumb shows: `Usage` > `[Tab Label]` > `[Entity Name]`
- [x] "Usage" links to `/usage?tab=<type>&month=X&year=Y`
- [x] "[Tab Label]" (e.g., "Teams") also links to `/usage?tab=<type>&month=X&year=Y`
- [x] Current item (entity name) is displayed as text with `aria-current="page"`
- [x] Visual separator (e.g., `/` or `>`) between breadcrumb segments
- [x] Component uses consistent stylings matching the existing UI (text-sm, text-blue-600 for links, text-gray-500 for separators, text-gray-900 for current item)
- [x] No TypeScript or lint errors

#### Task 2.2 - [MODIFY] Replace back link in TeamDetailPanel with breadcrumb
**Description**: Replace the "← Back to Usage" `<Link>` in `TeamDetailPanel` with `UsageBreadcrumb`, passing `type="team"`, the team name, and current month/year. Apply to both the error state and the main render.

**Definition of Done**:
- [x] "← Back to Usage" link is replaced by `<UsageBreadcrumb>` in both error and success states
- [x] Breadcrumb displays `Usage > Teams > [Team Name]`
- [x] "Usage" and "Teams" link to `/usage?tab=team&month=X&year=Y`
- [x] Month/year context in the breadcrumb updates when the user changes the month filter

#### Task 2.3 - [MODIFY] Replace back link in DepartmentDetailPanel with breadcrumb
**Description**: Replace the "← Back to Usage" `<Link>` in `DepartmentDetailPanel` with `UsageBreadcrumb`, passing `type="department"`, the department name, and current month/year. Apply to both the error state and the main render.

**Definition of Done**:
- [x] "← Back to Usage" link is replaced by `<UsageBreadcrumb>` in both error and success states
- [x] Breadcrumb displays `Usage > Departments > [Department Name]`
- [x] "Usage" and "Departments" link to `/usage?tab=department&month=X&year=Y`
- [x] Month/year context in the breadcrumb updates when the user changes the month filter

#### Task 2.4 - [MODIFY] Replace back link in SeatDetailPanel with breadcrumb
**Description**: Replace the "← Back to Usage" `<Link>` in `SeatDetailPanel` with `UsageBreadcrumb`, passing `type="seat"`, the username, and current month/year. Apply to both the error state and the main render.

**Definition of Done**:
- [x] "← Back to Usage" link is replaced by `<UsageBreadcrumb>` in both error and success states
- [x] Breadcrumb displays `Usage > Seats > [githubUsername]`
- [x] "Usage" and "Seats" link to `/usage?tab=seat&month=X&year=Y`
- [x] Month/year context in the breadcrumb updates when the user changes the month filter

### Phase 3: E2E Tests

#### Task 3.1 - [MODIFY] Update team-usage e2e tests for breadcrumb and tab restoration
**Description**: Update the existing "back link navigates back to /usage" test in `e2e/team-usage.spec.ts` to verify it includes `?tab=team` and the correct month/year. Add a new test for browser back button behavior and breadcrumb rendering.

**Definition of Done**:
- [x] Existing back link test verifies navigation to `/usage` with `tab=team` active
- [x] New test: breadcrumb renders with `Usage > Teams > [Team Name]`
- [x] New test: clicking breadcrumb "Usage" link navigates to `/usage?tab=team` with Team tab active
- [x] New test: browser back from team detail page returns to `/usage` with Team tab active
- [x] New test: month/year context is preserved in breadcrumb when month filter changes on detail page
- [x] All tests pass

#### Task 3.2 - [MODIFY] Update department-usage e2e tests for breadcrumb and tab restoration
**Description**: Update the existing "back link navigates back to /usage" test in `e2e/department-usage.spec.ts` to verify it includes `?tab=department`. Add tests for breadcrumb rendering and browser back button behavior.

**Definition of Done**:
- [x] Existing back link test verifies navigation to `/usage` with `tab=department` active
- [x] New test: breadcrumb renders with `Usage > Departments > [Department Name]`
- [x] New test: clicking breadcrumb "Usage" link navigates to `/usage?tab=department` with Department tab active
- [x] New test: browser back from department detail page returns to `/usage` with Department tab active
- [x] All tests pass

#### Task 3.3 - [MODIFY] Update seat-usage e2e tests for breadcrumb and tab restoration
**Description**: Update the existing back link test in `e2e/seat-usage.spec.ts` to verify tab=seat. Add tests for breadcrumb rendering.

**Definition of Done**:
- [x] Existing back link test verifies navigation to `/usage` with `tab=seat` active (Seat tab visible)
- [x] New test: breadcrumb renders with `Usage > Seats > [username]`
- [x] New test: clicking breadcrumb "Usage" link navigates to `/usage?tab=seat` with Seat tab active
- [x] All tests pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review by tsh-code-reviewer
**Description**: Run `tsh-code-reviewer` agent on all changed files to verify code quality, consistency with existing patterns, and adherence to project standards.

**Definition of Done**:
- [ ] All changed files reviewed by `tsh-code-reviewer`
- [ ] No critical or high-severity issues identified
- [ ] Any review suggestions addressed or documented as intentional

## Security Considerations

- **No new API routes or data exposure** — This change is purely client-side navigation logic. No new endpoints, no sensitive data in URLs.
- **Query parameter validation** — `tab` values are validated against the known set (`seat`, `team`, `department`); invalid values fall back to `seat`. `month` and `year` are validated as integers with fallback to current date. This prevents URL injection of unexpected values.
- **No user-supplied data in breadcrumb text** — Entity names (team name, department name, username) displayed in breadcrumbs come from API responses, not from URL parameters, so XSS via URL manipulation is not possible.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Browser back from Usage > Team > [Selected Team] returns to Usage with Team tab active
- [x] Browser back from Usage > Department > [Selected Department] returns to Usage with Department tab active
- [x] Browser back from Usage > Seat > [Selected Seat] returns to Usage with Seat tab active
- [x] Month/year filter context is preserved when navigating back
- [x] A visible breadcrumb provides an alternative navigation path on all detail pages
- [x] Breadcrumb links include correct tab and month/year query parameters
- [x] Tab switching on Usage page adds entries to browser history (pushState) so back button cycles through tabs
- [x] Direct URL navigation to `/usage?tab=team` opens with Team tab active
- [x] Invalid `tab` parameter value defaults to Seat tab
- [x] All existing e2e tests continue to pass (2 pre-existing failures in unrelated files)
- [x] New e2e tests pass for breadcrumb rendering and back navigation with correct tab
- [x] No TypeScript or lint errors introduced

## Improvements (Out of Scope)

- **SeatUsagePanel table linking to detail pages** — `SeatUsagePanel` currently uses `Pagination` for navigating between seats; adding direct drill-down links from the seat table rows to detail pages is part of Story 5.2 scope, not this story.
- **Breadcrumb in management section** — The management pages could also benefit from breadcrumbs, but this is not part of Story 10.1.
- **Animated tab transitions** — Tab switching could use transitions/animations for better UX, but this is a cosmetic enhancement beyond scope.
- **Keyboard navigation between breadcrumb items** — Full keyboard trap management for breadcrumbs is beyond this story's scope (basic tab key navigation is sufficient per WAI-ARIA).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Phases 1–3 implemented. Changed tab switching from `replaceState` to `pushState` per user feedback — tab changes now create browser history entries so back button cycles through previously opened tabs. Month/year changes remain `replaceState`. Added `popstate` event listener to restore tab state on browser back. |
