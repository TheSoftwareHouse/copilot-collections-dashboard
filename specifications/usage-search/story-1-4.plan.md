````markdown
# User can search members on the Department Detail page - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can search members on the Department Detail page |
| Description | Add search functionality to the member list on the department detail page so users can filter members by GitHub username, first name, or last name with client-side filtering, debounced input, chart update, and a distinct empty state. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [quality-review.md](./quality-review.md), [jira-tasks.md](./jira-tasks.md), [story-1-3.plan.md](./story-1-3.plan.md) |

## Proposed Solution

Add **client-side** search to the existing department detail flow by adding a debounced search input to `DepartmentDetailPanel` and filtering the already-fetched member list in memory before passing it to both `DepartmentMemberChart` and `TeamMemberTable`. No API changes are needed because the department detail endpoint already returns all members in a single response (no pagination).

```
             ┌──────────────────────────────────────┐
             │       DepartmentDetailPanel           │
             │  (fetches /api/usage/departments/:id) │
             │  + search input (debounced)           │
             │  + client-side filter by username,    │
             │    firstName, lastName                │
             └──────┬───────────────┬────────────────┘
                    │               │
         filtered   │               │  filtered
         members[]  │               │  members[]
                    │               │
     ┌──────────────▼───┐   ┌──────▼──────────────────┐
     │DepartmentMember  │   │ TeamMemberTable          │
     │Chart (unchanged) │   │ (shared, unchanged)      │
     └──────────────────┘   └─────────────────────────┘
```

**Design decisions:**

1. **Client-side search** — The department detail endpoint loads all members in a single API call without pagination. Client-side filtering avoids unnecessary network round-trips and provides instant feedback. This is consistent with the approach used for team usage search (Story 1.2) and department usage search (Story 1.3).
2. **Multi-field matching** — Unlike Stories 1.2 and 1.3 which match a single field (team name / department name), this story requires matching against three fields: `githubUsername`, `firstName`, and `lastName`. The filter checks if any of these fields contain the search term (case-insensitive, partial match via `String.toLowerCase().includes()`).
3. **Debounced input (300ms)** — Matches the existing `SeatUsagePanel`, `TeamUsagePanel`, and `DepartmentUsagePanel` debounce delay for a consistent UX across the application.
4. **No URL persistence** — The story requirements do not include URL persistence for the search query on detail pages. This is intentional: detail pages are deep links already parameterised by `departmentId`, `month`, and `year`. Search is a transient interaction. This keeps the implementation simpler and avoids URL clutter.
5. **Chart + table both update** — Both `DepartmentMemberChart` and `TeamMemberTable` receive the filtered member list as props. Passing the filtered array naturally updates both views without requiring any changes to the child components.
6. **Separation of concerns** — The search input UI, debounce logic, and filtering all live in `DepartmentDetailPanel` (the data-fetching container). `TeamMemberTable` and `DepartmentMemberChart` (presentational) receive the filtered list and remain unchanged. This design also means Story 1.5 (team detail page search) can follow the same pattern in `TeamDetailPanel` without modifying the shared `TeamMemberTable`.
7. **Search placement** — The search input is placed above the member chart and table, within the members section (below the header and progress bar). It is only visible when the department has members (`hasMembers === true`), since searching an empty member list provides no value.

## Current Implementation Analysis

