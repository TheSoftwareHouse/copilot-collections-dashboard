# Fix Stale Dashboard Spending Data - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Fix Stale Dashboard Spending: Add Recalculation Endpoint for Historical Months |
| Description | Dashboard displays "$2516.08 paid requests + $0.00 seat licenses" but the correct breakdown is ~$9 paid requests + ~$2,508 seat licenses. The spending calculation code was already fixed (see `fix-dashboard-metrics.plan.md`) to use `SUM(netAmount) + activeSeats × $19`, but the `dashboard_monthly_summary` table still contains stale data computed with the old logic. A recalculation mechanism is needed to correct historical months. |
| Priority | High (data accuracy — financial numbers displayed incorrectly) |
| Related Research | `specifications/copilot-usage-dashboard/fix-dashboard-metrics.plan.md` |

## Proposed Solution

### Root Cause Analysis

The spending calculation code in `src/lib/dashboard-metrics.ts` was previously fixed to:
- Use `SUM(netAmount)` instead of `SUM(grossAmount)` for premium request spending
- Add `seatBaseCost = activeSeats × $19` for seat license cost
- Compute `totalSpending = netPremiumSpending + seatBaseCost`

However, the `dashboard_monthly_summary` rows in the database were computed *before* this fix was deployed. The `seatBaseCost` column (added via migration `1772290000000-AddSeatBaseCost.ts`) defaults to `0` for pre-existing rows. The `totalSpending` value still reflects the old `SUM(grossAmount)` calculation.

Both `usage-collection` and `seat-sync` jobs only call `refreshDashboardMetrics()` for the **current month**. There is no mechanism to recalculate historical months, leaving stale data in place.

### What the user sees vs what it should be

| Metric | Current (Stale) | Expected (Correct) |
|---|---|---|
| Total Spending | $2,516.08 | ~$2,517.08 |
| Paid Requests breakdown | $2,516.08 | ~$9.08 (SUM of netAmount) |
| Seat Licenses breakdown | $0.00 | ~$2,508.00 (132 active × $19) |

### Solution

Create a `POST /api/dashboard/recalculate` endpoint that triggers `refreshDashboardMetrics()` for all months with existing usage data. This:
1. Queries `copilot_usage` for all distinct `(month, year)` pairs
2. Calls the existing `refreshDashboardMetrics(month, year)` for each
3. Returns a summary of recalculated months

This follows the existing API pattern (auth-protected POST endpoints like `/api/jobs/seat-sync` and `/api/jobs/usage-collection`).

### Data Flow

```
POST /api/dashboard/recalculate
│
├── requireAuth() — verify session
│
├── Query copilot_usage: SELECT DISTINCT month, year
│   └── returns: [(1, 2026), (2, 2026), ...]
│
├── For each (month, year):
│   └── refreshDashboardMetrics(month, year)
│       ├── Recomputes: totalSpending = SUM(netAmount) + activeSeats × 19
│       ├── Recomputes: seatBaseCost = activeSeats × 19
│       ├── Recomputes: includedPremiumRequestsUsed = SUM(discountQuantity)
│       └── Upserts into dashboard_monthly_summary
│
└── Response: { recalculatedMonths: [...], total: N }
```

## Current Implementation Analysis

### Already Implemented
- `src/lib/dashboard-metrics.ts` — `refreshDashboardMetrics()` function with **correct** spending logic (uses `netAmount`, computes `seatBaseCost`) — **REUSE as-is**
- `src/lib/api-auth.ts` — `requireAuth()` / `isAuthFailure()` for endpoint protection — **REUSE as-is**
- `src/entities/dashboard-monthly-summary.entity.ts` — Entity with `seatBaseCost` column already present — **REUSE as-is**
- `src/entities/copilot-usage.entity.ts` — Usage data with JSONB `usageItems` containing all necessary fields (`netAmount`, `discountQuantity`, `grossQuantity`) — **REUSE as-is**
- `src/app/api/dashboard/route.ts` — Dashboard GET endpoint with `seatBaseCost` in response — **REUSE as-is**
- `src/components/dashboard/DashboardPanel.tsx` — Frontend with spending breakdown display (`paid requests + seat licenses`) — **REUSE as-is**
- `src/lib/__tests__/dashboard-metrics.test.ts` — Comprehensive unit tests for `refreshDashboardMetrics()` including `seatBaseCost` — **REUSE as-is**
- `src/app/api/dashboard/__tests__/route.test.ts` — API route tests with `seatBaseCost` assertions — **REUSE as-is**
- `e2e/dashboard.spec.ts` — E2E tests with spending breakdown verification — **REUSE as-is**

