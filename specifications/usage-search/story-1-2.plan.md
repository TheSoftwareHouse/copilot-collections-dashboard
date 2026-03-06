````markdown
# User can search teams on the Team Usage tab - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can search teams on the Team Usage tab |
| Description | Add search functionality to the Team Usage tab so users can filter teams by team name with client-side filtering, debounced input, URL persistence, and a distinct empty state. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [quality-review.md](./quality-review.md), [jira-tasks.md](./jira-tasks.md), [story-1-1.plan.md](./story-1-1.plan.md) |

## Proposed Solution

Add **client-side** search to the existing team usage flow by adding a debounced search input to `TeamUsagePanel` and filtering the already-fetched team list in memory before passing it to `TeamUsageTable`. No API changes are needed because the team usage endpoint already returns all teams in a single response (no pagination).

```
                        ┌──────────────────────────────────┐
                        │        UsagePageLayout           │
                        │  (URL: tab, month, year)         │
                        │  Clears `search` on tab switch   │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │        TeamUsagePanel            │
                        │  + search input (debounced)      │
                        │  + URL search param persistence  │
                        │  + client-side filter by name    │
                        └──────────────┬───────────────────┘
                                       │  filtered teams[]
                        ┌──────────────▼───────────────────┐
                        │        TeamUsageTable            │
                        │     (presentational, unchanged)  │
                        └──────────────────────────────────┘
```

**Design decisions:**

1. **Client-side search** — The team usage tab loads all teams in a single API call without pagination. The dataset is expected to remain small (tens of teams, not thousands). Client-side filtering avoids unnecessary network round-trips on each keystroke and provides instant feedback. This is explicitly noted as a valid approach in the technical notes for this story.
2. **Debounced input (300ms)** — Matches the existing `SeatUsagePanel` debounce delay (established in Story 1.1) for a consistent UX across tabs.
3. **URL search param (`search`)** — The `UsagePageLayout` already clears the `search` param when switching tabs (implemented in Story 1.1). `TeamUsagePanel` reads/writes the `search` URL param using `window.history.replaceState`, following the same pattern as `SeatUsagePanel`.
4. **Case-insensitive matching** — Uses `String.toLowerCase()` for the client-side comparison, matching the story's case-insensitivity requirement without SQL involvement.
5. **Separation of concerns** — The search input UI, debounce logic, and filtering all live in `TeamUsagePanel` (the data-fetching container). `TeamUsageTable` (presentational) receives the filtered list and remains unchanged.

## Current Implementation Analysis

### Already Implemented
- `TeamUsagePanel` — `src/components/usage/TeamUsagePanel.tsx` — Data-fetching container with `useAsyncFetch` hook, loading/error/empty states. Fetches `/api/usage/teams?month=M&year=Y` and renders `TeamUsageTable`.
- `TeamUsageTable` — `src/components/usage/TeamUsageTable.tsx` — Presentational table component rendering team rows with drill-down links. No changes needed.
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — Tab container with URL state management. Already clears the `search` param from the URL when switching tabs (implemented in Story 1.1). No changes needed.
- `useAsyncFetch` — `src/lib/hooks/useAsyncFetch.ts` — Generic data-fetching hook that re-fetches when the URL string changes. Used by `TeamUsagePanel`.
- `GET /api/usage/teams` — `src/app/api/usage/teams/route.ts` — API route returning all teams with aggregated usage metrics. No pagination, no search param. No changes needed (client-side filtering).
- `SeatUsagePanel` — `src/components/usage/SeatUsagePanel.tsx` — Reference implementation of debounced search with URL persistence (`readSearchFromUrl`, `searchInput`/`search` state, `useEffect` debounce, `updateSearchUrl`). Pattern to replicate in `TeamUsagePanel`.
- Route tests — `src/app/api/usage/teams/__tests__/route.test.ts` — Existing test suite. No changes needed (API is unchanged).
- E2E tests — `e2e/team-usage.spec.ts` — Existing E2E suite covering team tab, team detail page, navigation, month filter.
- `handleRouteError` — `src/lib/api-helpers.ts` — Standardised error handler (not affected).

### To Be Modified
- `TeamUsagePanel` — `src/components/usage/TeamUsagePanel.tsx` — Add search input state (`searchInput`), debounced `search` state (300ms), URL persistence for search param, client-side filtering of `data.teams` by `teamName`, empty state for "no teams match search" (distinct from "no teams defined").

### To Be Created
- E2E tests for search — `e2e/team-usage.spec.ts` — New test cases covering search input visibility, filtering by typing, empty state, URL persistence, search clearing.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should search be client-side or server-side for the team tab? | Client-side. The team usage tab loads all teams in a single API call (no pagination). The dataset is small, so client-side filtering is simpler and provides instant results. No API changes needed. | ✅ Resolved |
| 2 | Should the empty state when search returns no results differ from "no teams defined"? | Yes — show "No teams match your search query." when a search query is active and returns 0 results, vs. the existing "No teams have been defined yet…" when no search is active. This mirrors the pattern from Story 1.1 (SeatUsagePanel). | ✅ Resolved |
| 3 | Should the `search` URL param be cleared when switching tabs? | Already handled. `UsagePageLayout` deletes the `search` param from the URL in `handleTabChange` (implemented in Story 1.1). | ✅ Resolved |

## Implementation Plan

### Phase 1: Frontend — Add search input to `TeamUsagePanel` with client-side filtering and URL persistence

