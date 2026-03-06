# Seat List Filtering, Sorting, and Page Size Controls — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Seat list: configurable page size, text search, status filter, column sorting |
| Description | Enhance the seat list with controls to: (1) change the number of items displayed per page (100, 200, 300), (2) filter seats by a text search across username, first name, last name, and department, (3) filter seats by status, and (4) sort by any column (username, first name, last name, department, last active, status) with ascending/descending toggle via clickable column headers. Last active supports sorting only, not filtering. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/story-3-4.plan.md` |

## Proposed Solution

Extend the existing seats API and `SeatListPanel` component with three new capabilities: **text search**, **column sorting**, and **configurable page size**.

The API (`GET /api/seats`) already supports `page`, `pageSize`, and `status` filter. It will be extended with `search`, `sortBy`, and `sortOrder` query parameters. The `MAX_PAGE_SIZE` constant will increase from 100 to 300 to accommodate the new page size options.

The frontend `SeatListPanel` will gain a toolbar above the table with a search input (debounced 300 ms), a status filter dropdown, and a page size selector. Column headers become clickable to toggle sort direction.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  SeatListPanel (MODIFIED)                                                        │
│                                                                                  │
│  ┌─ Toolbar ──────────────────────────────────────────────────────────────────┐  │
│  │ [🔍 Search…          ] [Status ▾ All/Active/Inactive] [Page size ▾ 100]   │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─ Table ────────────────────────────────────────────────────────────────────┐  │
│  │ Username ▲ │ Status  │ First Name │ Last Name │ Department │ Last Active │  │  │
│  │ ← clickable column headers with sort indicators (▲ ASC / ▼ DESC)         │  │
│  │            │         │            │           │            │             │  │  │
│  │  ... data rows ...                                                       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─ Pagination ───────────────────────────────────────────────────────────────┐  │
│  │  Showing 1–100 of 542 seats     [← Previous]  Page 1 of 6  [Next →]      │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  fetchSeats(page, pageSize, search, status, sortBy, sortOrder)                   │
│      ↓                                                                           │
│  GET /api/seats?page=1&pageSize=100&search=alice&status=active                   │
│                 &sortBy=githubUsername&sortOrder=asc                              │
└──────────────────────────────────────────────────────────────────────────────────┘

API query parameters:
┌──────────┬──────────────────────────────────────────────────────────────────────┐
│ Param    │ Description                                                         │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ page     │ Page number (≥1), default 1                  (EXISTING)             │
│ pageSize │ Items per page (1–300), default 100           (MODIFIED — was 20)   │
│ status   │ "active" | "inactive" | omit for all          (EXISTING)            │
│ search   │ Case-insensitive partial match across         (NEW)                 │
│          │ githubUsername, firstName, lastName, department                      │
│ sortBy   │ Column name to sort by                         (NEW)                │
│          │ One of: githubUsername, firstName, lastName,                         │
│          │         department, lastActivityAt, status                           │
│ sortOrder│ "asc" | "desc", default "asc"                  (NEW)                │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `src/app/api/seats/route.ts` — GET endpoint with `page`, `pageSize` (max 100), and `status` filter. Hardcoded `order: { githubUsername: "ASC" }`. Will be modified.
- `src/app/api/seats/__tests__/route.test.ts` — Integration tests for GET endpoint. Will be extended.
- `src/components/seats/SeatListPanel.tsx` — Client component with table, pagination, and inline edit. Hardcoded `PAGE_SIZE = 20`. Will be modified.
- `src/entities/copilot-seat.entity.ts` — `CopilotSeat` interface and `CopilotSeatEntity` with all relevant columns — fully reusable, no changes needed
- `src/entities/enums.ts` — `SeatStatus` enum (`active`, `inactive`) — reusable for status filter validation
- `src/lib/db.ts` — `getDb()` database connection — reused
- `src/lib/api-auth.ts` — `requireAuth()`, `isAuthFailure()` — reused
- `src/test/db-helpers.ts` — Test database helpers — reused
- `e2e/helpers/auth.ts` — `seedTestUser()`, `loginViaApi()` — reused
- `e2e/seat-list.spec.ts` — Existing E2E tests for seat list — reference pattern for new E2E tests
- `e2e/seat-edit.spec.ts` — E2E tests for seat editing — reference pattern

### To Be Modified
- `src/app/api/seats/route.ts` — Add `search`, `sortBy`, `sortOrder` query parameter handling; increase `MAX_PAGE_SIZE` to 300; change `DEFAULT_PAGE_SIZE` to 100; replace hardcoded sort with dynamic `order`; add `ILike` search across 4 text columns combined with status filter
- `src/app/api/seats/__tests__/route.test.ts` — Add integration tests for `search`, `sortBy`, `sortOrder` params
- `src/components/seats/SeatListPanel.tsx` — Replace hardcoded `PAGE_SIZE` with state; add toolbar with search input (debounced 300 ms), status filter dropdown, page size selector; add clickable column headers for sorting with direction indicators; wire all controls to `fetchSeats`; reset page to 1 on filter/sort/pageSize changes

### To Be Created
- `e2e/seat-list-controls.spec.ts` — E2E tests for search, sort, page size, and status filter controls

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Single search box or per-column filters? | Single search box — searches across username, first name, last name, and department simultaneously | ✅ Resolved |
| 2 | How to filter by "last active"? | Sort only, no filter. Users can sort by lastActivityAt column but cannot filter by date ranges | ✅ Resolved |
| 3 | What page size options? | 100, 200, 300 (default: 100) | ✅ Resolved |
| 4 | Should `%` and `_` in search input be escaped to prevent LIKE pattern injection? | Yes — these characters should be escaped so they're treated as literals. While not a security risk (queries are parameterized), unescaped wildcards produce unexpected results for users | ✅ Resolved |
| 5 | How should NULLs sort for nullable columns (firstName, lastName, department, lastActivityAt)? | PostgreSQL default: NULLS LAST for ASC, NULLS FIRST for DESC. This is reasonable — null names/departments sort to the bottom when sorting A→Z, and "Never" activity sorts to the bottom when sorting oldest-first | ✅ Resolved |

## Implementation Plan

### Phase 1: API — Search and Sort Query Parameters

#### Task 1.1 - [MODIFY] Extend GET /api/seats with search, sort, and updated page size `src/app/api/seats/route.ts`
**Description**: Modify the existing GET endpoint to accept `search`, `sortBy`, and `sortOrder` query parameters. Increase `MAX_PAGE_SIZE` from 100 to 300 and change `DEFAULT_PAGE_SIZE` from 20 to 100. The `search` parameter performs case-insensitive partial matching across `githubUsername`, `firstName`, `lastName`, and `department` using TypeORM's `ILike`. The `sortBy` parameter accepts one of the six sortable column names. The `sortOrder` parameter accepts `asc` or `desc`. Invalid values fall back to defaults.

**Definition of Done**:
- [x] `DEFAULT_PAGE_SIZE` changed from `20` to `100`
- [x] `MAX_PAGE_SIZE` changed from `100` to `300`
- [x] `search` query parameter parsed from URL; when non-empty, constructs an OR query across `githubUsername`, `firstName`, `lastName`, `department` using `ILike('%search%')`
- [x] `%` and `_` characters in search input are escaped before passing to `ILike` to prevent LIKE pattern injection
- [x] Search is combined with the existing `status` filter: each OR branch includes the status condition so both filter and search apply simultaneously
- [x] `sortBy` query parameter parsed from URL; validated against a whitelist of sortable fields (`githubUsername`, `firstName`, `lastName`, `department`, `lastActivityAt`, `status`); invalid values default to `githubUsername`
- [x] `sortOrder` query parameter parsed from URL; validated as `asc` or `desc` (case-insensitive); invalid values default to `asc`
- [x] The `order` option in `findAndCount` uses the dynamic `sortBy` and `sortOrder` instead of the hardcoded `{ githubUsername: "ASC" }`
- [x] When no `search` or `sortBy` params are provided, the behaviour is identical to the previous implementation (except for the updated default page size)
- [x] `ILike` is imported from `typeorm`
- [x] File compiles without TypeScript errors

#### Task 1.2 - [MODIFY] Add integration tests for search, sort, and page size changes `src/app/api/seats/__tests__/route.test.ts`
**Description**: Extend the existing GET endpoint test suite with new tests covering the `search`, `sortBy`, and `sortOrder` parameters, as well as the updated `MAX_PAGE_SIZE` and `DEFAULT_PAGE_SIZE` values.

**Definition of Done**:
- [x] Test: default pageSize is now 100 (updated from 20)
- [x] Test: clamps pageSize above 300 to 300 (updated from 100)
- [x] Test: `search` parameter filters by partial githubUsername match (case-insensitive)
- [x] Test: `search` parameter filters by partial firstName match
- [x] Test: `search` parameter filters by partial lastName match
- [x] Test: `search` parameter filters by partial department match
- [x] Test: `search` combined with `status` filter applies both conditions
- [x] Test: `search` with no matches returns empty seats array and total 0
- [x] Test: `search` with `%` or `_` characters treats them as literals, not wildcards
- [x] Test: `sortBy=firstName&sortOrder=asc` returns seats sorted by firstName ascending
- [x] Test: `sortBy=lastActivityAt&sortOrder=desc` returns seats sorted by lastActivityAt descending (most recent first)
- [x] Test: `sortBy=status` returns seats sorted by status
- [x] Test: invalid `sortBy` value falls back to `githubUsername` sort
- [x] Test: invalid `sortOrder` value falls back to `asc`
- [x] Test: combined search + sort + status filter + pagination works correctly
- [x] All existing tests still pass (update the two tests that assert default pageSize=20 and max clamped to 100)
- [x] All new tests pass

### Phase 2: Frontend — Controls and Sortable Headers

#### Task 2.1 - [MODIFY] Add toolbar, page size selector, search, status filter, and sortable headers to SeatListPanel `src/components/seats/SeatListPanel.tsx`
**Description**: Extend the `SeatListPanel` component with a toolbar above the table and sortable column headers. The toolbar contains: (1) a text search input with 300 ms debounce, (2) a status filter dropdown (All / Active / Inactive), and (3) a page size selector dropdown (100, 200, 300). Column headers become clickable to set sort direction. Clicking a column header sets it as the active sort field (ASC); clicking again toggles to DESC; clicking a different column resets to ASC on the new column. A sort indicator (▲ or ▼) is displayed on the active sort column. All filter/sort/pageSize changes reset the page back to 1.

**Definition of Done**:
- [x] Remove the hardcoded `const PAGE_SIZE = 20` constant
- [x] Add `pageSize` state (default: 100) with a `<select>` dropdown offering 100, 200, 300 options
- [x] The page size selector has an accessible `<label>` (can be visually hidden)
- [x] Add `searchInput` state (what the user types) and `search` state (debounced value sent to API)
- [x] Add a `useEffect` that debounces `searchInput` → `search` with a 300 ms delay, cleaning up the timeout on unmount
- [x] The search input has `type="search"`, `placeholder="Search…"`, and an accessible label
- [x] Add `statusFilter` state (default: `""` for all, `"active"`, `"inactive"`) with a `<select>` dropdown
- [x] The status filter dropdown has an accessible `<label>` (can be visually hidden)
- [x] Add `sortBy` state (default: `"githubUsername"`) and `sortOrder` state (default: `"asc"`)
- [x] Column headers (`<th>`) render as `<button>` elements inside the `<th>` (or the entire `<th>` is clickable)
- [x] Clicking a column header: if it's already the active sort field, toggle `sortOrder` (asc ↔ desc); otherwise, set `sortBy` to that column and `sortOrder` to `asc`
- [x] The active sort column header displays an indicator: `▲` for ASC, `▼` for DESC
- [x] Non-active column headers show a subtle neutral indicator (e.g., `⇅` or no indicator) to hint they're sortable
- [x] The "Actions" column header is NOT sortable
- [x] The `fetchSeats` function passes all parameters to the API: `page`, `pageSize`, `search`, `status`, `sortBy`, `sortOrder`
- [x] Changing `search`, `statusFilter`, `sortBy`, `sortOrder`, or `pageSize` resets `page` back to 1
- [x] The `useEffect` dependency array includes all filter/sort/pageSize state so fetchSeats re-runs on changes
- [x] The toolbar is styled with `flex`, `gap`, consistent padding, and uses existing Tailwind classes from the codebase
- [x] The "Showing X–Y of Z seats" text in pagination reflects the current `pageSize`
- [x] The inline edit feature continues to work correctly (no regression)
- [x] File compiles without TypeScript errors

### Phase 3: E2E Tests

#### Task 3.1 - [CREATE] E2E tests for seat list controls `e2e/seat-list-controls.spec.ts`
**Description**: Create Playwright E2E tests verifying the search, sort, page size, and status filter controls work end-to-end. Tests seed seats directly in the database, interact with the controls, and verify the table content updates correctly. Follows the established pattern from `e2e/seat-list.spec.ts`.

**Definition of Done**:
- [x] Test: search input is visible on the seats page
- [x] Test: typing in search input filters the displayed seats (partial match on username)
- [x] Test: search filters by first name, last name, and department
- [x] Test: clearing search restores all seats
- [x] Test: status filter dropdown is visible with options (All, Active, Inactive)
- [x] Test: selecting "Active" in status filter shows only active seats
- [x] Test: selecting "Inactive" in status filter shows only inactive seats
- [x] Test: page size selector is visible with options (100, 200, 300)
- [x] Test: changing page size updates the number of displayed rows
- [x] Test: clicking a column header sorts by that column
- [x] Test: clicking the same column header a second time reverses the sort order
- [x] Test: combining search + status filter shows only matching seats
- [x] All tests set up and tear down test data correctly (configuration + auth + seat records)
- [x] Tests pass in isolation and do not interfere with other test files

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [ ] All new and modified source code reviewed by `tsh-code-reviewer` agent
- [ ] No critical or high-severity issues remain unresolved
- [ ] All review feedback addressed or documented as intentional design decisions
- [ ] Code follows project conventions (TypeORM EntitySchema, TypeScript strict mode, existing test patterns, Zod validation, Tailwind CSS styling)
- [ ] Test coverage is adequate for the feature scope
- [ ] Accessibility requirements met (labels on inputs, keyboard-navigable sort headers)

## Security Considerations

- **LIKE pattern injection prevention**: The `%` and `_` characters in the search input are escaped before constructing the `ILike` pattern. This prevents users from crafting wildcard patterns that could return unexpected results. While TypeORM uses parameterized queries (no SQL injection risk), unescaped wildcards can cause performance issues with leading wildcards on large datasets.
- **Sort field whitelist**: The `sortBy` parameter is validated against a strict whitelist of allowed column names. Any value outside the whitelist falls back to the default (`githubUsername`). This prevents injection of arbitrary column names or SQL fragments into the ORDER BY clause.
- **Sort order validation**: The `sortOrder` parameter only accepts `asc` or `desc`. Invalid values fall back to `asc`.
- **Page size capped**: `MAX_PAGE_SIZE` is set to 300. Requests exceeding this are clamped. This prevents denial-of-service by requesting enormous result sets.
- **Authentication preserved**: All existing `requireAuth()` / `isAuthFailure()` guards remain in place. No new endpoints are introduced, only query parameters on the existing authenticated endpoint.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] User can change the number of items displayed per page using the page size selector (100, 200, 300) — verified by E2E test
- [ ] User can filter seats by typing in the search box — the search matches across username, first name, last name, and department (case-insensitive, partial match) — verified by integration tests and E2E tests
- [ ] User can filter seats by status (All / Active / Inactive) — verified by existing integration tests (status filter) and new E2E tests
- [ ] User can sort seats by clicking any column header (username, first name, last name, department, last active, status) — verified by integration tests and E2E tests
- [ ] Sort direction toggles when clicking the same column header again — verified by E2E test
- [ ] Active sort column displays a direction indicator (▲ ASC / ▼ DESC) — verified by E2E test
- [ ] Changing filter, sort, or page size resets to page 1 — verified by E2E test
- [ ] Search input is debounced (300 ms) to avoid excessive API calls — verified by implementation review
- [ ] Inline seat editing continues to work correctly — verified by existing E2E tests in `seat-edit.spec.ts`
- [ ] All new integration tests pass
- [ ] All new E2E tests pass
- [ ] All existing tests continue to pass (no regressions)
- [ ] No TypeScript compilation errors
- [ ] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Database indexes for search performance**: For large seat counts (>10k), adding a composite GIN trigram index on the searchable text columns (`githubUsername`, `firstName`, `lastName`, `department`) would significantly improve `ILIKE '%pattern%'` query performance. At current expected scale this is premature optimization.
- **URL state persistence**: Sync filter/sort/pageSize state to URL query parameters so that the current view is shareable and survives page refresh. Currently, navigating away and back resets all controls.
- **Saved/preset filters**: Allow users to save commonly used filter combinations (e.g., "Active Engineering") for quick access.
- **CSV/Excel export with current filters**: Export the currently filtered and sorted seat list to CSV/Excel format.
- **Date range filter for Last Active**: Add a date range picker to filter seats by their last activity date. Deferred per user decision — sort-only for now.
- **Per-column filter inputs**: Instead of a single search box, provide individual filter inputs per column for more precise filtering.
- **Server-side search debounce / rate limiting**: Add API-level rate limiting for the search endpoint to protect against rapid-fire requests.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
