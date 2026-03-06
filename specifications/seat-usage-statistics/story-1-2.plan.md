# Story 1.2 — Display Top 5 Most Active Seats on the Seat Usage Page — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Display top 5 most active seats on the seat usage page |
| Description | Add a "Most Active Seats" ranked list showing the top 5 seats by usage percentage above the seat table on the `/usage` page so that administrators can quickly identify the heaviest Copilot users for the selected month. |
| Priority | High |
| Related Research | `specifications/seat-usage-statistics/extracted-tasks.md`, `specifications/seat-usage-statistics/quality-review.md` |

## Proposed Solution

Add a new dedicated API endpoint `GET /api/usage/seats/rankings` that computes per-seat usage percentages and returns the top 5 seats ranked by usage, and a new `SeatUsageRankings` client component that fetches and renders a ranked list card above the existing seat table.

**Why a separate endpoint** (not extending `/api/usage/seats` or `/api/usage/seats/stats`):
- The existing `/api/usage/seats` endpoint is paginated and filterable by search — rankings must be global (unaffected by search or pagination).
- The `/api/usage/seats/stats` endpoint returns aggregate statistics (AVG, median, min, max) — rankings return per-seat data with display information. Different data shape, different SQL.
- Separation keeps each endpoint single-purpose and independently testable.

**Data flow**:
1. The SQL query computes per-seat `grossQuantity` totals from the `copilot_usage` JSONB `usageItems` array (same CTE pattern as `/api/usage/seats/stats`).
2. Each seat's total is converted to a usage percentage: `totalRequests / premiumRequestsPerSeat * 100`.
3. Results JOIN `copilot_seat` for display information (username, name).
4. `ORDER BY usage_percent DESC, total_requests DESC LIMIT 5` returns the top 5.
5. The component renders each entry as a clickable list item linking to the seat detail page.

**Component layout**:
```
┌──────────────────── Statistics Cards Grid ────────────────────┐
│  (existing from Story 1.1)                                    │
├──────────────────── Most Active Seats ────────────────────────┐
│  Most Active Seats                                            │
│  ─────────────────────────────────────────────────────────── │
│  ● user-a          Alice Adams            120% · 360 requests │
│  ─────────────────────────────────────────────────────────── │
│  ● user-b          Bob Baker               95% · 285 requests │
│  ─────────────────────────────────────────────────────────── │
│  ● user-c          Charlie Chen            72% · 216 requests │
│  ─────────────────────────────────────────────────────────── │
│  ● user-d          Diana Davis             65% · 195 requests │
│  ─────────────────────────────────────────────────────────── │
│  ● user-e          Eve Edwards             50% · 150 requests │
├──────────────────────────────────────────────────────────────┤
│  [Search box ...]                                            │
├──────────────────────────────────────────────────────────────┤
│  Seat Usage Table (existing, unchanged)                      │
└──────────────────────────────────────────────────────────────┘
```

