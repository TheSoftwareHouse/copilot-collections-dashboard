````markdown
# User can search members on the Team Detail page - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can search members on the Team Detail page |
| Description | Add search functionality to the member list on the team detail page so users can filter members by GitHub username, first name, or last name with client-side filtering, debounced input, chart update, and a distinct empty state. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [quality-review.md](./quality-review.md), [jira-tasks.md](./jira-tasks.md), [story-1-4.plan.md](./story-1-4.plan.md) |

## Proposed Solution

Add **client-side** search to the existing team detail flow by adding a debounced search input to `TeamDetailPanel` and filtering the already-fetched member list in memory before passing it to both `TeamDailyChart` and `TeamMemberTable`. No API changes are needed because the team detail endpoint already returns all members in a single response (no pagination).

```
             ┌──────────────────────────────────────────┐
             │           TeamDetailPanel                 │
             │  (fetches /api/usage/teams/:id)           │
             │  + search input (debounced, 300ms)        │
             │  + client-side filter by username,        │
             │    firstName, lastName                    │
             └───────┬─────────────────────┬─────────────┘
                     │                     │
          filtered   │                     │  filtered
     dailyUsagePerMember[]                 │  members[]
                     │                     │
      ┌──────────────▼───────┐   ┌─────────▼──────────────┐
      │ TeamDailyChart       │   │ TeamMemberTable         │
      │ (line chart,         │   │ (shared, unchanged)     │
      │  unchanged)          │   │                         │
      └──────────────────────┘   └─────────────────────────┘
```

**Design decisions:**

1. **Client-side search** — The team detail endpoint loads all members in a single API call without pagination. Client-side filtering avoids unnecessary network round-trips and provides instant feedback. This is consistent with the approach used in Story 1.4 (`DepartmentDetailPanel`).
2. **Multi-field matching** — The filter checks if any of `githubUsername`, `firstName`, or `lastName` contain the search term (case-insensitive, partial match via `String.toLowerCase().includes()`). This reuses the exact same `memberMatchesSearch` utility from Story 1.4.
3. **Shared filter utility** — Story 1.4 introduced a `memberMatchesSearch` function inline in `DepartmentDetailPanel`. Since Story 1.5 requires the identical logic, this function will be extracted to `src/lib/usage-helpers.ts` and imported by both panels. This eliminates duplication (Story 1.4 plan explicitly identified this extraction for Story 1.5).
4. **Dual data filtering** — Unlike `DepartmentDetailPanel` (which only filters `members`), `TeamDetailPanel` must also filter `dailyUsagePerMember` for the line chart. The filtered `members` array provides the set of matching `seatId`s, which is then used to filter `dailyUsagePerMember`. This ensures the chart and table always show the same members.
5. **Debounced input (300ms)** — Matches the existing pattern across all other search implementations (`SeatUsagePanel`, `TeamUsagePanel`, `DepartmentUsagePanel`, `DepartmentDetailPanel`).
6. **No URL persistence** — Consistent with Story 1.4: detail pages are deep links already parameterised by `teamId`, `month`, and `year`. Search is a transient interaction.
7. **Chart + table both update** — Both `TeamDailyChart` and `TeamMemberTable` receive filtered data as props. `TeamDailyChart` accepts `dailyUsagePerMember` (filtered) and renders only lines for matching members. `TeamMemberTable` receives `members` (filtered) and renders only matching rows. Neither child component needs modification.
8. **Search placement** — The search input is placed above the daily usage chart and member table, below the summary cards, within the members section. It is only visible when the team has members (`hasMembers === true`), since searching an empty member list provides no value.
9. **Summary cards unaffected** — The header section (breadcrumb, progress bar, team name, member count, month filter) and the three summary cards (Total Requests, Avg Requests/Member, Total Spending) always show unfiltered team-level data.

## Current Implementation Analysis

