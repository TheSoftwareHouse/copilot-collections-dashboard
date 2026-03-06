# User can search departments on the Department Usage tab - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can search departments on the Department Usage tab |
| Description | Add search functionality to the Department Usage tab so users can filter departments by department name with client-side filtering, debounced input, URL persistence, chart update, and a distinct empty state. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [quality-review.md](./quality-review.md), [jira-tasks.md](./jira-tasks.md), [story-1-2.plan.md](./story-1-2.plan.md) |

## Proposed Solution

Add **client-side** search to the existing department usage flow by adding a debounced search input to `DepartmentUsagePanel` and filtering the already-fetched department list in memory before passing it to both `DepartmentUsageTable` and `DepartmentUsageChart`. No API changes are needed because the department usage endpoint already returns all departments in a single response (no pagination).

```
                        ┌──────────────────────────────────┐
                        │        UsagePageLayout           │
                        │  (URL: tab, month, year)         │
                        │  Clears `search` on tab switch   │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │      DepartmentUsagePanel        │
                        │  + search input (debounced)      │
                        │  + URL search param persistence  │
                        │  + client-side filter by name    │
                        └──────┬────────────┬──────────────┘
                               │            │
                    filtered   │            │  filtered
                  departments[]│            │departments[]
                               │            │
            ┌──────────────────▼──┐  ┌──────▼───────────────┐
            │ DepartmentUsageChart│  │ DepartmentUsageTable  │
            │  (unchanged)        │  │  (unchanged)          │
            └─────────────────────┘  └──────────────────────┘
```

**Design decisions:**

1. **Client-side search** — The department usage tab loads all departments in a single API call without pagination. The dataset is expected to remain small (tens of departments). Client-side filtering avoids unnecessary network round-trips and provides instant feedback. This matches the approach used for team usage search (Story 1.2).
2. **Debounced input (300ms)** — Matches the existing `SeatUsagePanel` and `TeamUsagePanel` debounce delay for a consistent UX across tabs.
3. **URL search param (`search`)** — The `UsagePageLayout` already clears the `search` param when switching tabs (implemented in Story 1.1). `DepartmentUsagePanel` reads/writes the `search` URL param using `window.history.replaceState`, following the same pattern as `TeamUsagePanel`.
4. **Case-insensitive matching** — Uses `String.toLowerCase()` for the client-side comparison, matching the story's case-insensitivity requirement without SQL involvement.
5. **Chart + table both update** — Both `DepartmentUsageChart` and `DepartmentUsageTable` receive the filtered department list as props. Passing the filtered array naturally updates both views without requiring any changes to the child components.
6. **Separation of concerns** — The search input UI, debounce logic, and filtering all live in `DepartmentUsagePanel` (the data-fetching container). `DepartmentUsageTable` and `DepartmentUsageChart` (presentational) receive the filtered list and remain unchanged.

## Current Implementation Analysis

### Already Implemented
- `DepartmentUsagePanel` — `src/components/usage/DepartmentUsagePanel.tsx` — Data-fetching container with `useAsyncFetch` hook, loading/error/empty states. Fetches `/api/usage/departments?month=M&year=Y` and renders both `DepartmentUsageChart` and `DepartmentUsageTable`.
- `DepartmentUsageTable` — `src/components/usage/DepartmentUsageTable.tsx` — Presentational table component rendering department rows with drill-down links. No changes needed.
- `DepartmentUsageChart` — `src/components/usage/DepartmentUsageChart.tsx` — Horizontal bar chart (Recharts) showing department usage percentages with colour-coded bars. Receives `departments` as a prop. No changes needed.
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — Tab container with URL state management. Already clears `search` from the URL when switching tabs (implemented in Story 1.1). No changes needed.
- `useAsyncFetch` — `src/lib/hooks/useAsyncFetch.ts` — Generic data-fetching hook. Used by `DepartmentUsagePanel`.
- `GET /api/usage/departments` — `src/app/api/usage/departments/route.ts` — API route returning all departments with aggregated usage metrics. No pagination, no search param. No changes needed (client-side filtering).
- `TeamUsagePanel` — `src/components/usage/TeamUsagePanel.tsx` — Reference implementation of client-side debounced search with URL persistence (`readSearchFromUrl`, `searchInput`/`search` state, `useEffect` debounce, `updateSearchUrl`, client-side `.filter()`). Pattern to replicate in `DepartmentUsagePanel`.
- Route tests — `src/app/api/usage/departments/__tests__/route.test.ts` — Existing test suite. No changes needed (API is unchanged).
- E2E tests — `e2e/department-usage.spec.ts` — Existing E2E suite covering department tab, department detail page, navigation, month filter, chart, breadcrumbs.
- `handleRouteError` — `src/lib/api-helpers.ts` — Standardised error handler (not affected).