**SQL query design**:
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
ORDER BY su.usage_percent DESC, su.total_requests DESC
LIMIT 5
```
- `$1` = month, `$2` = year, `$3` = `premiumRequestsPerSeat`
- Uses existing index `IDX_copilot_usage_year_month` on `(year, month)`
- JOIN with `copilot_seat` to get username and display name
- Secondary sort by `total_requests DESC` as tiebreaker when percentages are equal
- Division-by-zero guarded via `CASE WHEN $3 > 0`
- `LIMIT 5` bounds the result set

## Current Implementation Analysis

### Already Implemented
- `SeatUsageStatsCards` component — `src/components/usage/SeatUsageStatsCards.tsx` — Story 1.1. Client component fetching `/api/usage/seats/stats` with `useAsyncFetch`, rendering cards in a grid. **Pattern to replicate** for the fetch + loading + empty state flow.
- `GET /api/usage/seats/stats` route — `src/app/api/usage/seats/stats/route.ts` — Story 1.1. Uses the same CTE pattern (`seat_requests` → `seat_usage`) for aggregating usage from JSONB. **SQL CTE pattern to reuse**.
- `SeatUsagePanel` component — `src/components/usage/SeatUsagePanel.tsx` — Already modified in story 1.1 to render `SeatUsageStatsCards` above the search box. Integration point for the new rankings component.
- `DashboardPanel` "Most Active Users" section — `src/components/dashboard/DashboardPanel.tsx` (lines 334–391) — **Visual pattern to replicate**. Uses `rounded-lg border border-gray-200 bg-white shadow-sm` container, `border-b` header, `<ul className="divide-y divide-gray-100">` list, and flexbox `<li>` items with left (icon + name) and right (metrics) content.
- `UsageStatusIndicator` component — `src/components/usage/UsageStatusIndicator.tsx` — Coloured dot indicating usage level (green/orange/red). Reused in both `SeatUsageTable` and `DashboardPanel`. Will be reused in rankings entries.
- `useAsyncFetch` hook — `src/lib/hooks/useAsyncFetch.ts` — Generic data-fetching hook with loading/error/data states. Auto-refetches when URL changes. Reused by `SeatUsageStatsCards`, will be reused for the new rankings component.
- `calcUsagePercent` helper — `src/lib/usage-helpers.ts` — `(totalRequests / premiumRequestsPerSeat) * 100` with division-by-zero guard. Used in the component to compute the percent for `UsageStatusIndicator`.
- `formatName` helper — `src/lib/format-helpers.ts` — Formats `firstName`/`lastName` into display name with "—" fallback.
- `requireAuth` / `isAuthFailure` — `src/lib/api-auth.ts` — Authentication guard.
- `getPremiumAllowance` — `src/lib/get-premium-allowance.ts` — Reads `premiumRequestsPerSeat` from Configuration table (cached 60s, default 300).
- `handleRouteError` — `src/lib/api-helpers.ts` — Shared error handler for route `catch` blocks.
- `getDb` — `src/lib/db.ts` — Returns initialised TypeORM `DataSource` singleton.
- `CopilotSeat` entity — `src/entities/copilot-seat.entity.ts` — Table `copilot_seat` with `githubUsername`, `firstName`, `lastName` columns.
- `CopilotUsage` entity — `src/entities/copilot-usage.entity.ts` — Table `copilot_usage` with JSONB `usageItems` column. Index on `(year, month)`.
- Test infrastructure — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`.
- Existing seat stats route tests — `src/app/api/usage/seats/stats/__tests__/route.test.ts` — Reference pattern for auth mocking, seed helpers, and assertions.
- `Link` from `next/link` — Used in `SeatUsageTable` for navigation to `/usage/seats/${seatId}?month=${month}&year=${year}`.

### To Be Modified
- `src/components/usage/SeatUsagePanel.tsx` — Import and render the new `SeatUsageRankings` component after `SeatUsageStatsCards` and before the search box, in all four return paths.

### To Be Created
- `src/app/api/usage/seats/rankings/route.ts` — New API route returning ranked seat usage data (top 5 most active) for a given month/year.
- `src/components/usage/SeatUsageRankings.tsx` — New client component rendering a ranked list card with clickable entries linking to seat detail pages.
- `src/app/api/usage/seats/rankings/__tests__/route.test.ts` — Integration tests for the rankings endpoint.
- `src/components/usage/__tests__/SeatUsageRankings.test.ts` — Unit tests for the rankings component.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the usage value display as percentage, raw requests, or both? | Both. Usage percentage as the primary right-aligned value (e.g., "120%"), total requests as a secondary detail (e.g., "360 requests"). This mirrors the DashboardPanel "Most Active Users" pattern (which shows "X requests" + spending) and provides more context than percentage alone. | ✅ Resolved |
| 2 | Should ranking entries include the `UsageStatusIndicator` (coloured dot)? | Yes. The DashboardPanel's "Most Active Users" list uses it, and the `SeatUsageTable` uses it. Including it maintains visual consistency across the page. | ✅ Resolved |
| 3 | When `premiumRequestsPerSeat` is 0, what should rankings show? | Entries still appear (seats with requests are ranked), but usage percentage shows as "0%" for all. The SQL `CASE WHEN $3 > 0` guard handles this. Total requests are still informative. | ✅ Resolved |
| 4 | Should the rankings section be full-width or part of a two-column grid (anticipating story 1.3)? | Full-width for story 1.2. Story 1.3 will restructure into a two-column grid when "Least Active Seats" is added. Per plan guidelines: "Focus ONLY on changes specific to THIS task." | ✅ Resolved |
| 5 | What is the tiebreaker when two seats have the same usage percentage? | Total requests descending. The SQL `ORDER BY usage_percent DESC, total_requests DESC` ensures deterministic ordering even with equal percentages. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Rankings API Endpoint

