# Story 1.3 — Display Top 5 Least Active Seats on the Seat Usage Page — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Display top 5 least active seats on the seat usage page |
| Description | Add a "Least Active Seats" ranked list showing the bottom 5 seats by usage percentage on the `/usage` page so that administrators can quickly identify underutilised Copilot licences for the selected month. Restructure the rankings section into a two-column grid showing most active and least active side-by-side. |
| Priority | High |
| Related Research | `specifications/seat-usage-statistics/extracted-tasks.md`, `specifications/seat-usage-statistics/quality-review.md`, `specifications/seat-usage-statistics/story-1-2.plan.md` |

## Proposed Solution

Extend the existing `GET /api/usage/seats/rankings` endpoint to also return a `leastActive` array alongside the existing `mostActive` array, and update the `SeatUsageRankings` component to render both rankings in a two-column grid layout matching the `DashboardPanel` pattern.

**Why extend the existing endpoint** (not a new endpoint):
- Story 1.2's improvements section explicitly anticipated this: "restructure the rankings section into a `grid grid-cols-1 lg:grid-cols-2` layout showing most active and least active side-by-side."
- The endpoint name "rankings" naturally encompasses both most and least active.
- A single HTTP request is more efficient than two separate fetches.
- The SQL CTE pattern is identical — only the ORDER BY direction differs.
- The change is backward-compatible: `mostActive` remains unchanged, `leastActive` is added.

**Data flow**:
1. The route handler executes two SQL queries sharing the same CTE pattern (one `DESC` for most active, one `ASC` for least active).
2. Each query computes per-seat `grossQuantity` totals from the `copilot_usage` JSONB `usageItems` array, converts to usage percentage, JOINs `copilot_seat` for display info, and returns the top/bottom 5.
3. The response shape changes from `{ mostActive, month, year }` to `{ mostActive, leastActive, month, year }`.
4. The component renders both lists in a `grid grid-cols-1 gap-6 lg:grid-cols-2` layout (two-column on desktop, single-column on mobile).

**Component layout**:
```
┌──────────────────── Statistics Cards Grid ────────────────────┐
│  (existing from Story 1.1)                                    │
├───────────────────────────────────────────────────────────────┤
│  ┌─── Most Active Seats ─────┐  ┌─── Least Active Seats ───┐ │
│  │ ● user-a  Alice   120%   │  │ ● user-e  Eve       8%   │ │
│  │ ● user-b  Bob      95%   │  │ ● user-f  Frank    12%   │ │
│  │ ● user-c  Charlie  72%   │  │ ● user-g  Grace    18%   │ │
│  │ ● user-d  Diana    65%   │  │ ● user-h  Hank     23%   │ │
│  │ ● user-e  Eve      50%   │  │ ● user-i  Ivan     30%   │ │
│  └───────────────────────────┘  └───────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  [Search box ...]                                             │
├───────────────────────────────────────────────────────────────┤
│  Seat Usage Table (existing, unchanged)                       │
└───────────────────────────────────────────────────────────────┘
```

**Least active SQL query design**:
```sql
WITH seat_requests AS (
  SELECT
    cu."seatId",
    SUM((item->>'grossQuantity')::numeric) AS total_requests
  FROM copilot_usage cu,
       jsonb_array_elements(cu."usageItems") AS item
  WHERE cu."month" = $1 AND cu."year" = $2
  GROUP BY cu."seatId"
),
seat_usage AS (
  SELECT
    sr."seatId",
    sr.total_requests,
    CASE WHEN $3 > 0
      THEN sr.total_requests / $3 * 100
      ELSE 0
    END AS usage_percent
  FROM seat_requests sr
)
SELECT
  su."seatId",
  cs."githubUsername",
  cs."firstName",
  cs."lastName",
  ROUND(su.total_requests::numeric, 0)   AS "totalRequests",
  ROUND(su.usage_percent::numeric, 1)    AS "usagePercent"
FROM seat_usage su
JOIN copilot_seat cs ON cs.id = su."seatId"
ORDER BY su.usage_percent ASC, su.total_requests ASC
LIMIT 5
```
- Identical to the existing most active query except `ORDER BY ... ASC` instead of `DESC`
- `$1` = month, `$2` = year, `$3` = `premiumRequestsPerSeat`
- Uses existing index `IDX_copilot_usage_year_month` on `(year, month)`
- Ascending order ensures lowest usage seats come first
- Secondary sort by `total_requests ASC` as tiebreaker when percentages are equal
- Division-by-zero guarded via `CASE WHEN $3 > 0`
- `LIMIT 5` bounds the result set

