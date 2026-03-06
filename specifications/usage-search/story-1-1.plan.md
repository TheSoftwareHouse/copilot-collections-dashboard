# User can search seats on the Seat Usage tab - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | User can search seats on the Seat Usage tab |
| Description | Add search functionality to the Seat Usage tab so users can filter seats by GitHub username, first name, or last name with server-side filtering, debounced input, URL persistence, and pagination reset. |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [quality-review.md](./quality-review.md), [jira-tasks.md](./jira-tasks.md) |

## Proposed Solution

Add server-side search to the existing seat usage flow by extending the `GET /api/usage/seats` API endpoint with an optional `search` query parameter and adding a debounced search input to the `SeatUsagePanel` component. The approach mirrors the established pattern from the seat management page (`SeatListPanel` + `GET /api/seats`).

```
                        ┌──────────────────────────────────┐
                        │        UsagePageLayout           │
                        │  (URL state: tab, month, year)   │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │        SeatUsagePanel            │
                        │  + search input (debounced)      │
                        │  + URL search param persistence  │
                        │  + pagination reset on search    │
                        └──────────────┬───────────────────┘
                                       │
                    GET /api/usage/seats?month=M&year=Y
                        &page=P&pageSize=N&search=Q
                                       │
                        ┌──────────────▼───────────────────┐
                        │   API Route (server-side)        │
                        │   WHERE cs."githubUsername"       │
                        │     ILIKE '%Q%'                  │
                        │     OR cs."firstName" ILIKE '%Q%'│
                        │     OR cs."lastName" ILIKE '%Q%' │
                        └──────────────────────────────────┘
```

**Design decisions:**