#### Task 1.1 - [CREATE] `GET /api/usage/seats/rankings` route
**Description**: Create a new Next.js API route at `src/app/api/usage/seats/rankings/route.ts` that computes per-seat usage percentages and returns the top 5 seats ranked by usage for a given month/year. The endpoint follows the same authentication, parameter validation, error handling, and SQL CTE patterns as the existing `GET /api/usage/seats/stats` route.

The route:
1. Calls `requireAuth()` and returns 401 if unauthenticated.
2. Parses and validates `month` (1–12) and `year` (≥2020) from query params with sensible defaults.
3. Calls `getPremiumAllowance()` to get the per-seat allowance.
4. Executes a single parameterised SQL query with two CTEs:
   - `seat_requests`: aggregates `grossQuantity` from the JSONB `usageItems` array, grouped by seatId.
   - `seat_usage`: converts each seat's total requests to a usage percentage via the allowance.
   - Final `SELECT`: JOINs `copilot_seat` for display info, orders by `usage_percent DESC, total_requests DESC`, LIMIT 5.
5. Returns JSON `{ mostActive: SeatRankingEntry[], month, year }` where each entry has `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `usagePercent`.
6. When no usage data exists, returns `{ mostActive: [], month, year }`.
7. Wraps the body in try/catch, delegating to `handleRouteError` on failure.

**Definition of Done**:
- [x] File `src/app/api/usage/seats/rankings/route.ts` exists and exports a `GET` function
- [x] Returns 401 when no valid session cookie is present
- [x] Accepts `month` and `year` query parameters with default-to-current-month fallback
- [x] Returns `{ mostActive: [], month, year }` when no usage data exists for the selected month
- [x] Returns at most 5 entries ordered by `usagePercent` descending
- [x] Each entry includes `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, `usagePercent`
- [x] SQL uses parameterised queries (no string interpolation of user input)
- [x] Handles `premiumRequestsPerSeat === 0` gracefully (usage percent is 0, entries still returned)
- [x] Uses `handleRouteError` in catch block for consistent error responses
- [x] TypeScript compilation passes with no new errors

#### Task 1.2 - [CREATE] Integration tests for the rankings endpoint
**Description**: Create integration tests at `src/app/api/usage/seats/rankings/__tests__/route.test.ts` following the exact patterns from the existing `src/app/api/usage/seats/stats/__tests__/route.test.ts` — same mocking approach for `@/lib/db`, `next/headers`, and `@/lib/get-premium-allowance`, same seed helpers, same test database lifecycle.

Test cases:
1. Returns 401 without a session cookie.
2. Returns empty `mostActive` array when no usage data exists for the month.
3. Returns top 5 seats ordered by usage percentage descending with correct display info.
4. Defaults to current month/year when params are missing.
5. Returns fewer than 5 entries when fewer seats have data (e.g., 2 seats → 2 entries).
6. Returns at most 5 entries when more than 5 seats have data.
7. Handles `premiumRequestsPerSeat === 0` (all entries have `usagePercent: 0`, still ordered by `totalRequests`).

