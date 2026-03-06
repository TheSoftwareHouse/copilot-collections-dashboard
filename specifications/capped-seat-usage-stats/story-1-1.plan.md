# Capped Seat Usage Statistics (Story 1.1) - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 1.1 |
| Title | Admin sees capped average and median on seat usage statistics cards |
| Description | Modify the seat usage stats API to cap each seat's total requests at the included allowance before computing average and median, while keeping min and max uncapped |
| Priority | High |
| Related Research | [extracted-tasks.md](./extracted-tasks.md), [jira-tasks.md](./jira-tasks.md) |

## Proposed Solution

Modify the SQL query in the `GET /api/usage/seats/stats` endpoint to compute a **dual-column** `seat_usage` CTE — one column for uncapped usage percentage (used by MIN/MAX) and one for capped usage percentage (used by AVG/MEDIAN). The capping applies `LEAST(total_requests, premiumRequestsPerSeat)` before dividing by the allowance, consistent with the existing pattern in the team and department usage APIs.

```
┌────────────────────────────────────┐
│       seat_requests CTE            │
│  SUM(grossQuantity) per seatId     │
│  (unchanged)                       │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│       seat_usage CTE               │
│  usage_percent:                    │
│    total_requests / allowance * 100│  ← uncapped (for MIN, MAX)
│  capped_usage_percent:             │
│    LEAST(total, allow) / allow*100 │  ← capped  (for AVG, MEDIAN)
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│       Final SELECT                 │
│  AVG(capped_usage_percent)         │
│  PERCENTILE_CONT(capped_...)       │
│  MIN(usage_percent)                │
│  MAX(usage_percent)                │
└────────────────────────────────────┘
```

**Key design decisions:**
- Single CTE with two columns rather than two separate CTEs — one data scan, simpler SQL.
- `LEAST(total_requests, $3)` is the capping function — consistent with `src/app/api/usage/teams/route.ts` (line 60) and `src/app/api/usage/departments/route.ts` (line 60).
- No frontend changes — `SeatUsageStatsCards` renders whatever the API returns; the response shape is unchanged.
- No database schema or migration changes.

## Current Implementation Analysis

