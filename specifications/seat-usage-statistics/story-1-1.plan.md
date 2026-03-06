# Story 1.1 — Display Usage Statistics Cards on the Seat Usage Page — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Display usage statistics cards on the seat usage page |
| Description | Add four summary cards (Average Usage, Median Usage, Minimum Usage, Maximum Usage) above the seat table on the `/usage` page so that administrators can quickly understand the overall usage distribution for the selected month. |
| Priority | High |
| Related Research | `specifications/seat-usage-statistics/extracted-tasks.md`, `specifications/seat-usage-statistics/quality-review.md` |

## Proposed Solution

Add a new dedicated API endpoint `GET /api/usage/seats/stats` that computes aggregate usage statistics server-side using PostgreSQL, and a new `SeatUsageStatsCards` client component that fetches and renders four summary cards above the existing seat table.

**Why a separate endpoint** (not extending `/api/usage/seats`):
- The existing seats endpoint is paginated and filterable by search — statistics must be global (unaffected by search or pagination).
- Aggregate functions (`AVG`, `PERCENTILE_CONT`, `MIN`, `MAX`) are computationally different from row-level data retrieval.
- Separation keeps both endpoints simple and independently cacheable.

**Data flow**:
1. The SQL query computes per-seat `grossQuantity` totals from the `copilot_usage` JSONB `usageItems` array.
2. Each seat's total is converted to a usage percentage: `totalRequests / premiumRequestsPerSeat * 100`.
3. PostgreSQL `AVG`, `PERCENTILE_CONT(0.5)`, `MIN`, `MAX` aggregate across all seats with usage data.
4. The component receives the four values and renders them in the dashboard card pattern.

```
┌──────────────────── Statistics Cards Grid ────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Average  │  │ Median   │  │ Minimum  │  │ Maximum  │     │
│  │ Usage    │  │ Usage    │  │ Usage    │  │ Usage    │     │
│  │          │  │          │  │          │  │          │     │
│  │  72%     │  │  68%     │  │  12%     │  │  145%    │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
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
    CASE WHEN $3 > 0
      THEN total_requests / $3 * 100
      ELSE 0
    END AS usage_percent
  FROM seat_requests
)
SELECT
  ROUND(AVG(usage_percent)::numeric, 1) AS "averageUsage",
  ROUND(
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usage_percent))::numeric,
    1
  ) AS "medianUsage",
  ROUND(MIN(usage_percent)::numeric, 1) AS "minUsage",
  ROUND(MAX(usage_percent)::numeric, 1) AS "maxUsage"
FROM seat_usage
```
- `$1` = month, `$2` = year, `$3` = `premiumRequestsPerSeat`
- Uses existing index `IDX_copilot_usage_year_month` on `(year, month)`
- `PERCENTILE_CONT(0.5)` is a standard PostgreSQL ordered-set aggregate for median
- Division-by-zero guarded via `CASE WHEN $3 > 0`
- When no seats have usage data, all aggregates return `NULL`

## Current Implementation Analysis