**Definition of Done**:
- [x] File `src/app/api/usage/seats/rankings/__tests__/route.test.ts` exists
- [x] All 7 test cases pass with `npx vitest run src/app/api/usage/seats/rankings/__tests__/route.test.ts`
- [x] Tests use real PostgreSQL test database (not mocked queries)
- [x] Tests follow existing patterns: `vi.mock("@/lib/db")`, `vi.mock("next/headers")`, `vi.mock("@/lib/get-premium-allowance")`, `seedAuthSession()`, `seedSeat()`, `seedUsage()`
- [x] Each test seeds its own data after `cleanDatabase` in `beforeEach`

### Phase 2: Frontend — Rankings Component + Integration

#### Task 2.1 - [CREATE] `SeatUsageRankings` component
**Description**: Create a new client component at `src/components/usage/SeatUsageRankings.tsx` that fetches and renders a "Most Active Seats" ranked list card.

The component:
1. Accepts `{ month: number; year: number }` props.
2. Uses `useAsyncFetch<SeatRankingsResponse>` with URL `/api/usage/seats/rankings?month=${month}&year=${year}` — auto-refetches when month/year change.
3. Defines local interfaces for `SeatRankingEntry` and `SeatRankingsResponse`.
4. Renders a list card replicating the `DashboardPanel` "Most Active Users" visual pattern:
   - Container: `rounded-lg border border-gray-200 bg-white shadow-sm`
   - Header: `border-b border-gray-200 px-6 py-4` with `text-lg font-semibold text-gray-900` heading "Most Active Seats"
   - List: `<ul className="divide-y divide-gray-100">`
   - Each `<li>`: wrapped in a `<Link href="/usage/seats/${seatId}?month=${month}&year=${year}">`, flex layout with:
     - Left: `UsageStatusIndicator` + `githubUsername` (primary, `text-sm font-medium text-gray-900`) + display name (secondary, `text-xs text-gray-500`)
     - Right: usage percent (`text-sm font-medium text-gray-700`, e.g. "120%") + total requests (`text-xs text-gray-500`, e.g. "360 requests")
5. Loading state: renders the card container with header and a loading message. `aria-busy` on the list container.
6. Empty state (no data or empty `mostActive` array): renders the card with a "No usage data for this month" message.

**Definition of Done**:
- [x] File `src/components/usage/SeatUsageRankings.tsx` exists and exports a default function component
- [x] Renders a "Most Active Seats" card with up to 5 ranked entries
- [x] Each entry follows the DashboardPanel "Most Active Users" list item design (icon + name + metrics)
- [x] Each entry is a clickable `Link` navigating to `/usage/seats/${seatId}?month=${month}&year=${year}`
- [x] Entry shows `UsageStatusIndicator`, `githubUsername`, display name (via `formatName`), usage percent, and total requests
- [x] Component uses `useAsyncFetch` hook — rankings update when month/year changes
- [x] Loading state shows card with header and loading placeholder
- [x] Empty state shows "No usage data for this month" message inside the card
- [x] No dependency on search or pagination state from the parent

#### Task 2.2 - [MODIFY] Integrate rankings into `SeatUsagePanel`
**Description**: Modify `src/components/usage/SeatUsagePanel.tsx` to import and render `SeatUsageRankings` after `SeatUsageStatsCards` and before the search box. The rankings component is rendered unconditionally (not inside loading/error/empty conditionals) since it manages its own data fetching independently.

Changes:
1. Add import: `import SeatUsageRankings from "@/components/usage/SeatUsageRankings";`
2. In every return path (loading, error, empty, data), render `<SeatUsageRankings month={month} year={year} />` after `<SeatUsageStatsCards>` and before `{searchBox}`.