**Overlap note**: When ≤5 seats have usage data, all seats appear in both `mostActive` and `leastActive`. This is acceptable — the DashboardPanel has the same behavior, and the acceptance criteria do not require excluding overlap.

## Current Implementation Analysis

### Already Implemented
- `GET /api/usage/seats/rankings` route — `src/app/api/usage/seats/rankings/route.ts` — Story 1.2. Returns `{ mostActive: SeatRankingEntry[], month, year }` using the same CTE pattern needed for least active. Integration point: add second query and `leastActive` to response.
- `SeatUsageRankings` component — `src/components/usage/SeatUsageRankings.tsx` — Story 1.2. Client component fetching `/api/usage/seats/rankings`, rendering a single "Most Active Seats" card. Integration point: extend to two-column grid with both cards.
- `SeatUsagePanel` component — `src/components/usage/SeatUsagePanel.tsx` — Already renders `<SeatUsageRankings month={month} year={year} />` in all four return paths. **No changes needed** — the updated component will automatically show both cards.
- `DashboardPanel` two-column grid pattern — `src/components/dashboard/DashboardPanel.tsx` (line 333) — `grid grid-cols-1 gap-6 lg:grid-cols-2` wrapping "Most Active Users" and "Least Active Users" cards. **Visual pattern to replicate** in `SeatUsageRankings`.
- `DashboardPanel` "Least Active Users" card — `src/components/dashboard/DashboardPanel.tsx` (lines 378–425) — Same card structure as "Most Active Users": container with border-b header, `<ul>` with divide-y, `<li>` items with `UsageStatusIndicator` + username + name + metrics. **Design pattern to follow**.
- `UsageStatusIndicator` component — `src/components/usage/UsageStatusIndicator.tsx` — Coloured dot indicating usage level. Already used in the existing "Most Active Seats" card. Will be reused for "Least Active Seats" entries.
- `useAsyncFetch` hook — `src/lib/hooks/useAsyncFetch.ts` — Generic data-fetching hook. Already used by `SeatUsageRankings`. No changes needed.
- `formatName` helper — `src/lib/format-helpers.ts` — Formats `firstName`/`lastName` into display name. Already used by `SeatUsageRankings`. Will be reused for least active entries.
- `requireAuth` / `isAuthFailure` — `src/lib/api-auth.ts` — Authentication guard. Already applied in the rankings route.
- `getPremiumAllowance` — `src/lib/get-premium-allowance.ts` — Reads `premiumRequestsPerSeat` from Configuration table. Already used in the rankings route.
- `handleRouteError` — `src/lib/api-helpers.ts` — Shared error handler. Already used in the rankings route.
- Rankings route test infrastructure — `src/app/api/usage/seats/rankings/__tests__/route.test.ts` — Existing test file with 7 passing tests, seed helpers (`seedSeat`, `seedUsage`, `makeUsageItem`, `seedAuthSession`), mocks (`@/lib/db`, `next/headers`, `@/lib/get-premium-allowance`). Integration point: add `leastActive` assertions to existing tests and new test cases.
- Rankings component test — `src/components/usage/__tests__/SeatUsageRankings.test.ts` — Existing module export check. **No changes needed**.

### To Be Modified
- `src/app/api/usage/seats/rankings/route.ts` — Add second SQL query (ASC ordering) for least active seats. Add `leastActive` array to the response.
- `src/app/api/usage/seats/rankings/__tests__/route.test.ts` — Update existing tests to also assert `leastActive` field. Add new test cases for least active ordering, limits, and edge cases.
- `src/components/usage/SeatUsageRankings.tsx` — Update response interface to include `leastActive`. Wrap both cards in a two-column grid. Add "Least Active Seats" card with ascending-order entries.

### To Be Created
- No new files needed. All changes extend existing code from story 1.2.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the least active list use the same visual pattern as the most active list? | Yes. Both cards should be visually identical (same card container, list style, entry layout, clickable links). Only the heading text and data ordering differ. This matches the DashboardPanel pattern where both "Most Active Users" and "Least Active Users" share the same card design. | ✅ Resolved |
| 2 | When ≤5 seats have usage data, should entries appear in both mostActive and leastActive? | Yes. Overlap is acceptable. The DashboardPanel has the same behavior. The acceptance criteria for story 1.3 say "When fewer than 5 seats have usage data, only the available seats are shown" — it does not mention excluding seats already shown in the most active list. | ✅ Resolved |
| 3 | Should the two-column grid collapse to single-column on mobile? | Yes. `grid grid-cols-1 gap-6 lg:grid-cols-2` — single column by default, two columns on lg breakpoint. Matches the DashboardPanel pattern. | ✅ Resolved |
| 4 | When `premiumRequestsPerSeat` is 0, what should least active rankings show? | Entries still appear (seats with requests are ranked), but usage percentage shows as "0%" for all. The SQL `CASE WHEN $3 > 0` guard handles this. Entries are then ordered by `total_requests ASC` as tiebreaker. Consistent with the most active behavior from story 1.2. | ✅ Resolved |
| 5 | Should the least active card show total requests alongside usage percentage? | Yes. Same display format as the most active card: usage percent as primary right-aligned value (e.g., "8%"), total requests as secondary detail (e.g., "24 requests"). Consistent with story 1.2. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Extend Rankings Endpoint with Least Active