### Already Implemented
- `SeatUsagePanel` component — `src/components/usage/SeatUsagePanel.tsx` — Renders the seat usage tab with search, table, and pagination. Receives `month` and `year` as props. Integration point for the new cards.
- `SeatUsageTable` component — `src/components/usage/SeatUsageTable.tsx` — Renders per-seat rows with usage %, links to detail pages.
- `UsagePageLayout` component — `src/components/usage/UsagePageLayout.tsx` — Wraps the usage page with tab switching and month filter. Month changes propagate to `SeatUsagePanel` via props, triggering re-fetch.
- `useAsyncFetch` hook — `src/lib/hooks/useAsyncFetch.ts` — Generic data-fetching hook with loading/error/data states. Auto-refetches when URL changes. Will be reused for the new stats endpoint.
- `DashboardPanel` card pattern — `src/components/dashboard/DashboardPanel.tsx` (lines 157–235) — Four-card grid with `rounded-lg border border-gray-200 bg-white p-6 shadow-sm` styling: heading (`text-sm font-medium text-gray-500`) + large value (`text-3xl font-bold text-gray-900`). Source of the card design to replicate.
- `GET /api/usage/seats` endpoint — `src/app/api/usage/seats/route.ts` — Returns paginated per-seat data. Uses `requireAuth`, `getPremiumAllowance`, `handleRouteError`, and parameterised raw SQL. Pattern to follow for the new stats endpoint.
- `calcUsagePercent` helper — `src/lib/usage-helpers.ts` — `(totalRequests / premiumRequestsPerSeat) * 100` with division-by-zero guard. Defines the usage percentage formula replicated in SQL.
- `requireAuth` / `isAuthFailure` — `src/lib/api-auth.ts` — Authentication guard returning `AuthSuccess | NextResponse(401)`.
- `getPremiumAllowance` — `src/lib/get-premium-allowance.ts` — Reads `premiumRequestsPerSeat` from Configuration table (cached 60s, default 300).
- `handleRouteError` — `src/lib/api-helpers.ts` — Shared error handler for route `catch` blocks.
- `getDb` — `src/lib/db.ts` — Returns initialised TypeORM `DataSource` singleton.
- `CopilotUsage` entity — `src/entities/copilot-usage.entity.ts` — Table `copilot_usage` with JSONB `usageItems` column. Index on `(year, month)`.
- Test infrastructure — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource` for integration tests against a real PostgreSQL test database.
- Existing seat usage route tests — `src/app/api/usage/seats/__tests__/route.test.ts` — Reference pattern for auth mocking, seed helpers (`seedSeat`, `seedUsage`), and `NextRequest` construction.

### To Be Modified
- `src/components/usage/SeatUsagePanel.tsx` — Import and render the new `SeatUsageStatsCards` component at the top of the component's return JSX, before the search box. The stats cards use their own independent fetch and are unaffected by search or pagination state.

### To Be Created
- `src/app/api/usage/seats/stats/route.ts` — New API route returning aggregate usage stats (average, median, min, max usage %) for a given month/year.
- `src/components/usage/SeatUsageStatsCards.tsx` — New client component rendering four summary cards using data from the stats endpoint.
- `src/app/api/usage/seats/stats/__tests__/route.test.ts` — Integration tests for the stats endpoint.
- `src/components/usage/__tests__/SeatUsageStatsCards.test.ts` — Unit tests for the stats cards component.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should percentage values display fractional digits (e.g., "72.5%") or round to integer? | Round to nearest integer for display (e.g., "73%"). The percentage is a quick-glance metric and fractional precision is unnecessary. Consistent with how usage % is displayed in `SeatUsageTable` (`Math.round(rawPercent)`). | ✅ Resolved |
| 2 | When `premiumRequestsPerSeat` is 0, what should cards show? | Show "—" (same as no-data state). Zero allowance means usage percentage is undefined. | ✅ Resolved |
| 3 | Should the stats values carry a secondary label (e.g., "across 42 seats")? | No. Keep it simple — primary value only, matching the minimal card pattern. The story ACs specify "usage percentage as the primary value" with no mention of secondary detail. | ✅ Resolved |
| 4 | Do stats include only seats that have usage data, or all assigned seats (including zero-usage)? | Only seats with usage data, per Assumption #2 in extracted-tasks.md (medium confidence). The SQL query naturally excludes seats with no `copilot_usage` rows. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Statistics API Endpoint

#### Task 1.1 - [CREATE] `GET /api/usage/seats/stats` route
**Description**: Create a new Next.js API route at `src/app/api/usage/seats/stats/route.ts` that computes aggregate seat usage statistics (average, median, minimum, maximum usage percentages) for a given month/year. The endpoint follows the same authentication, parameter validation, and error handling patterns as the existing `GET /api/usage/seats` route.

The route:
1. Calls `requireAuth()` and returns 401 if unauthenticated.
2. Parses and validates `month` (1–12) and `year` (≥2020) from query params with sensible defaults.
3. Calls `getPremiumAllowance()` to get the per-seat allowance.
4. Executes a single parameterised SQL query with two CTEs:
   - `seat_requests`: aggregates `grossQuantity` from the JSONB `usageItems` array, grouped by seatId.
   - `seat_usage`: converts each seat's total requests to a usage percentage via the allowance.
   - Final `SELECT`: computes `AVG`, `PERCENTILE_CONT(0.5)` (median), `MIN`, `MAX` across all seats.
5. Returns JSON `{ averageUsage, medianUsage, minUsage, maxUsage, month, year }` — values are `number | null` (null when no usage data exists).
6. Wraps the body in try/catch, delegating to `handleRouteError` on failure.

**Definition of Done**:
- [x] File `src/app/api/usage/seats/stats/route.ts` exists and exports a `GET` function
- [x] Returns 401 when no valid session cookie is present
- [x] Accepts `month` and `year` query parameters with default-to-current-month fallback
- [x] Returns `{ averageUsage: null, medianUsage: null, minUsage: null, maxUsage: null, month, year }` when no usage data exists for the selected month
- [x] Returns correct numeric values (rounded to 1 decimal) when usage data exists
- [x] SQL uses parameterised queries (no string interpolation of user input)
- [x] Handles `premiumRequestsPerSeat === 0` gracefully (returns 0 for all percentages)
- [x] Uses `handleRouteError` in catch block for consistent error responses
- [x] TypeScript compilation passes with no new errors

#### Task 1.2 - [CREATE] Integration tests for the stats endpoint
**Description**: Create integration tests at `src/app/api/usage/seats/stats/__tests__/route.test.ts` following the exact patterns from the existing `src/app/api/usage/seats/__tests__/route.test.ts` — same mocking approach for `@/lib/db` and `next/headers`, same seed helpers, same test database lifecycle.

Test cases:
1. Returns 401 without a session cookie.
2. Returns null stats when no usage data exists for the month.
3. Returns correct aggregate stats for multiple seats with varying usage.
4. Defaults to current month/year when params are missing.
5. Correctly computes median for an even number of seats (interpolated).
6. Returns correct stats when only one seat has data (average = median = min = max).

**Definition of Done**:
- [x] File `src/app/api/usage/seats/stats/__tests__/route.test.ts` exists
- [x] All 7 test cases pass with `npx vitest run src/app/api/usage/seats/stats/__tests__/route.test.ts` (6 original + 1 zero-allowance added during code review)
- [x] Tests use real PostgreSQL test database (not mocked queries)
- [x] Tests follow existing patterns: `vi.mock("@/lib/db")`, `vi.mock("next/headers")`, `seedAuthSession()`, `seedSeat()`, `seedUsage()`
- [x] Each test seeds its own data after `cleanDatabase` in `beforeEach`

### Phase 2: Frontend — Statistics Cards Component

#### Task 2.1 - [CREATE] `SeatUsageStatsCards` component
**Description**: Create a new client component at `src/components/usage/SeatUsageStatsCards.tsx` that fetches and renders four summary cards for seat usage statistics.

The component:
1. Accepts `{ month: number; year: number }` props.
2. Uses `useAsyncFetch<SeatUsageStatsResponse>` with URL `/api/usage/seats/stats?month=${month}&year=${year}` — auto-refetches when month/year change.
3. Defines a local `SeatUsageStatsResponse` interface: `{ averageUsage: number | null; medianUsage: number | null; minUsage: number | null; maxUsage: number | null; month: number; year: number }`.
4. Renders a grid container: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`.
5. Each of the four cards:
   - Container: `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`
   - Heading: `text-sm font-medium text-gray-500` — "Average Usage", "Median Usage", "Minimum Usage", "Maximum Usage"
   - Value: `text-3xl font-bold text-gray-900` — shows `Math.round(value)%` or "—" when null