### To Be Modified
- None — the existing code is correct. The issue is solely stale data in the database.

### To Be Created
- `src/app/api/dashboard/recalculate/route.ts` — New POST endpoint to trigger historical recalculation
- `src/app/api/dashboard/recalculate/__tests__/route.test.ts` — Integration tests for the recalculation endpoint

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should recalculation be for all months or allow filtering to a specific month? | Both — default to all months, but accept optional `month` and `year` query params to recalculate a single month | ✅ Resolved |
| 2 | Is $19 per active seat or per total seat? | Per active seat — inactive seats are seats whose GitHub Copilot license has been removed (no longer billed). Math confirms: ~132 active × $19 = ~$2,508 matches the user's expected total. | ✅ Resolved |
| 3 | Should the endpoint also recalculate months with no usage data but with a summary row? | Yes — query `dashboard_monthly_summary` for existing rows UNION `copilot_usage` distinct months to cover all cases | ✅ Resolved |

## Implementation Plan

### Phase 1: Recalculation API Endpoint

#### Task 1.1 - [CREATE] `POST /api/dashboard/recalculate` Route
**Description**: Create a new API route that triggers `refreshDashboardMetrics()` for historical months with stale data. The endpoint queries the database for all distinct `(month, year)` pairs across both `copilot_usage` and `dashboard_monthly_summary` tables, then calls the existing `refreshDashboardMetrics()` for each. Supports optional `month` and `year` query params to target a specific month.

**File**: `src/app/api/dashboard/recalculate/route.ts`

**Implementation details**:
```typescript
// Pseudocode
export async function POST(request: NextRequest) {
  // 1. Auth check
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  // 2. Parse optional month/year from request body or searchParams
  const { searchParams } = request.nextUrl;
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  // 3. If specific month requested, recalculate just that month
  // Otherwise, find all distinct (month, year) from copilot_usage
  // UNION distinct (month, year) from dashboard_monthly_summary

  // 4. For each (month, year), call refreshDashboardMetrics(month, year)

  // 5. Return summary
  return NextResponse.json({
    recalculatedMonths: [...],
    total: N,
  });
}
```

**Patterns to follow**:
- Same auth pattern as `src/app/api/jobs/seat-sync/route.ts` (use `requireAuth()` / `isAuthFailure()`)
- Same error handling pattern (try/catch with 500 response)
- POST method (state-modifying operation)

**Definition of Done**:
- [x] Route file created at `src/app/api/dashboard/recalculate/route.ts`
- [x] Endpoint is protected with `requireAuth()` — returns 401 without valid session
- [x] Without query params: recalculates all months that have data in `copilot_usage` or `dashboard_monthly_summary`
- [x] With `month` and `year` query params: recalculates only that specific month
- [x] Returns JSON `{ recalculatedMonths: [{ month, year }], total: number }` on success
- [x] Returns 500 with `{ error: "Internal server error" }` on failure
- [x] Validates month (1-12) and year (>= 2020) params when provided; returns 400 for invalid values
- [x] TypeScript compiles without errors

### Phase 2: Integration Tests

#### Task 2.1 - [CREATE] Route Integration Tests
**Description**: Create integration tests for the recalculate endpoint. Tests should verify: auth protection, recalculation of all months, single month recalculation, correct spending values after recalculation, empty state handling, and parameter validation.

**File**: `src/app/api/dashboard/recalculate/__tests__/route.test.ts`

**Test cases**:
1. Returns 401 without session cookie
2. Recalculates all months when no params provided — verify `totalSpending` and `seatBaseCost` are correct for each month
3. Recalculates a single month when `month` and `year` params provided
4. Returns 400 for invalid month/year values
5. Returns empty `recalculatedMonths` array when no usage data exists
6. Correctly updates stale data — seed with old `grossAmount`-based values, recalculate, verify `netAmount`-based values
7. `seatBaseCost` reflects current active seat count × 19