1. **Server-side search** — The seat usage tab is paginated (datasets can be large). Search must filter across the full dataset, not just the currently visible page. This is consistent with the existing `GET /api/seats` pattern.
2. **Debounced input (300ms)** — Matches the existing `SeatListPanel` debounce delay to provide a consistent UX and avoid excessive API requests.
3. **URL search param (`search`)** — The `UsagePageLayout` already persists `tab`, `month`, and `year` in the URL. Adding `search` as a URL query parameter follows this established pattern and ensures bookmarkability/shareability.
4. **SQL ILIKE** — Case-insensitive matching using PostgreSQL `ILIKE` with proper escaping of special characters (`%`, `_`, `\`), matching the `escapeLikePattern` utility already used in `GET /api/seats`.
5. **Separation of concerns** — The search input UI and debounce logic live in `SeatUsagePanel` (the data-fetching container), while `SeatUsageTable` (presentational) remains unchanged.

## Current Implementation Analysis

### Already Implemented
- `SeatUsagePanel` — `src/components/usage/SeatUsagePanel.tsx` — Data-fetching container with pagination state, `useAsyncFetch` hook, loading/error/empty states.
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — Presentational table component rendering seat rows with drill-down links. No changes needed.
- `Pagination` — `src/components/usage/Pagination.tsx` — Shared pagination controls. No changes needed.
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — Tab container with URL state management for `tab`, `month`, `year`. Used to read/write `search` param.
- `useAsyncFetch` — `src/lib/hooks/useAsyncFetch.ts` — Generic data-fetching hook that re-fetches when the URL string changes. Naturally supports adding `search` param to the URL.
- `GET /api/usage/seats` — `src/app/api/usage/seats/route.ts` — API route with pagination, month/year filtering. Base for adding search.
- `GET /api/seats` — `src/app/api/seats/route.ts` — Reference implementation of server-side search with `ILike`/TypeORM pattern and `escapeLikePattern`.
- `escapeLikePattern` — `src/app/api/seats/route.ts` — Utility to escape SQL LIKE special characters. Currently local to this file.
- `SeatListPanel` — `src/components/seats/SeatListPanel.tsx` — Reference implementation of debounced search input (300ms) with `searchInput` / `search` state pattern.
- Route tests — `src/app/api/usage/seats/__tests__/route.test.ts` — Existing test suite covering pagination, defaults, ordering, auth.
- E2E tests — `e2e/seat-usage.spec.ts` — Existing E2E suite covering seat tab, pagination, month filter, drill-down.
- `handleRouteError` — `src/lib/api-helpers.ts` — Standardised error handler used in API routes.

### To Be Modified
- `GET /api/usage/seats` route — `src/app/api/usage/seats/route.ts` — Add `search` query parameter parsing; add `WHERE` clause with `ILIKE` filtering on `cs."githubUsername"`, `cs."firstName"`, `cs."lastName"` in both the count query and the main query.
- `SeatUsagePanel` — `src/components/usage/SeatUsagePanel.tsx` — Add search input state (`searchInput`), debounced `search` state (300ms), URL persistence for search param, pagination reset on search change, empty state for "no results match search" (distinct from "no data for month").
- `UsagePageLayout` — `src/components/usage/UsagePageLayout.tsx` — Pass `search` param through to `SeatUsagePanel` when the seat tab is active; persist `search` in the URL alongside `tab`, `month`, `year`; clear `search` when switching away from the seat tab.

### To Be Created
- `escapeLikePattern` — `src/lib/api-helpers.ts` — Extract the existing `escapeLikePattern` function from `src/app/api/seats/route.ts` to the shared helpers module for reuse across API routes.
- Unit tests for search — `src/app/api/usage/seats/__tests__/route.test.ts` — New test cases covering search by username, firstName, lastName, case-insensitivity, empty search, pagination with search.
- E2E tests for search — `e2e/seat-usage.spec.ts` — New test cases covering search input visibility, filtering by typing, pagination reset, empty state, URL persistence, search clearing.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `search` URL param be cleared when switching tabs? | Yes — each tab will have its own search state in future stories; clearing avoids leaking the seat search param to other tabs. | ✅ Resolved |
| 2 | Should the empty state when search returns no results differ from "no data for month"? | Yes — show "No seats match your search" when a search query is active and returns 0 results, vs. the existing "No per-seat usage data available" when no search is active. | ✅ Resolved |
| 3 | Should search also match the `department` field? | No — the story requirements explicitly list "GitHub username, first name, or last name". Department is not included. | ✅ Resolved |

## Implementation Plan

### Phase 1: API — Add search support to `GET /api/usage/seats`

#### Task 1.1 - [MODIFY] Extract `escapeLikePattern` to shared helpers
**Description**: Move the `escapeLikePattern` function from `src/app/api/seats/route.ts` to `src/lib/api-helpers.ts` so it can be reused by the usage seats route. Update the import in `src/app/api/seats/route.ts` to reference the new location.

**Definition of Done**:
- [x] `escapeLikePattern` function exists in `src/lib/api-helpers.ts` with the same signature and logic as the current version in `src/app/api/seats/route.ts`
- [x] `src/app/api/seats/route.ts` imports `escapeLikePattern` from `@/lib/api-helpers` instead of defining it locally
- [x] The local `escapeLikePattern` function is removed from `src/app/api/seats/route.ts`
- [x] No existing tests are broken (all existing route tests pass)

#### Task 1.2 - [MODIFY] Add `search` parameter to `GET /api/usage/seats` route
**Description**: Extend the API route to accept an optional `search` query parameter. When provided and non-empty, filter the results so that only seats whose `githubUsername`, `firstName`, or `lastName` match the search term (case-insensitive, partial match using `ILIKE`). The search filter must be applied to both the count query and the main aggregation query. Use the shared `escapeLikePattern` helper to escape special characters.

**Definition of Done**:
- [x] Route reads `search` param from `searchParams` and trims whitespace
- [x] When `search` is non-empty, the count query includes `WHERE` clause with `ILIKE` on `cs."githubUsername"`, `cs."firstName"`, and `cs."lastName"` (OR conditions)
- [x] When `search` is non-empty, the main aggregation query includes the same `ILIKE` filter in the `JOIN` condition
- [x] Special characters in the search term (`%`, `_`, `\`) are properly escaped via `escapeLikePattern`
- [x] When `search` is empty or not provided, behaviour is identical to before (no regression)
- [x] Response JSON structure is unchanged (no new fields needed for the search feature)

#### Task 1.3 - [MODIFY] Add unit tests for search parameter
**Description**: Extend the existing test suite in `src/app/api/usage/seats/__tests__/route.test.ts` with test cases covering the new search functionality.

**Definition of Done**:
- [x] Test: search by `githubUsername` returns matching seats
- [x] Test: search by `firstName` returns matching seats
- [x] Test: search by `lastName` returns matching seats
- [x] Test: search is case-insensitive (e.g., searching "ALICE" matches "alice")
- [x] Test: search with no matching results returns empty seats array with `total: 0`
- [x] Test: empty/missing search param returns all seats (no filtering)
- [x] Test: pagination works correctly with active search (total count reflects filtered set)
- [x] All pre-existing tests continue to pass

### Phase 2: Frontend — Add search input to `SeatUsagePanel` with URL persistence

#### Task 2.1 - [MODIFY] Add search state and debounced input to `SeatUsagePanel`
**Description**: Add a search input above the seat usage table in `SeatUsagePanel`. Implement the debounced search pattern (300ms) matching the existing `SeatListPanel` approach: `searchInput` state for immediate input tracking and `search` state for the debounced value sent to the API. Include the `search` parameter in the `useAsyncFetch` URL. Reset pagination to page 1 when the search term changes. Add an accessible label for the search input.

**Definition of Done**:
- [x] A search input with `type="search"` and placeholder "Search seats…" is rendered above the table
- [x] The input has an accessible label (via `<label>` with `htmlFor` or `aria-label`)
- [x] Typing in the input updates `searchInput` state immediately
- [x] After 300ms of no typing, the debounced `search` value is updated
- [x] The `useAsyncFetch` URL includes `&search=<encoded-value>` when search is non-empty
- [x] Pagination resets to page 1 when the debounced search value changes
- [x] When search is cleared, the full seat list is restored
- [x] When search returns 0 results, a distinct empty state message is shown (e.g., "No seats match your search query")
- [x] The component continues to show the existing empty state when there is no data for the month (no search active)

#### Task 2.2 - [MODIFY] Persist search query in URL
**Description**: Integrate the search query into the URL state management. Read the initial `search` value from the URL on mount. When the debounced search value changes, update the URL using `window.history.replaceState`. When switching away from the seat tab (handled by `UsagePageLayout`), the search param should be cleared from the URL.

**Definition of Done**:
- [x] On mount, `SeatUsagePanel` reads the `search` param from `window.location.search` and initialises both `searchInput` and `search` states with the value
- [x] When the debounced `search` value changes, the URL is updated via `window.history.replaceState` to include/remove the `search` param
- [x] Refreshing the page with `?search=alice` in the URL pre-fills the search input and filters results
- [x] The `search` param is removed from the URL when the search input is cleared
- [x] `UsagePageLayout` clears the `search` param from the URL when switching tabs (to prevent leaking seat search to team/department tabs)

### Phase 3: E2E Tests

#### Task 3.1 - [MODIFY] Add E2E tests for seat usage search
**Description**: Extend the E2E test suite in `e2e/seat-usage.spec.ts` with tests covering the search functionality end-to-end.

**Definition of Done**:
- [x] Test: search input is visible on the seat usage tab
- [x] Test: typing a query filters the seat table to matching results (by username)
- [x] Test: search is case-insensitive (typing lowercase matches uppercase data)
- [x] Test: clearing the search input restores the full list
- [x] Test: empty state message is shown when search has no matches
- [x] Test: pagination resets to page 1 when a search query is entered (seed >20 seats, go to page 2, then search)
- [x] Test: search query is preserved in URL after page refresh
- [x] All pre-existing E2E tests continue to pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all changed files to verify code quality, consistency, and adherence to project patterns.

**Definition of Done**:
- [x] All changed files reviewed: `src/lib/api-helpers.ts`, `src/app/api/seats/route.ts`, `src/app/api/usage/seats/route.ts`, `src/app/api/usage/seats/__tests__/route.test.ts`, `src/components/usage/SeatUsagePanel.tsx`, `src/components/usage/UsagePageLayout.tsx`, `e2e/seat-usage.spec.ts`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows established project patterns (debounce, URL state, error handling, test structure)

## Security Considerations

- **SQL injection prevention**: The search term is used with parameterised queries (PostgreSQL `$N` placeholders) and the `ILIKE` pattern is escaped via `escapeLikePattern` to prevent injection through special characters (`%`, `_`, `\`). The search term is never interpolated directly into SQL strings.
- **Input sanitisation**: The search term is trimmed server-side. No HTML rendering of the search term occurs on the frontend (React auto-escapes by default).
- **Authentication**: The existing `requireAuth` guard on the API route ensures only authenticated users can access usage data. No changes to authentication are needed.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A search input is displayed above the seat usage table
- [x] Seats can be filtered by GitHub username, first name, or last name
- [x] Search results update as the user types with debounced input (300ms)
- [x] Pagination resets to page 1 when a search query is entered
- [x] Clearing the search query restores the full seat list
- [x] An empty state message is displayed when no seats match the query
- [x] Search matching is case-insensitive
- [x] The search query is persisted in the URL as a query parameter
- [x] All unit tests pass (including new search-specific tests)
- [x] All E2E tests pass (including new search-specific tests)
- [x] No regression in existing functionality (pagination, month filter, drill-down)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Extract shared `useSearchDebounce` hook**: The debounce pattern (`searchInput` → `setTimeout` → `search` + reset page) is repeated in `SeatListPanel` and will be repeated here. A shared custom hook could deduplicate this logic. Defer until Story 1.2+ when the pattern is needed in more places.
- **Extract `escapeLikePattern` to a database utility module**: While this plan moves it to `api-helpers.ts`, a dedicated `src/lib/db-utils.ts` or `src/lib/sql-helpers.ts` module may be more appropriate as more database utilities accumulate.
- **Search by department on seat usage tab**: Department is a visible column but not included in the search fields per the story requirements. Could be added as a follow-up enhancement.
- **Refactor `SeatUsagePanel` pagination + search into a custom hook**: As more features are added to the panel, extracting data-fetching logic into a `useSeatUsageData` hook would improve testability and separation of concerns.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-04 | Initial plan created |
| 2026-03-04 | Implementation complete — all phases done, code review findings resolved |