#### Task 1.1 - [MODIFY] Extend `GET /api/usage/seats/rankings` to return `leastActive`
**Description**: Modify the existing rankings route at `src/app/api/usage/seats/rankings/route.ts` to execute a second SQL query for least active seats and include the results in the response.

Changes:
1. After the existing most active query, add a second query with the same CTE pattern but `ORDER BY su.usage_percent ASC, su.total_requests ASC LIMIT 5`.
2. Map the least active rows to the same `SeatRankingEntry` shape.
3. Change the response from `{ mostActive, month, year }` to `{ mostActive, leastActive, month, year }`.

The second query is identical to the first except for the `ORDER BY` direction. This keeps the code simple and follows the pattern established in story 1.2.

**Definition of Done**:
- [x] Route returns `{ mostActive, leastActive, month, year }` where `leastActive` is an array of `SeatRankingEntry`
- [x] `leastActive` contains at most 5 entries ordered by `usagePercent` ascending (lowest first)
- [x] Each `leastActive` entry includes `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `usagePercent`
- [x] When no usage data exists, `leastActive` is an empty array
- [x] Handles `premiumRequestsPerSeat === 0` gracefully (usage percent is 0, entries still returned ordered by `totalRequests ASC`)
- [x] The existing `mostActive` response field is unchanged (backward-compatible)
- [x] SQL uses parameterised queries (no string interpolation of user input)
- [x] TypeScript compilation passes with no new errors

#### Task 1.2 - [MODIFY] Update integration tests for the rankings endpoint
**Description**: Modify the existing integration tests at `src/app/api/usage/seats/rankings/__tests__/route.test.ts` to verify the `leastActive` field. Update all existing tests to also assert on `leastActive` (empty or populated as applicable), and add new test cases specific to least active ordering and edge cases.

Updated/new test cases:
1. (Update existing) Returns empty `mostActive` and `leastActive` arrays when no usage data exists.
2. (Update existing) Returns correct `mostActive` and `leastActive` ordering with 3 seats — all 3 appear in both lists since fewer than 5 seats.
3. (Update existing) Returns at most 5 entries in each list when more than 5 seats have data — verify `leastActive` contains the bottom 5.
4. (Update existing) Handles `premiumRequestsPerSeat === 0` — `leastActive` entries have `usagePercent: 0`, ordered by `totalRequests ASC`.
5. (New) Returns `leastActive` ordered by usage percent ascending — the first entry has the lowest usage.
6. (New) When exactly 5 seats have data, all 5 appear in both `mostActive` and `leastActive`.

**Definition of Done**:
- [x] All existing tests are updated to include `leastActive` assertions
- [x] At least 2 new test cases are added for least active–specific behavior
- [x] All tests pass with `npx vitest run src/app/api/usage/seats/rankings/__tests__/route.test.ts`
- [x] Tests use real PostgreSQL test database (not mocked queries)
- [x] Each test seeds its own data after `cleanDatabase` in `beforeEach`

### Phase 2: Frontend — Two-Column Rankings Layout

#### Task 2.1 - [MODIFY] Extend `SeatUsageRankings` component for two-column grid
**Description**: Modify `src/components/usage/SeatUsageRankings.tsx` to render both "Most Active Seats" and "Least Active Seats" in a two-column grid layout.

Changes:
1. Update the `SeatRankingsResponse` interface to include `leastActive: SeatRankingEntry[]`.
2. Extract the current card rendering into a reusable local helper function (e.g., `RankingCard`) that accepts a `title` string and `entries` array to avoid duplicating the card JSX.
3. Wrap both cards in a `<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">` container — matching the DashboardPanel two-column layout.
4. First card: "Most Active Seats" with `data.mostActive` (existing behavior).
5. Second card: "Least Active Seats" with `data.leastActive` (new, same visual pattern).
6. Each card independently shows its own loading/empty state.
7. Loading state: both cards show "Loading rankings…" placeholder.
8. Empty state: each card independently shows "No usage data for this month." when its respective array is empty.