**Definition of Done**:
- [x] `SeatUsageRankings` is rendered on the seat usage tab between the stats cards and the search box
- [x] Rankings are visible in all states: loading, error, empty data, and populated data
- [x] Rankings receive `month` and `year` from the parent (not from URL directly)
- [x] Rankings are independent of search input and pagination
- [x] No visual or functional regressions to the existing stats cards, seat table, search, or pagination
- [x] TypeScript compilation passes with no new errors

#### Task 2.3 - [CREATE] Unit tests for `SeatUsageRankings`
**Description**: Create unit tests at `src/components/usage/__tests__/SeatUsageRankings.test.ts` following existing component test patterns in the project. Since the project uses `vitest` with `environment: "node"` (no jsdom), tests verify the module exports correctly, consistent with existing component tests like `SeatUsageStatsCards.test.ts`.

**Definition of Done**:
- [x] File `src/components/usage/__tests__/SeatUsageRankings.test.ts` exists
- [x] Tests verify the component exports a default function
- [x] All tests pass with `npx vitest run src/components/usage/__tests__/SeatUsageRankings.test.ts`

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Automated code review
**Description**: Run the `tsh-code-reviewer` agent against all files changed in this story to verify code quality, security, and adherence to project conventions.

**Definition of Done**:
- [x] All new and modified files reviewed by `tsh-code-reviewer`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows existing project patterns (auth, error handling, SQL parameterisation, list card styling, navigation links)

## Security Considerations

- **SQL Injection**: All query parameters (`month`, `year`) are parsed to integers before use. The SQL query uses parameterised placeholders (`$1`, `$2`, `$3`) — no string interpolation of user input. `LIMIT 5` is a literal, not a parameter.
- **Authentication**: The endpoint is protected by `requireAuth()`, consistent with all other usage endpoints. Unauthenticated requests receive a 401 response.
- **Data Exposure**: The endpoint returns only `seatId`, `githubUsername`, `firstName`, `lastName`, `totalRequests`, and `usagePercent` — the same data already visible in the existing paginated seat table. No additional PII is exposed.
- **Denial of Service**: The query scans `copilot_usage` rows for a single month/year (bounded by `IDX_copilot_usage_year_month` index) and JOINs `copilot_seat` (bounded by the number of seats). `LIMIT 5` caps the result set.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A "Most Active Seats" section is displayed on the seat usage page showing the top 5 seats by usage
- [x] Each entry shows the seat's GitHub username and their usage value (usage percentage)
- [x] The list is ordered from highest to lowest usage
- [x] Each entry shows the member's display name alongside the GitHub username
- [x] Each entry is clickable and navigates to the individual seat detail page
- [x] The section updates when the user changes the month filter
- [x] When fewer than 5 seats have usage data, only the available seats are shown
- [x] When no usage data exists for the selected month, the section shows an appropriate empty state
- [x] API route integration tests pass against real PostgreSQL
- [x] Component unit tests pass
- [x] TypeScript compilation (`npx tsc --noEmit`) passes with no new errors
- [x] `tsh-code-reviewer` review completes with no critical findings

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Two-column grid layout**: When story 1.3 ("Least Active Seats") is implemented, restructure the rankings section into a `grid grid-cols-1 lg:grid-cols-2` layout showing most active and least active side-by-side (matching the DashboardPanel pattern).
- **Configurable limit**: Allow administrators to configure the number of ranked seats (currently fixed at 5). Explicitly excluded per extracted-tasks.md.
- **Shared SQL CTE**: Stories 1.1 and 1.2 use the same `seat_requests` CTE. A database view or shared SQL builder could deduplicate this, but separate queries are simpler and independently maintainable.
- **Department column in rankings**: Show the department alongside username and display name. Not in the acceptance criteria but could be useful for large organisations.

## Changelog

| Date | Change Description |
|------|-------------------|
| 5 March 2026 | Initial plan created |
| 5 March 2026 | Implementation complete — all 3 phases done. 48 tests pass (8 files), TypeScript clean. Code review: 0 critical, 0 high, 1 medium (M1 — tiebreaker ordering test, fixed). |