6. Loading state: renders four placeholder cards with "—" values and a `role="status"` message.
7. Error state: fails silently — renders the same "—" state (cards are supplementary, not blocking).

**Definition of Done**:
- [x] File `src/components/usage/SeatUsageStatsCards.tsx` exists and exports a default function component
- [x] Renders exactly four cards: Average Usage, Median Usage, Minimum Usage, Maximum Usage
- [x] Each card follows the DashboardPanel card design pattern (same spacing, typography, border, shadow)
- [x] Usage values displayed as rounded integer percentages (e.g., "72%")
- [x] When stats are null (no data), cards show "—" as the value
- [x] Component uses `useAsyncFetch` hook — cards update when month/year changes
- [x] Loading state shows "—" in each card while fetching
- [x] No dependency on search or pagination state from the parent

#### Task 2.2 - [MODIFY] Integrate stats cards into `SeatUsagePanel`
**Description**: Modify `src/components/usage/SeatUsagePanel.tsx` to import and render `SeatUsageStatsCards` above the search box. The stats cards are rendered unconditionally (not inside loading/error/empty conditionals) since they manage their own data fetching independently.

Changes:
1. Add import: `import SeatUsageStatsCards from "@/components/usage/SeatUsageStatsCards";`
2. In every return path (loading, error, empty, data), render `<SeatUsageStatsCards month={month} year={year} />` as the first child inside the wrapping `<div className="space-y-4">`.