### To Be Modified
- `DepartmentUsagePanel` — `src/components/usage/DepartmentUsagePanel.tsx` — Add search input state (`searchInput`), debounced `search` state (300ms), URL persistence for search param, client-side filtering of `data.departments` by `departmentName`, pass filtered departments to both `DepartmentUsageChart` and `DepartmentUsageTable`, empty state for "no departments match search" (distinct from "no departments defined").

### To Be Created
- E2E tests for search — `e2e/department-usage.spec.ts` — New test cases covering search input visibility, filtering by typing, chart update, empty state, URL persistence, search clearing.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should search be client-side or server-side for the department tab? | Client-side. The department usage tab loads all departments in a single API call (no pagination). The dataset is small, so client-side filtering is simpler and provides instant results. No API changes needed. This matches Story 1.2 (team tab). | ✅ Resolved |
| 2 | Should the empty state when search returns no results differ from "no departments defined"? | Yes — show "No departments match your search query." when a search query is active and returns 0 results, vs. the existing "No departments have been defined yet…" when no search is active. This mirrors the pattern from Stories 1.1 and 1.2. | ✅ Resolved |
| 3 | Should the `search` URL param be cleared when switching tabs? | Already handled. `UsagePageLayout` deletes the `search` param from the URL in `handleTabChange` (implemented in Story 1.1). | ✅ Resolved |
| 4 | Should the chart be hidden when search returns no results? | No — the chart simply renders nothing (no bars) when the departments array is empty, and the empty state message below replaces the table. The chart component handles empty data gracefully. | ✅ Resolved |

## Implementation Plan

### Phase 1: Frontend — Add search input to `DepartmentUsagePanel` with client-side filtering, chart update, and URL persistence

#### Task 1.1 - [MODIFY] Add search state, debounced input, client-side filtering, and chart update to `DepartmentUsagePanel`
**Description**: Add a search input above the department usage chart and table in `DepartmentUsagePanel`. Implement the debounced search pattern (300ms) matching the existing `TeamUsagePanel` approach: `searchInput` state for immediate input tracking and `search` state for the debounced value used for filtering. Read the initial `search` value from the URL on mount. Filter `data.departments` client-side by checking if `dept.departmentName.toLowerCase()` includes the search term (lowercased). Pass the filtered array to both `DepartmentUsageChart` and `DepartmentUsageTable`. Add an accessible label for the search input. Show a distinct empty-state message when a search query yields no results vs. when no departments are defined.

**Definition of Done**:
- [x] A search input with `type="search"` and placeholder "Search departments…" is rendered above the chart and table
- [x] The input has an accessible label (via `<label>` with `htmlFor` and `sr-only` class)
- [x] Typing in the input updates `searchInput` state immediately
- [x] After 300ms of no typing, the debounced `search` value is updated
- [x] The `data.departments` array is filtered client-side: only departments whose `departmentName` contains the search term (case-insensitive) are passed to `DepartmentUsageChart` and `DepartmentUsageTable`
- [x] `DepartmentUsageChart` renders only the filtered departments (chart updates to reflect filtered results)
- [x] When search is cleared, the full department list and chart are restored
- [x] When search returns 0 results, a distinct empty state message is shown (e.g., "No departments match your search query.")
- [x] The component continues to show the existing empty state when there are no departments defined (no search active)
- [x] The search input is visible during loading and error states (consistent with `TeamUsagePanel`)

#### Task 1.2 - [MODIFY] Persist search query in URL
**Description**: Integrate the search query into the URL state management. Read the initial `search` value from the URL on mount using `readSearchFromUrl()` (same helper pattern as `TeamUsagePanel`). When the debounced search value changes, update the URL using `window.history.replaceState`. The `UsagePageLayout` already clears `search` when switching tabs, so no changes are needed there.