**Definition of Done**:
- [x] Component renders a two-column grid (`grid grid-cols-1 gap-6 lg:grid-cols-2`) with "Most Active Seats" and "Least Active Seats" cards
- [x] The "Least Active Seats" card shows up to 5 entries ordered from lowest to highest usage
- [x] Each entry in the least active card uses the same visual pattern as most active: `UsageStatusIndicator`, `githubUsername`, display name (via `formatName`), usage percent, and total requests
- [x] Each entry is a clickable `Link` navigating to `/usage/seats/${seatId}?month=${month}&year=${year}`
- [x] When `leastActive` is empty, the card shows "No usage data for this month."
- [x] Loading state shows both cards with loading placeholders
- [x] On mobile (`< lg` breakpoint), cards stack vertically in a single column
- [x] The "Most Active Seats" card is visually unchanged from its current appearance
- [x] No dependency on search or pagination state from the parent
- [x] TypeScript compilation passes with no new errors

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Automated code review
**Description**: Run the `tsh-code-reviewer` agent against all files changed in this story to verify code quality, security, and adherence to project conventions.

**Definition of Done**:
- [x] All modified files reviewed by `tsh-code-reviewer`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows existing project patterns (auth, error handling, SQL parameterisation, card styling, navigation links)

## Security Considerations

- **SQL Injection**: The new least active query uses the same parameterised placeholders (`$1`, `$2`, `$3`) as the existing most active query. No string interpolation of user input. `LIMIT 5` is a literal.
- **Authentication**: The endpoint is already protected by `requireAuth()`. This change does not modify the auth flow.
- **Data Exposure**: The `leastActive` array returns the same fields as `mostActive` (`seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `usagePercent`). All of this data is already visible in the paginated seat table and the most active rankings. No additional PII is exposed.
- **Denial of Service**: The second query adds one additional scan of `copilot_usage` for the same month/year, bounded by the `IDX_copilot_usage_year_month` index. The incremental cost is negligible — same bounded query, just different ordering.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A "Least Active Seats" section is displayed on the seat usage page showing the bottom 5 seats by usage
- [x] Each entry shows the seat's GitHub username and their usage value (usage percentage)
- [x] The list is ordered from lowest to highest usage
- [x] Each entry shows the member's display name alongside the GitHub username
- [x] Each entry is clickable and navigates to the individual seat detail page
- [x] The section updates when the user changes the month filter
- [x] When fewer than 5 seats have usage data, only the available seats are shown
- [x] When no usage data exists for the selected month, the section shows an appropriate empty state
- [x] Most active and least active cards are displayed side-by-side in a two-column grid on desktop
- [x] The "Most Active Seats" card is visually unchanged from story 1.2
- [x] API route integration tests pass against real PostgreSQL
- [x] Existing story 1.2 tests continue to pass (backward compatibility)
- [x] TypeScript compilation (`npx tsc --noEmit`) passes with no new errors
- [x] `tsh-code-reviewer` review completes with no critical findings

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Shared SQL CTE via database view**: Stories 1.1, 1.2, and 1.3 all compute per-seat usage totals from the same CTE pattern. A PostgreSQL view or materialised view could deduplicate this, but separate queries are simpler, independently maintainable, and the overhead is negligible for typical org sizes.
- **Single combined query**: The two SQL queries for most active and least active could be combined into one query using `ROW_NUMBER()` window functions. This would evaluate the CTE once instead of twice. However, the two-query approach is simpler to read, test, and maintain, and the performance difference is negligible.
- **Configurable limit**: Allow administrators to configure the number of ranked seats shown (currently fixed at 5). Explicitly excluded per `extracted-tasks.md`.
- **Department column in rankings**: Show the department alongside username and display name. Not in the acceptance criteria but could be useful for large organisations.
- **Empty column handling**: When one list has data and the other doesn't, the grid still shows two columns with one showing an empty state. A future enhancement could collapse to single-column when only one list has data.

## Changelog

| Date | Change Description |
|------|-------------------|
| 5 March 2026 | Initial plan created |
| 5 March 2026 | Implementation complete — all 3 phases done. 10 tests pass (9 integration + 1 component), TypeScript clean. Code review: 0 critical, 0 high, 0 medium, 0 low, 4 info (I-01: dual CTE intentional trade-off, I-02: RankingCard correctly unexported, I-03: better aria attrs than DashboardPanel, I-04: always-visible empty state intentional). Approved. |