#### Task 1.1 - [MODIFY] Add search state, debounced input, and client-side filtering to `TeamUsagePanel`
**Description**: Add a search input above the team usage table in `TeamUsagePanel`. Implement the debounced search pattern (300ms) matching the existing `SeatUsagePanel` approach: `searchInput` state for immediate input tracking and `search` state for the debounced value used for filtering. Read the initial `search` value from the URL on mount. Filter `data.teams` client-side by checking if `team.teamName.toLowerCase()` includes the search term (lowercased). Pass the filtered array to `TeamUsageTable`. Add an accessible label for the search input. Show a distinct empty-state message when a search query yields no results vs. when no teams are defined.

**Definition of Done**:
- [x] A search input with `type="search"` and placeholder "Search teams…" is rendered above the table
- [x] The input has an accessible label (via `<label>` with `htmlFor` or `aria-label` with `sr-only` class)
- [x] Typing in the input updates `searchInput` state immediately
- [x] After 300ms of no typing, the debounced `search` value is updated
- [x] The `data.teams` array is filtered client-side: only teams whose `teamName` contains the search term (case-insensitive) are passed to `TeamUsageTable`
- [x] When search is cleared, the full team list is restored
- [x] When search returns 0 results, a distinct empty state message is shown (e.g., "No teams match your search query.")
- [x] The component continues to show the existing empty state when there are no teams defined (no search active)
- [x] The search input is visible during loading and error states (consistent with `SeatUsagePanel`)

#### Task 1.2 - [MODIFY] Persist search query in URL
**Description**: Integrate the search query into the URL state management. Read the initial `search` value from the URL on mount using `readSearchFromUrl()` (same helper pattern as `SeatUsagePanel`). When the debounced search value changes, update the URL using `window.history.replaceState`. The `UsagePageLayout` already clears `search` when switching tabs, so no changes are needed there.

**Definition of Done**:
- [x] On mount, `TeamUsagePanel` reads the `search` param from `window.location.search` and initialises both `searchInput` and `search` states with the value
- [x] When the debounced `search` value changes, the URL is updated via `window.history.replaceState` to include/remove the `search` param
- [x] Refreshing the page with `?tab=team&search=front` in the URL pre-fills the search input and filters the team list
- [x] The `search` param is removed from the URL when the search input is cleared

### Phase 2: E2E Tests

#### Task 2.1 - [MODIFY] Add E2E tests for team usage search
**Description**: Extend the E2E test suite in `e2e/team-usage.spec.ts` with tests covering the search functionality end-to-end. Seed multiple teams so search filtering is verifiable.

**Definition of Done**:
- [x] Test: search input is visible on the team usage tab
- [x] Test: typing a query filters the team table to matching results (by team name)
- [x] Test: search is case-insensitive (typing lowercase matches uppercase team name)
- [x] Test: clearing the search input restores the full team list
- [x] Test: empty state message is shown when search has no matches
- [x] Test: search query is preserved in URL after page refresh
- [x] All pre-existing E2E tests continue to pass

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all changed files to verify code quality, consistency, and adherence to project patterns.

**Definition of Done**:
- [x] All changed files reviewed: `src/components/usage/TeamUsagePanel.tsx`, `e2e/team-usage.spec.ts`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows established project patterns (debounce, URL state, empty state handling, test structure)

## Security Considerations

- **No SQL injection risk**: Filtering is performed entirely client-side in JavaScript. No user input reaches the database. The API route (`GET /api/usage/teams`) is unchanged and does not accept a `search` parameter.
- **Input sanitisation**: No HTML rendering of the search term occurs on the frontend (React auto-escapes by default).
- **Authentication**: The existing `requireAuth` guard on the API route ensures only authenticated users can access team usage data. No changes to authentication are needed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A search input is displayed above the team usage table
- [x] Teams can be filtered by team name
- [x] Search results update as the user types with debounced input (300ms)
- [x] Clearing the search query restores the full team list
- [x] An empty state message is displayed when no teams match the query
- [x] Search matching is case-insensitive
- [x] The search query is persisted in the URL as a query parameter
- [x] All E2E tests pass (including new search-specific tests)
- [x] No regression in existing functionality (team list, team detail navigation, month filter, usage indicators)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Extract shared `useSearchDebounce` hook**: The debounce pattern (`searchInput` → `setTimeout` → `search`) is now duplicated in `SeatUsagePanel` and will be duplicated again in `TeamUsagePanel`. A shared custom hook (e.g., `useSearchDebounce(initialValue, delay)`) could eliminate this repetition. Defer until Story 1.3+ when the pattern appears in a third place.
- **Extract shared `useUrlSearchParam` hook**: The URL read/write pattern for the `search` param (`readSearchFromUrl`, `updateSearchUrl` via `replaceState`) is also duplicated. Could be combined with the debounce hook into a single `useUrlSearch` hook.
- **Server-side search for teams**: If the number of teams grows large enough to require pagination, the search would need to move server-side. For now, client-side is sufficient and simpler.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-04 | Initial plan created |
| 2026-03-04 | Implementation complete — Phases 1-2 done |
| 2026-03-04 | Code review by `tsh-code-reviewer`: 0 critical, 1 important (empty-state edge case when `data.total===0` with active search showed wrong message — fixed), 3 minor (duplicated helper — acknowledged out-of-scope, missing tab-switch E2E test — not in DoD, double URL parse — matches reference). All important findings resolved. |

````