**Definition of Done**:
- [x] On mount, `DepartmentUsagePanel` reads the `search` param from `window.location.search` and initialises both `searchInput` and `search` states with the value
- [x] When the debounced `search` value changes, the URL is updated via `window.history.replaceState` to include/remove the `search` param
- [x] Refreshing the page with `?tab=department&search=eng` in the URL pre-fills the search input and filters the department list and chart
- [x] The `search` param is removed from the URL when the search input is cleared

### Phase 2: E2E Tests

#### Task 2.1 - [MODIFY] Add E2E tests for department usage search
**Description**: Extend the E2E test suite in `e2e/department-usage.spec.ts` with tests covering the search functionality end-to-end. Seed multiple departments so search filtering is verifiable.

**Definition of Done**:
- [x] Test: search input is visible on the department usage tab
- [x] Test: typing a query filters the department table to matching results (by department name)
- [x] Test: the department usage chart updates to show only filtered departments
- [x] Test: search is case-insensitive (typing lowercase matches uppercase department name)
- [x] Test: clearing the search input restores the full department list and chart
- [x] Test: empty state message is shown when search has no matches
- [x] Test: search query is preserved in URL after page refresh
- [x] All pre-existing E2E tests continue to pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all changed files to verify code quality, consistency, and adherence to project patterns.

**Definition of Done**:
- [x] All changed files reviewed: `src/components/usage/DepartmentUsagePanel.tsx`, `e2e/department-usage.spec.ts`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows established project patterns (debounce, URL state, empty state handling, client-side filtering, test structure)

## Security Considerations

- **No SQL injection risk**: Filtering is performed entirely client-side in JavaScript. No user input reaches the database. The API route (`GET /api/usage/departments`) is unchanged and does not accept a `search` parameter.
- **Input sanitisation**: No HTML rendering of the search term occurs on the frontend (React auto-escapes by default).
- **Authentication**: The existing `requireAuth` guard on the API route ensures only authenticated users can access department usage data. No changes to authentication are needed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A search input is displayed above the department usage table
- [x] Departments can be filtered by department name
- [x] Search results update as the user types with debounced input (300ms)
- [x] Clearing the search query restores the full department list
- [x] The department usage chart updates to reflect the filtered results
- [x] An empty state message is displayed when no departments match the query
- [x] Search matching is case-insensitive
- [x] The search query is persisted in the URL as a query parameter
- [x] All E2E tests pass (including new search-specific tests)
- [x] No regression in existing functionality (department list, department detail navigation, month filter, chart, usage indicators)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Extract shared `useSearchDebounce` hook**: The debounce pattern (`searchInput` → `setTimeout` → `search`) is now duplicated across `SeatUsagePanel`, `TeamUsagePanel`, and will be duplicated again in `DepartmentUsagePanel`. This is the third instance of the pattern — a strong signal that a shared custom hook (e.g., `useSearchDebounce(initialValue, delay)`) should be extracted to eliminate repetition. Defer to a dedicated refactor task.
- **Extract shared `useUrlSearchParam` hook**: The URL read/write pattern for the `search` param (`readSearchFromUrl`, `updateSearchUrl` via `replaceState`) is also triplicated. Could be combined with the debounce hook into a single `useUrlSearch` hook.
- **Server-side search for departments**: If the number of departments grows large enough to require pagination, the search would need to move server-side. For now, client-side is sufficient and simpler.
- **Chart empty state handling**: When all departments are filtered out, the chart renders with no bars (an empty Recharts container). A dedicated empty visual for the chart (e.g., a placeholder illustration or hidden chart) could improve UX but is not part of the current requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-04 | Initial plan created |
| 2026-03-04 | Implementation complete — Phases 1-2 done |
| 2026-03-04 | Code review by `tsh-code-reviewer`: 0 critical, 0 important, 3 minor (Unicode escape cosmetic inconsistency in E2E test — fixed, search box visible when zero departments — matches TeamUsagePanel pattern, useRouter import difference from TeamUsagePanel is intentional). All findings resolved or acknowledged as pattern-consistent. |