### Already Implemented
- `SeatUsageStatsCards` component — `src/components/usage/SeatUsageStatsCards.tsx` — renders 4 stat cards from API response, displays `Math.round(value)%` or "—". No changes needed.
- `getPremiumAllowance()` — `src/lib/get-premium-allowance.ts` — returns the configured `premiumRequestsPerSeat` with in-memory cache. No changes needed.
- `handleRouteError()` — `src/lib/api-helpers.ts` — unified error handler. No changes needed.
- `requireAuth()` / `isAuthFailure()` — `src/lib/api-auth.ts` — authentication guard. No changes needed.
- Test infrastructure — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`. No changes needed.
- `LEAST` capping pattern — already used in `src/app/api/usage/teams/route.ts` and `src/app/api/usage/departments/route.ts`. To be replicated.

### To Be Modified
- **Stats endpoint SQL** — `src/app/api/usage/seats/stats/route.ts` — the `seat_usage` CTE must add a `capped_usage_percent` column; the final SELECT must use it for AVG and PERCENTILE_CONT while keeping MIN/MAX on the uncapped column.
- **"Even seats" test** — `src/app/api/usage/seats/stats/__tests__/route.test.ts` — seat4 has 450 requests (150% uncapped). After capping, its contribution to average/median changes. The test currently only asserts median (75.0 — unchanged by coincidence), but should also assert average (old: 80.0, new: 67.5) to validate capping.

### To Be Created
- **New test case** — "caps average and median for seats exceeding allowance while keeping min/max uncapped" — dedicated overage scenario with clear expected values that prove the capping logic.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should min/max remain uncapped? | Yes — confirmed in extracted-tasks.md acceptance criteria | ✅ Resolved |
| 2 | Is the allowance always `premiumRequestsPerSeat`? | Yes — same source used by teams/departments | ✅ Resolved |
| 3 | Are frontend changes needed? | No — the component renders whatever the API returns | ✅ Resolved |

## Implementation Plan

### Phase 1: Modify the seat stats SQL query

#### Task 1.1 - [MODIFY] Cap average and median in the seat_usage CTE
**Description**: Update the SQL query in `src/app/api/usage/seats/stats/route.ts` to add a `capped_usage_percent` column to the `seat_usage` CTE using `LEAST(total_requests, $3) / $3 * 100`, and change `AVG` and `PERCENTILE_CONT` to use this capped column while keeping `MIN` and `MAX` on the existing uncapped `usage_percent`.

The `seat_usage` CTE changes from:

```sql
seat_usage AS (
  SELECT
    CASE WHEN $3 > 0
      THEN total_requests / $3 * 100
      ELSE 0
    END AS usage_percent
  FROM seat_requests
)
```

To:

```sql
seat_usage AS (
  SELECT
    CASE WHEN $3 > 0
      THEN total_requests / $3 * 100
      ELSE 0
    END AS usage_percent,
    CASE WHEN $3 > 0
      THEN LEAST(total_requests, $3) / $3 * 100
      ELSE 0
    END AS capped_usage_percent
  FROM seat_requests
)
```

And the final SELECT changes:
- `AVG(usage_percent)` → `AVG(capped_usage_percent)`
- `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usage_percent)` → `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY capped_usage_percent)`
- `MIN(usage_percent)` and `MAX(usage_percent)` remain unchanged.

**Definition of Done**:
- [ ] `seat_usage` CTE has two columns: `usage_percent` (uncapped) and `capped_usage_percent` (capped via `LEAST`)
- [ ] `averageUsage` is computed from `AVG(capped_usage_percent)`
- [ ] `medianUsage` is computed from `PERCENTILE_CONT(0.5) ... ORDER BY capped_usage_percent`
- [ ] `minUsage` is computed from `MIN(usage_percent)` (uncapped — unchanged)
- [ ] `maxUsage` is computed from `MAX(usage_percent)` (uncapped — unchanged)
- [ ] Response shape (`averageUsage`, `medianUsage`, `minUsage`, `maxUsage`, `month`, `year`) is unchanged
- [ ] No new imports or dependencies are added
- [ ] `npm run typecheck` passes with no errors

### Phase 2: Update and add test cases

#### Task 2.1 - [MODIFY] Update "even seats" test to assert capped average
**Description**: The existing test `"correctly computes median for an even number of seats"` in `src/app/api/usage/seats/stats/__tests__/route.test.ts` seeds seat4 with 450 requests (150% uncapped → capped to 100%). The test currently only asserts median. Add an `averageUsage` assertion that validates the capped calculation. The old uncapped average would be `(100 + 50 + 20 + 150) / 4 = 80.0`; the new capped average is `(100 + 50 + 20 + 100) / 4 = 67.5`. The median remains 75.0 (coincidence: sorted capped [20, 50, 100, 100] → (50+100)/2 = 75.0).

**Definition of Done**:
- [ ] Test asserts `averageUsage` ≈ 67.5 (capped average)
- [ ] Test continues to assert `medianUsage` ≈ 75.0
- [ ] Test passes with `npx vitest run src/app/api/usage/seats/stats/__tests__/route.test.ts`

#### Task 2.2 - [CREATE] Add test for capped average/median with uncapped min/max
**Description**: Add a new test case `"caps average and median for seats exceeding allowance while keeping min/max uncapped"` that seeds a clear overage scenario and verifies all four statistics behave correctly:
- Seat A: 600 requests (200% uncapped → capped to 100%)
- Seat B: 150 requests (50% both uncapped and capped)
- Expected: `averageUsage` = 75.0 (not 125.0), `medianUsage` = 75.0 (not 125.0), `minUsage` = 50.0 (uncapped), `maxUsage` = 200.0 (uncapped)

This test is the primary validation that capping works correctly — the uncapped average would be 125.0 while the capped average is 75.0, and maxUsage reflects the real 200% overage.

**Definition of Done**:
- [ ] Test seeds two seats: one at 200% uncapped usage, one at 50%
- [ ] Test asserts `averageUsage` ≈ 75.0 (proves capping works — uncapped would be 125.0)
- [ ] Test asserts `medianUsage` ≈ 75.0 (proves capping works)
- [ ] Test asserts `minUsage` ≈ 50.0 (proves min remains uncapped)
- [ ] Test asserts `maxUsage` ≈ 200.0 (proves max remains uncapped — shows full overage)
- [ ] Test passes with `npx vitest run src/app/api/usage/seats/stats/__tests__/route.test.ts`

### Phase 3: Verification

#### Task 3.1 - [REUSE] Run full test suite and quality gates
**Description**: Run the complete test file and all quality gates to confirm nothing is broken.

**Definition of Done**:
- [ ] `npx vitest run src/app/api/usage/seats/stats/__tests__/route.test.ts` — all tests pass (including existing unmodified tests for auth, no-data, default month/year, single seat, zero allowance)
- [ ] `npm run typecheck` — no type errors
- [ ] `npm run lint` — no lint errors

### Phase 4: Code review

#### Task 4.1 - [REUSE] Code review by tsh-code-reviewer
**Description**: Submit the changes for code review using the `tsh-code-reviewer` agent to validate code quality, consistency with project patterns, and adherence to acceptance criteria.

**Definition of Done**:
- [ ] Code review completed by `tsh-code-reviewer` agent
- [ ] All review findings addressed

## Security Considerations

- No new user input is introduced — the endpoint continues to accept only `month` and `year` query parameters with existing validation (range checks, integer parsing).
- No new SQL parameters — the same `$3` (`premiumRequestsPerSeat`) is used; `LEAST` is a built-in PostgreSQL function applied to already-bound parameters, introducing no injection risk.
- Authentication/authorization unchanged — `requireAuth()` guard remains in place.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Average Usage is calculated by capping each seat's total requests at the included allowance before averaging
- [ ] Median Usage is calculated by capping each seat's total requests at the included allowance before computing the median
- [ ] Minimum Usage continues to use uncapped total requests (unchanged behaviour)
- [ ] Maximum Usage continues to use uncapped total requests (unchanged behaviour)
- [ ] A seat whose total requests exceed the included allowance contributes a usage of exactly 100% to the average and median calculations
- [ ] The capping approach is consistent with the existing capped usage calculation used for teams and departments (`LEAST(total_requests, allowance)`)
- [ ] Existing tests are updated to validate the capped calculation behaviour for average and median
- [ ] When no usage data exists for the selected month, the cards continue to show "—"

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- The seat detail page (`/api/usage/seats/[seatId]`) still shows uncapped usage percentages. A future story could add capped display there if needed.
- The rankings endpoint (`/api/usage/seats/rankings`) uses uncapped percentages. Depending on business requirements, capping could be applied there as well.
- The `SeatUsageStatsCards` component could be enhanced to show a tooltip explaining that average/median are capped while min/max show full range, improving administrator understanding.

## Changelog

| Date | Change Description |
|------|-------------------|
| 5 March 2026 | Initial plan created |