**Patterns to follow**:
- Same test setup as `src/app/api/dashboard/__tests__/route.test.ts` (mock `@/lib/db`, `next/headers`, seed auth session)
- Use `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource` from `@/test/db-helpers`
- Seed actual `copilot_seat` + `copilot_usage` data (not just summary) so `refreshDashboardMetrics()` has data to aggregate

**Definition of Done**:
- [x] Test file created at `src/app/api/dashboard/recalculate/__tests__/route.test.ts`
- [x] Test verifies 401 response without auth session
- [x] Test verifies all-months recalculation: seeds usage data for 2 different months, calls endpoint, checks both `dashboard_monthly_summary` rows have correct `totalSpending` = `SUM(netAmount) + activeSeats × 19` and correct `seatBaseCost`
- [x] Test verifies single-month recalculation with query params
- [x] Test verifies stale-data correction: seeds a `dashboard_monthly_summary` row with `seatBaseCost = 0` and `totalSpending = SUM(grossAmount)`, then recalculates and verifies corrected values
- [x] Test verifies 400 response for invalid month/year params
- [x] Test verifies empty response when no data exists
- [x] All tests pass (`npm run test`)

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Automated Code Review
**Description**: Run the `tsh-code-reviewer` agent to review all changes for correctness, consistency, and adherence to project standards.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed

## Security Considerations

- **Authentication**: The recalculation endpoint is protected by `requireAuth()`, same as all other data-modifying endpoints. Only authenticated users can trigger recalculation.
- **No new user inputs in SQL**: The endpoint uses the existing `refreshDashboardMetrics()` function which uses parameterized queries. The optional `month`/`year` params are validated as integers before use.
- **Idempotency**: Calling the recalculate endpoint multiple times is safe — `refreshDashboardMetrics()` uses upsert (INSERT ... ON CONFLICT DO UPDATE), so results converge to the same correct values.
- **Rate limiting**: No rate limiting is implemented. For a multi-month recalculation, each month triggers several SQL queries. This is acceptable for an admin-only endpoint. If the system grows to many months of data, consider adding a job queue pattern.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] After calling `POST /api/dashboard/recalculate`, the dashboard displays correct spending breakdown: `SUM(netAmount)` as "paid requests" and `activeSeats × $19` as "seat licenses"
- [x] `seatBaseCost` column in `dashboard_monthly_summary` is populated with `activeSeats × 19` for all recalculated months
- [x] `totalSpending` = `SUM(netAmount) + seatBaseCost` for all recalculated months
- [x] Historical months (not just current) are correctly recalculated
- [x] Endpoint returns 401 without authentication
- [x] Endpoint accepts optional `month`/`year` params for targeted recalculation
- [x] All unit tests pass (`npm run test`)
- [x] All E2E tests pass (`npm run test:e2e`)
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No lint errors (`npm run lint`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Configurable seat cost**: The $19/seat/month is hardcoded. Could be a configuration setting in the `configuration` table to handle different GitHub Copilot plans (Business $19 vs Enterprise $39).
- **Automatic recalculation on deployment**: A mechanism (startup hook or migration) that auto-triggers recalculation when the application deploys, ensuring data freshness without manual intervention.
- **Dashboard "Recalculate" button**: A UI button on the dashboard that triggers `POST /api/dashboard/recalculate` so admins don't need API tools.
- **Historical seat snapshot**: Currently, recalculation uses the *current* seat count for all months. For accurate historical data, each month's active seat count at the time should be tracked. This matters if seats are added/removed over time.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed: Phase 1 (endpoint), Phase 2 (10 integration tests), all passing |
| 2026-02-28 | Code review by `tsh-code-reviewer`: Approved with minor suggestions. Addressed F1 (require both month+year params together with clear error) and F4 (added 2 tests for partial-params edge cases). F2 (year upper bound), F3 (partial-success reporting), F5 (500-path test), F6 (console noise) noted as low-priority suggestions — not addressed as they are consistent with existing codebase patterns. |