### Already Implemented
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — Data-fetching container. Fetches `/api/usage/teams/${teamId}?month=M&year=Y` and renders breadcrumb, progress bar, header, summary cards, `TeamDailyChart`, and `TeamMemberTable`. All member data is loaded in a single response.
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — Shared presentational table component used by both `DepartmentDetailPanel` and `TeamDetailPanel`. Accepts `members` as a prop and renders rows with username, name, usage %, and spending. No changes needed.
- `TeamDailyChart` — `src/components/usage/TeamDailyChart.tsx` — Line chart (Recharts) showing per-member daily usage. Accepts `dailyUsagePerMember` as a prop. Renders one line per member using `githubUsername` as data key. Handles empty data gracefully (no lines rendered). No changes needed.
- `GET /api/usage/teams/[teamId]` — `src/app/api/usage/teams/[teamId]/route.ts` — API route returning team info, members array, dailyUsagePerMember, and aggregated metrics. No pagination, no search param. No changes needed (client-side filtering).
- `MemberEntry` type — `src/lib/types.ts` — Shared interface for member entries with `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `totalGrossAmount`. Used by the detail panel.
- `memberMatchesSearch` — `src/components/usage/DepartmentDetailPanel.tsx` (inline, not exported) — Multi-field search matching function from Story 1.4. Checks `githubUsername`, `firstName`, `lastName` against a search term (case-insensitive, null-safe). To be extracted to a shared utility.
- `DepartmentDetailPanel` (with search) — `src/components/usage/DepartmentDetailPanel.tsx` — Reference implementation of client-side debounced member search pattern from Story 1.4. Pattern to replicate.
- `calcUsagePercent`, `getUsageColour` — `src/lib/usage-helpers.ts` — Existing shared usage utility module. Target location for the extracted `memberMatchesSearch` function.
- Route tests — `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts` — Existing test suite. No changes needed (API is unchanged).
- E2E tests — `e2e/team-usage.spec.ts` — Existing E2E suite with "Team Usage — Team Detail" describe block covering detail page rendering, member table, chart, navigation, month filter, breadcrumbs, colour indicators.

### To Be Modified
- `src/lib/usage-helpers.ts` — Add the exported `memberMatchesSearch` function (extracted from `DepartmentDetailPanel`).
- `src/components/usage/DepartmentDetailPanel.tsx` — Remove the inline `memberMatchesSearch` function and import it from `src/lib/usage-helpers.ts`.
- `src/components/usage/TeamDetailPanel.tsx` — Add search input state (`searchInput`), debounced `search` state (300ms), client-side filtering of `members` and `dailyUsagePerMember`, pass filtered data to both `TeamDailyChart` and `TeamMemberTable`, add empty state for "no members match search" (distinct from "no members for this month").

### To Be Created
- E2E tests for team detail member search — `e2e/team-usage.spec.ts` — New `describe` block with test cases covering search input visibility, filtering by typing (username, firstName, lastName), chart update, case-insensitivity, empty state, and search clearing.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the search query be persisted in the URL on the team detail page? | No. Consistent with Story 1.4. The story requirements do not include URL persistence for detail page search. This keeps the implementation simpler and is consistent with the transient nature of member search on detail pages. | ✅ Resolved |
| 2 | Should the search input be visible when the team has no members? | No. When a team has no members, the component shows "This team has no members for {monthLabel}." and there is nothing to search. The search input is placed within the members section, only rendered when `hasMembers === true`. | ✅ Resolved |
| 3 | Should the daily usage chart be hidden when search returns no results? | No. The chart component handles empty data gracefully (renders no lines). The empty state message replaces the table section. The chart container remains visible but shows no lines, consistent with Story 1.4 behaviour (`DepartmentDetailPanel`). | ✅ Resolved |
| 4 | Should the summary cards (Total Requests, Avg Requests/Member, Total Spending) be affected by search? | No. The summary cards display team-level aggregate data and should always show unfiltered values. Only the daily usage chart and member table are filtered by search. | ✅ Resolved |
| 5 | Should `memberMatchesSearch` be extracted to a shared utility? | Yes. Story 1.4 plan explicitly identified this extraction as an improvement for Story 1.5. Both `DepartmentDetailPanel` and `TeamDetailPanel` need the identical function. Extracting it to `src/lib/usage-helpers.ts` avoids duplication and follows DRY principles. | ✅ Resolved |

## Implementation Plan

### Phase 1: Extract shared member search utility

#### Task 1.1 - [MODIFY] Extract `memberMatchesSearch` from `DepartmentDetailPanel` to `src/lib/usage-helpers.ts`
**Description**: Move the `memberMatchesSearch` function from `DepartmentDetailPanel.tsx` to `src/lib/usage-helpers.ts` as a named export. Update `DepartmentDetailPanel.tsx` to import it from the shared module. This provides a single source of truth for the multi-field member search matching logic used by both detail panels.

**Definition of Done**:
- [x] `memberMatchesSearch` function is exported from `src/lib/usage-helpers.ts` with the same signature: `(member: MemberEntry, query: string) => boolean`
- [x] `MemberEntry` type is imported from `src/lib/types.ts` in `usage-helpers.ts`
- [x] The inline `memberMatchesSearch` function is removed from `src/components/usage/DepartmentDetailPanel.tsx`
- [x] `DepartmentDetailPanel.tsx` imports `memberMatchesSearch` from `@/lib/usage-helpers`
- [x] `DepartmentDetailPanel` behaviour is unchanged — existing E2E tests in `e2e/department-usage.spec.ts` continue to pass
- [x] No TypeScript compilation errors

### Phase 2: Add search input to `TeamDetailPanel` with client-side filtering and chart update

#### Task 2.1 - [MODIFY] Add search state, debounced input, and multi-field client-side filtering to `TeamDetailPanel`
**Description**: Add a search input above the daily usage chart and member table in `TeamDetailPanel`. Implement the debounced search pattern (300ms) matching the existing `DepartmentDetailPanel` approach: `searchInput` state for immediate input tracking and `search` state for the debounced value used for filtering. Filter `members` client-side using the shared `memberMatchesSearch` utility. Also filter `dailyUsagePerMember` by matching the `seatId`s from filtered members. Pass filtered data to both `TeamDailyChart` and `TeamMemberTable`. Add an accessible label for the search input. Show a distinct empty-state message when a search query yields no results vs. when the team has no members.

**Definition of Done**:
- [x] A search input with `type="search"` and placeholder "Search members…" is rendered above the daily usage chart and member table, only when the team has members
- [x] The input has an accessible label (via `<label>` with `htmlFor` and `sr-only` class)
- [x] Typing in the input updates `searchInput` state immediately
- [x] After 300ms of no typing, the debounced `search` value is updated
- [x] The `members` array is filtered client-side: only members whose `githubUsername`, `firstName`, or `lastName` contains the search term (case-insensitive) are included
- [x] The `dailyUsagePerMember` array is filtered to include only entries whose `seatId` matches a filtered member's `seatId`
- [x] `null` values for `firstName` and `lastName` are handled safely (do not cause errors, treated as non-matching)
- [x] `TeamDailyChart` receives filtered `dailyUsagePerMember` and renders only lines for matching members
- [x] `TeamMemberTable` receives filtered `members` and renders only matching rows
- [x] When search is cleared, the full member list and chart are restored
- [x] When search returns 0 results, a distinct empty state message is shown (e.g., "No members match your search query.")
- [x] The existing empty state ("This team has no members for {monthLabel}.") continues to appear when the team has no members (no search active)
- [x] The summary cards (Total Requests, Avg Requests/Member, Total Spending), header section (breadcrumb, progress bar, team name, member count, month filter) are unaffected by search and always show unfiltered team-level data
- [x] `memberMatchesSearch` is imported from `@/lib/usage-helpers` (not duplicated)
- [x] No TypeScript compilation errors

### Phase 3: E2E Tests

#### Task 3.1 - [MODIFY] Add E2E tests for team detail member search
**Description**: Extend the E2E test suite in `e2e/team-usage.spec.ts` with a new `describe` block covering the member search functionality on the team detail page. Seed a team with multiple members (distinct usernames, first names, and last names) so search filtering is verifiable across all three fields. The tests should mirror the pattern established in `e2e/department-usage.spec.ts` for "Department Detail Member Search".

**Definition of Done**:
- [x] Test: search input is visible on the team detail page when the team has members
- [x] Test: search input is NOT visible when the team has no members
- [x] Test: typing a query filters the member table by GitHub username
- [x] Test: typing a query filters the member table by first name
- [x] Test: typing a query filters the member table by last name
- [x] Test: search is case-insensitive (typing lowercase matches uppercase data)
- [x] Test: the daily usage chart updates to show only filtered members (line count matches)
- [x] Test: clearing the search input restores the full member list and chart
- [x] Test: empty state message is shown when search has no matches
- [x] All pre-existing E2E tests continue to pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all changed files to verify code quality, consistency, and adherence to project patterns.

**Definition of Done**:
- [x] All changed files reviewed: `src/lib/usage-helpers.ts`, `src/components/usage/DepartmentDetailPanel.tsx`, `src/components/usage/TeamDetailPanel.tsx`, `e2e/team-usage.spec.ts`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows established project patterns (debounce, empty state handling, client-side filtering, shared utilities, test structure)

## Security Considerations

- **No SQL injection risk**: Filtering is performed entirely client-side in JavaScript. No user input reaches the database. The API route (`GET /api/usage/teams/[teamId]`) is unchanged and does not accept a `search` parameter.
- **Input sanitisation**: No HTML rendering of the search term occurs on the frontend (React auto-escapes by default).
- **Null safety**: `firstName` and `lastName` can be `null` in the member data. The shared `memberMatchesSearch` function already handles `null` values safely using optional chaining and nullish coalescing.
- **Authentication**: The existing `requireAuth` guard on the API route ensures only authenticated users can access team member data. No changes to authentication are needed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A search input is displayed above the member table on the team detail page
- [x] Members can be filtered by GitHub username, first name, or last name
- [x] Search results update as the user types with debounced input (300ms)
- [x] Clearing the search query restores the full member list
- [x] The member usage chart updates to reflect the filtered results (only matching members shown)
- [x] An empty state message is displayed when no members match the query
- [x] Search matching is case-insensitive
- [x] All E2E tests pass (including new search-specific tests)
- [x] No regression in existing functionality (member table, daily usage chart, summary cards, month filter, breadcrumb, progress bar, navigation to seat detail)
- [x] Shared `memberMatchesSearch` utility extracted — no duplicated search logic across detail panels

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Extract shared `useSearchDebounce` hook**: The debounce pattern (`searchInput` → `setTimeout` → `search`) is now duplicated across `SeatUsagePanel`, `TeamUsagePanel`, `DepartmentUsagePanel`, `DepartmentDetailPanel`, and `TeamDetailPanel`. A shared custom hook (e.g., `useSearchDebounce(initialValue, delay)`) should be extracted to eliminate this repetition. Defer to a dedicated refactor task.
- **URL persistence for detail page search**: If users request shareable search URLs on detail pages in the future, the existing `readSearchFromUrl`/`updateSearchUrl` pattern from the usage tab panels can be added with minimal effort.
- **Chart empty state handling**: When all members are filtered out, the line chart renders an empty Recharts container (no lines, only axes). A dedicated empty visual or hidden chart could improve UX but is not part of the current requirements.
- **Reset search on month change**: When the month filter is changed, the search input retains its value. Resetting search on month change could improve UX consistency but is not part of the current requirements (consistent with Story 1.4 behaviour).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-04 | Initial plan created |
| 2026-03-04 | Phase 1 implemented: `memberMatchesSearch` extracted from `DepartmentDetailPanel` to `src/lib/usage-helpers.ts` as shared export. `DepartmentDetailPanel` updated to import from shared module. All department detail member search E2E tests pass. |
| 2026-03-04 | Phase 2 implemented: search input, debounce, multi-field filtering, dual data filtering (`members` + `dailyUsagePerMember`), empty state in `TeamDetailPanel`. Fixed pre-existing test at line 421 — `getByText("Members")` → `getByRole("heading", { name: "Members" })` to resolve strict-mode violation caused by the new sr-only label "Search members". |
| 2026-03-04 | Phase 3 implemented: 9 E2E tests in "Team Detail Member Search" describe block in `e2e/team-usage.spec.ts`. All 30 team-usage tests pass, all 9 department detail member search tests pass. |
| 2026-03-04 | Phase 4 code review completed by `tsh-code-reviewer` — **APPROVE**. 0 critical, 0 high, 2 medium (import order in `usage-helpers.ts` — fixed; no unit tests for `memberMatchesSearch` — deferred as per plan DoD), 2 low (pre-existing selector fix undocumented — now documented; trailing blank line — fixed), 5 info. All acceptance criteria verified. No implementation gaps found. |

````