**Definition of Done**:
- [x] `SeatUsageStatsCards` is rendered on the seat usage tab above the search box
- [x] Stats cards are visible in all states: loading, error, empty data, and populated data
- [x] Stats cards receive `month` and `year` from the parent (not from URL directly)
- [x] Stats cards are independent of search input and pagination
- [x] No visual or functional regressions to the existing seat table, search, or pagination
- [x] TypeScript compilation passes with no new errors

#### Task 2.3 - [CREATE] Unit tests for `SeatUsageStatsCards`
**Description**: Create unit tests at `src/components/usage/__tests__/SeatUsageStatsCards.test.ts` following existing component test patterns in the project. Since the project uses `vitest` with `environment: "node"` (no jsdom), tests should verify the module exports correctly and optionally test rendering logic via import assertions, consistent with existing component tests like `UsageStatusIndicator.test.ts`.

**Definition of Done**:
- [x] File `src/components/usage/__tests__/SeatUsageStatsCards.test.ts` exists
- [x] Tests verify the component exports a default function
- [x] All tests pass with `npx vitest run src/components/usage/__tests__/SeatUsageStatsCards.test.ts`

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Automated code review
**Description**: Run the `tsh-code-reviewer` agent against all files changed in this story to verify code quality, security, and adherence to project conventions.

**Definition of Done**:
- [x] All new and modified files reviewed by `tsh-code-reviewer`
- [x] No critical or high-severity findings remain unresolved
- [x] Code follows existing project patterns (auth, error handling, SQL parameterisation, card styling)

## Security Considerations

- **SQL Injection**: All query parameters (`month`, `year`) are parsed to integers before use. The SQL query uses parameterised placeholders (`$1`, `$2`, `$3`) — no string interpolation of user input.
- **Authentication**: The endpoint is protected by `requireAuth()`, consistent with all other usage endpoints. Unauthenticated requests receive a 401 response.
- **Data Exposure**: The endpoint returns only aggregate statistics (no per-seat data, no usernames, no PII). This is less sensitive than the existing paginated seats endpoint.
- **Denial of Service**: The query scans `copilot_usage` rows for a single month/year, bounded by the existing `IDX_copilot_usage_year_month` index. Performance is proportional to the number of seats with data (~hundreds at most), not unbounded.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Four summary cards are displayed above the seat table: Average Usage, Median Usage, Minimum Usage, and Maximum Usage
- [x] Each card shows the usage percentage as the primary value (e.g., "72%")
- [x] Usage percentage is calculated as total requests ÷ premium requests per seat allowance × 100 for each seat, then aggregated (average, median, min, max) across all seats with usage data in the selected month
- [x] The cards follow the existing summary card design pattern used on the dashboard (rounded border, shadow, heading + large value)
- [x] The cards update when the user changes the month filter
- [x] When no usage data exists for the selected month, the cards show a "—" or "No data" state
- [x] The statistics cards are not affected by the search filter — they always reflect global stats for the selected month
- [x] API route integration tests pass against real PostgreSQL
- [x] Component unit tests pass
- [x] TypeScript compilation (`npx tsc --noEmit`) passes with no new errors
- [x] `tsh-code-reviewer` review completes with no critical findings

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Trend indicators**: Compare current month statistics against the previous month (e.g., "↑ 5% vs last month"). Explicitly excluded per extracted-tasks.md.
- **Secondary detail on cards**: Show the number of seats included in the calculation (e.g., "across 42 seats"). Not required by acceptance criteria.
- **Client-side caching**: Cache stats response to avoid re-fetching when switching tabs and returning. `useAsyncFetch` currently refetches on every URL change.
- **Skeleton loading animation**: Replace static "—" loading state with animated pulse placeholders for smoother perceived performance.

## Changelog

| Date | Change Description |
|------|-------------------|
| 5 March 2026 | Initial plan created |
| 5 March 2026 | Implementation complete — all 3 phases done. Code review: 0 critical, 0 high, 1 medium (M1 — missing zero-allowance test, resolved), 2 low (L1 — aria-busy on loading grid, deferred; L2 — pre-existing ESLint warning, not from this change), 3 info. Added 7th integration test for zero-allowance edge case per M1 finding. All 39 tests passing, TypeScript clean. |