### Already Implemented
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — Data-fetching container. Fetches `/api/usage/departments/${departmentId}?month=M&year=Y` and renders breadcrumb, progress bar, header, `DepartmentMemberChart`, and `TeamMemberTable`. All member data is loaded in a single response.
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — Shared presentational table component used by both `DepartmentDetailPanel` and `TeamDetailPanel`. Accepts `members` as a prop and renders rows with username, name, usage %, and spending. No changes needed.
- `DepartmentMemberChart` — `src/components/usage/DepartmentMemberChart.tsx` — Horizontal bar chart (Recharts) showing per-member usage. Accepts `members` as a prop. Handles empty data gracefully (no bars rendered). No changes needed.
- `GET /api/usage/departments/[departmentId]` — `src/app/api/usage/departments/[departmentId]/route.ts` — API route returning department info, members array, and aggregated metrics. No pagination, no search param. No changes needed (client-side filtering).
- `MemberEntry` type — `src/lib/types.ts` — Shared interface for member entries with `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `totalGrossAmount`. Used by the detail panel.
- `TeamUsagePanel` / `DepartmentUsagePanel` — `src/components/usage/TeamUsagePanel.tsx`, `src/components/usage/DepartmentUsagePanel.tsx` — Reference implementations of client-side debounced search pattern (`searchInput`/`search` state, `useEffect` debounce, client-side `.filter()`). Pattern to replicate.
- Route tests — `src/app/api/usage/departments/[departmentId]/__tests__/route.test.ts` — Existing test suite. No changes needed (API is unchanged).
- E2E tests — `e2e/department-usage.spec.ts` — Existing E2E suite with "Department Usage — Department Detail" describe block covering detail page rendering, member table, chart, navigation, month filter, breadcrumbs.
- `handleRouteError` — `src/lib/api-helpers.ts` — Standardised error handler (not affected).

### To Be Modified
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — Add search input state (`searchInput`), debounced `search` state (300ms), client-side filtering of `members` by `githubUsername`, `firstName`, and `lastName`, pass filtered members to both `DepartmentMemberChart` and `TeamMemberTable`, add empty state for "no members match search" (distinct from "no assigned seats").

### To Be Created
- E2E tests for member search — `e2e/department-usage.spec.ts` — New `describe` block with test cases covering search input visibility, filtering by typing (username, firstName, lastName), chart update, case-insensitivity, empty state, and search clearing.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the search query be persisted in the URL on the department detail page? | No. The story requirements do not include URL persistence for detail page search. This keeps the implementation simpler and is consistent with the transient nature of member search on detail pages. | ✅ Resolved |
| 2 | Should the search input be visible when the department has no members? | No. When a department has no assigned seats, the component shows "This department has no assigned seats." and there is nothing to search. The search input is placed within the members section, only rendered when `hasMembers === true`. | ✅ Resolved |
| 3 | Should the chart be hidden when search returns no results? | No. The chart component handles empty data gracefully (renders no bars). The empty state message replaces the table section. The chart container remains visible but shows no bars, consistent with the behaviour in Story 1.3 (DepartmentUsagePanel). | ✅ Resolved |
| 4 | Should `TeamMemberTable` be modified to include search internally? | No. Following the established pattern from Stories 1.2 and 1.3, search filtering is done in the parent panel component. `TeamMemberTable` remains a pure presentational component receiving the already-filtered list. This allows Story 1.5 (team detail search) to independently add the same pattern to `TeamDetailPanel` without coupling search logic into the shared table component. | ✅ Resolved |

## Implementation Plan

### Phase 1: Frontend — Add search input to `DepartmentDetailPanel` with client-side filtering and chart update

#### Task 1.1 - [MODIFY] Add search state, debounced input, and multi-field client-side filtering to `DepartmentDetailPanel`
**Description**: Add a search input above the member chart and table in `DepartmentDetailPanel`. Implement the debounced search pattern (300ms) matching the existing `TeamUsagePanel` / `DepartmentUsagePanel` approach: `searchInput` state for immediate input tracking and `search` state for the debounced value used for filtering. Filter `members` client-side by checking if any of `githubUsername`, `firstName`, or `lastName` contain the search term (case-insensitive, partial match via `String.toLowerCase().includes()`). Handle `null` values for `firstName` and `lastName` safely. Pass the filtered array to both `DepartmentMemberChart` and `TeamMemberTable`. Add an accessible label for the search input. Show a distinct empty-state message when a search query yields no results vs. when the department has no assigned seats.

**Definition of Done**:
- [x] A search input with `type="search"` and placeholder "Search members…" is rendered above the member chart and table, only when the department has members
- [x] The input has an accessible label (via `<label>` with `htmlFor` and `sr-only` class)
- [x] Typing in the input updates `searchInput` state immediately
- [x] After 300ms of no typing, the debounced `search` value is updated
- [x] The `members` array is filtered client-side: only members whose `githubUsername`, `firstName`, or `lastName` contains the search term (case-insensitive) are passed to `DepartmentMemberChart` and `TeamMemberTable`
- [x] `null` values for `firstName` and `lastName` are handled safely (do not cause errors, are treated as non-matching)
- [x] `DepartmentMemberChart` renders only the filtered members (chart updates to reflect filtered results)
- [x] `TeamMemberTable` renders only the filtered members
- [x] When search is cleared, the full member list and chart are restored
- [x] When search returns 0 results, a distinct empty state message is shown (e.g., "No members match your search query.")
- [x] The existing empty state ("This department has no assigned seats.") continues to appear when the department has no members (no search active)
- [x] The `DepartmentDetailPanel` header section (breadcrumb, progress bar, department name, member count, month filter) is unaffected by search and always shows unfiltered department-level data

### Phase 2: E2E Tests

#### Task 2.1 - [MODIFY] Add E2E tests for department detail member search
**Description**: Extend the E2E test suite in `e2e/department-usage.spec.ts` with a new `describe` block covering the member search functionality on the department detail page. Seed a department with multiple members (distinct usernames, first names, and last names) so search filtering is verifiable across all three fields.

**Definition of Done**:
- [x] Test: search input is visible on the department detail page when the department has members
- [x] Test: search input is NOT visible when the department has no members
- [x] Test: typing a query filters the member table by GitHub username
- [x] Test: typing a query filters the member table by first name
- [x] Test: typing a query filters the member table by last name
- [x] Test: search is case-insensitive (typing lowercase matches uppercase data)
- [x] Test: the member usage chart updates to show only filtered members (bar count matches)
- [x] Test: clearing the search input restores the full member list and chart
- [x] Test: empty state message is shown when search has no matches
- [x] All pre-existing E2E tests continue to pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all changed files to verify code quality, consistency, and adherence to project patterns.

**Definition of Done**:
- [x] All changed files reviewed: `src/components/usage/DepartmentDetailPanel.tsx`, `e2e/department-usage.spec.ts`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows established project patterns (debounce, empty state handling, client-side filtering, test structure)

## Security Considerations

- **No SQL injection risk**: Filtering is performed entirely client-side in JavaScript. No user input reaches the database. The API route (`GET /api/usage/departments/[departmentId]`) is unchanged and does not accept a `search` parameter.
- **Input sanitisation**: No HTML rendering of the search term occurs on the frontend (React auto-escapes by default).
- **Null safety**: `firstName` and `lastName` can be `null` in the member data. The filter function must handle `null` values safely to prevent runtime errors (e.g., using optional chaining or nullish coalescing before calling `.toLowerCase()`).
- **Authentication**: The existing `requireAuth` guard on the API route ensures only authenticated users can access department member data. No changes to authentication are needed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A search input is displayed above the member table on the department detail page
- [x] Members can be filtered by GitHub username, first name, or last name
- [x] Search results update as the user types with debounced input (300ms)
- [x] Clearing the search query restores the full member list
- [x] The member usage chart updates to reflect the filtered results
- [x] An empty state message is displayed when no members match the query
- [x] Search matching is case-insensitive
- [x] All E2E tests pass (including new search-specific tests)
- [x] No regression in existing functionality (member table, member chart, month filter, breadcrumb, progress bar, navigation to seat detail)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Extract shared `useSearchDebounce` hook**: The debounce pattern (`searchInput` → `setTimeout` → `search`) is now duplicated across `SeatUsagePanel`, `TeamUsagePanel`, `DepartmentUsagePanel`, and will be duplicated again in `DepartmentDetailPanel`. A shared custom hook (e.g., `useSearchDebounce(initialValue, delay)`) should be extracted to eliminate this repetition. Defer to a dedicated refactor task.
- **Extract shared member filter utility**: The multi-field member filter (`githubUsername`, `firstName`, `lastName`) will be needed again in Story 1.5 (team detail page). A shared utility function (e.g., `filterMembersBySearch(members, query)`) could be extracted after Story 1.5 to eliminate duplication across both detail panels.
- **URL persistence for detail page search**: If users request shareable search URLs on detail pages in the future, the existing `readSearchFromUrl`/`updateSearchUrl` pattern from `TeamUsagePanel`/`DepartmentUsagePanel` can be added to `DepartmentDetailPanel` with minimal effort.
- **Chart empty state handling**: When all members are filtered out, the chart renders with no bars (an empty Recharts container). A dedicated empty visual for the chart (e.g., a placeholder illustration or hidden chart) could improve UX but is not part of the current requirements.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-04 | Initial plan created |
| 2026-03-04 | Phase 1 implemented: search input, debounce, multi-field filtering, empty state in DepartmentDetailPanel |
| 2026-03-04 | Phase 2 implemented: 9 E2E tests in "Department Detail Member Search" describe block. Fixed pre-existing test at line 610 — `getByText("Members")` → `getByRole("heading", { name: "Members" })` to resolve strict-mode violation caused by the new sr-only label "Search members" |
| 2026-03-04 | Phase 3 code review completed by `tsh-code-reviewer` — **PASS**. 0 critical, 0 high, 1 medium (search not cleared on month change — consistent with existing pattern, deferred), 2 low (no unit tests for filter fn — deferred to shared utility extraction; "Members" heading hidden in empty state — minor UX), 2 info. All acceptance criteria verified. |

````
