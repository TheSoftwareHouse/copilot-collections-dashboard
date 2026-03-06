# Fix Dashboard Metrics Calculations - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Fix Dashboard Metrics: Incorrect Spending, Premium Request & User Activity Calculations |
| Description | Dashboard metrics use `grossAmount` for spending and a flawed cap-at-300 approach for included premium requests. The correct interpretation of the GitHub API data requires using `netAmount` for paid spending, `discountQuantity` for non-paid requests, and `grossQuantity` for usage ranking. Additionally, total spending must include the $19/active seat/month base Copilot license fee. |
| Priority | High (data accuracy bug) |
| Related Research | N/A (bug fix based on GitHub API spec analysis) |

## Proposed Solution

The GitHub Copilot premium request usage API returns per-item breakdowns with three tiers:

| Field | Meaning |
|---|---|
| `grossQuantity` / `grossAmount` | Total usage value (before discounts) |
| `discountQuantity` / `discountAmount` | Non-paid (included allowance) portion |
| `netQuantity` / `netAmount` | Actually paid portion (gross − discount) |

The current implementation incorrectly uses `grossAmount` everywhere for spending and cost metrics, and approximates included premium requests with a cap-at-300 heuristic instead of using the actual `discountQuantity` from the API.

### Root Cause Summary

| # | Bug | Current (Wrong) | Expected (Correct) |
|---|---|---|---|
| 1 | Total Spending | `SUM(grossAmount)` | `SUM(netAmount) + (activeSeats × $19)` |
| 2 | Model Usage "Total Cost" | `SUM(grossAmount)` per model | `SUM(netAmount)` per model |
| 3 | Most/Least Active Users | Ranked by `SUM(grossAmount)`, shown as currency | Ranked by `SUM(grossQuantity)`, shown as request count |
| 4 | Included Premium Requests Used | Per-user `SUM(grossQuantity)` capped at 300 | `SUM(discountQuantity)` (actual API-reported discount) |
| 5 | Paid Premium Requests | `totalPremiumRequests − includedPremiumRequestsUsed` (derived) | Correctly derived once bug #4 is fixed (mathematically equivalent to `SUM(netQuantity)`) |

### Data Flow Diagram

```
GitHub API Response (per user, per day)
├── usageItems[] (JSONB stored in copilot_usage table)
│   ├── grossQuantity / grossAmount    → total usage
│   ├── discountQuantity / discountAmount → free/included portion
│   └── netQuantity / netAmount        → paid portion
│
└── refreshDashboardMetrics() aggregates into dashboard_monthly_summary
    ├── totalSpending       = SUM(netAmount) + activeSeats × 19  [BUG #1: was SUM(grossAmount)]
    ├── modelUsage[].totalAmount = SUM(netAmount) per model     [BUG #2: was SUM(grossAmount)]
    ├── mostActiveUsers     = TOP 5 by SUM(grossQuantity)        [BUG #3: was by SUM(grossAmount)]
    ├── leastActiveUsers    = BOTTOM 5 by SUM(grossQuantity)     [BUG #3: was by SUM(grossAmount)]
    ├── totalPremiumRequests = SUM(grossQuantity)                 [OK - no change]
    └── includedPremiumRequestsUsed = SUM(discountQuantity)      [BUG #4: was capped grossQuantity]
```

## Current Implementation Analysis

### Already Implemented
- `src/entities/copilot-usage.entity.ts` — `UsageItem` interface already includes all fields (`grossQuantity`, `grossAmount`, `discountQuantity`, `discountAmount`, `netQuantity`, `netAmount`) — **REUSE as-is**
- `src/lib/github-api.ts` — `GitHubUsageItem` interface already includes all fields — **REUSE as-is**
- `src/lib/usage-collection.ts` — Stores raw `usageItems` JSONB from API — **REUSE as-is** (data is correctly stored; the bug is only in aggregation)
- `src/app/api/dashboard/route.ts` — API route deriving `paidPremiumRequests` from stored summary — **needs modification**
- `src/components/dashboard/DashboardPanel.tsx` — Frontend display component — **needs modification**
- `e2e/dashboard.spec.ts` — E2E tests seeding pre-computed summary data — **needs modification**

### To Be Modified
- `src/lib/dashboard-metrics.ts` — Core aggregation logic: 6 SQL queries using wrong columns (grossAmount instead of netAmount, capped grossQuantity instead of discountQuantity) — **PRIMARY FIX**
- `src/entities/dashboard-monthly-summary.entity.ts` — `UserSpendingEntry` interface needs to change from `totalAmount` to `totalRequests` since users are now ranked by request count — **MODIFY interface**
- `src/app/api/dashboard/route.ts` — Needs to pass `seatBaseCost` (activeSeats × 19) into total spending, and user entries now carry request count instead of amount — **MODIFY** 
- `src/components/dashboard/DashboardPanel.tsx` — Most/Least active users display changes from currency to request count — **MODIFY UI**
- `src/lib/__tests__/dashboard-metrics.test.ts` — Test data uses `makeUsageItem()` where gross=net; needs realistic discount/net split data — **MODIFY tests**
- `src/app/api/dashboard/__tests__/route.test.ts` — Seed data and assertions need updating for new field semantics — **MODIFY tests**
- `e2e/dashboard.spec.ts` — Seed data and assertions need updating for new user display format — **MODIFY tests**

### To Be Created
- New database migration — Add `seatBaseCost` column to `dashboard_monthly_summary` (to store the $19/seat component separately for audit transparency)
- No new source files needed; all changes fit within existing code structure

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What should "Total Spending" include? | `SUM(netAmount) + activeSeats × $19` (paid premium requests + seat license cost) | ✅ Resolved |
| 2 | What should Model Usage "Total Cost" show? | `SUM(netAmount)` per model (paid cost only) | ✅ Resolved |
| 3 | How should Most/Least Active Users be ranked and displayed? | Ranked by `SUM(grossQuantity)` (total requests), displayed as request count | ✅ Resolved |
| 4 | Is the $19 per active seat or total seat? | Per active seat | ✅ Resolved |

## Implementation Plan

### Phase 1: Database Schema & Entity Updates

#### Task 1.1 - [MODIFY] Update `DashboardMonthlySummary` Entity
**Description**: Update the entity to add `seatBaseCost` column and change `UserSpendingEntry` interface to use `totalRequests` instead of `totalAmount` since users are now ranked by request count.

**Changes**:
- Add `seatBaseCost` field (decimal, precision 19, scale 4, default 0) to `DashboardMonthlySummary` interface and entity schema
- Rename `UserSpendingEntry.totalAmount` → `UserSpendingEntry.totalRequests` (number, representing total premium request count)
- Interface rename: `UserSpendingEntry` → `UserActivityEntry` (since it no longer represents spending)

**File**: `src/entities/dashboard-monthly-summary.entity.ts`

**Definition of Done**:
- [x] `DashboardMonthlySummary` interface includes `seatBaseCost: number` field
- [x] Entity schema includes `seatBaseCost` column with type `decimal`, precision 19, scale 4, default 0
- [x] `UserSpendingEntry` renamed to `UserActivityEntry` with `totalRequests: number` replacing `totalAmount: number`
- [x] All imports of `UserSpendingEntry` across the codebase are updated to `UserActivityEntry`
- [x] TypeScript compiles without errors

#### Task 1.2 - [CREATE] Database Migration for `seatBaseCost` Column
**Description**: Create a TypeORM migration to add the `seatBaseCost` column to the `dashboard_monthly_summary` table.

**File**: `migrations/<timestamp>-AddSeatBaseCost.ts`

**Definition of Done**:
- [x] Migration adds `seatBaseCost` column (decimal(19,4), NOT NULL, DEFAULT 0) to `dashboard_monthly_summary`
- [x] Migration `down()` drops the `seatBaseCost` column
- [x] Migration follows the existing naming convention (`<timestamp>-<PascalCaseName>.ts`)

### Phase 2: Fix Core Metrics Aggregation

#### Task 2.1 - [MODIFY] Fix `refreshDashboardMetrics()` SQL Queries
**Description**: Update all SQL aggregation queries in `dashboard-metrics.ts` to use correct columns from the GitHub API data.

**File**: `src/lib/dashboard-metrics.ts`

**Specific changes**:

1. **Section 2 — Per-model usage**: Change `SUM((item->>'grossAmount')::numeric)` → `SUM((item->>'netAmount')::numeric)` for `totalAmount`
2. **Section 3 — Most active users**: Change `SUM((item->>'grossAmount')::numeric)` → `SUM((item->>'grossQuantity')::numeric)` for ranking and value; rename output alias from `totalAmount` to `totalRequests`; change `ORDER BY "totalAmount" DESC` → `ORDER BY "totalRequests" DESC`
3. **Section 4 — Least active users**: Same changes as section 3 but with `ASC` ordering
4. **Section 5 — Total spending**: Change `SUM((item->>'grossAmount')::numeric)` → `SUM((item->>'netAmount')::numeric)` for `totalSpending`
5. **Section 6 — Included premium requests**: Replace the entire per-user-capped-at-300 subquery with a simple `SUM((item->>'discountQuantity')::numeric)` across all usage items
6. **Upsert — Section 7**: Add `seatBaseCost` to the inserted/upserted values, computed as `activeSeats * 19`; add it to the `orUpdate` columns list
7. **Total spending final**: Change `totalSpending` to `netSpending + seatBaseCost` where `netSpending = SUM(netAmount)` and `seatBaseCost = activeSeats * 19`

**Definition of Done**:
- [x] Model usage `totalAmount` is computed from `SUM(netAmount)` per model
- [x] Most active users are ranked by `SUM(grossQuantity)` DESC and the mapped field is `totalRequests`
- [x] Least active users are ranked by `SUM(grossQuantity)` ASC and the mapped field is `totalRequests`
- [x] Total spending is computed as `SUM(netAmount) + (activeSeats × 19)`
- [x] `seatBaseCost` = `activeSeats * 19` is stored in the summary row
- [x] Included premium requests used is computed as `SUM(discountQuantity)` without per-user capping
- [x] `seatBaseCost` is included in the upsert's insert values and `orUpdate` columns
- [x] TypeScript compiles without errors

### Phase 3: Update Dashboard API Route

#### Task 3.1 - [MODIFY] Update API Response Shape
**Description**: Update the dashboard API route to reflect the new field semantics. The `paidPremiumRequests` derivation remains as `totalPremiumRequests - includedPremiumRequestsUsed` which is now mathematically correct since `includedPremiumRequestsUsed` uses `discountQuantity`. User entries change from `totalAmount` to `totalRequests`.

**File**: `src/app/api/dashboard/route.ts`

**Changes**:
- Add `seatBaseCost` to the response (from `summary.seatBaseCost`)
- User entries (`mostActiveUsers`, `leastActiveUsers`) now have `totalRequests` field (already correct from summary after Phase 2)
- No change to `paidPremiumRequests` derivation formula (but its inputs are now correct)

**Definition of Done**:
- [x] API response includes `seatBaseCost` field with correct value
- [x] `paidPremiumRequests` correctly derived from updated `totalPremiumRequests` and `includedPremiumRequestsUsed`
- [x] User entries expose `totalRequests` field instead of `totalAmount`
- [x] Empty-state response includes `seatBaseCost: 0`
- [x] TypeScript compiles without errors

### Phase 4: Update Frontend Dashboard Component

#### Task 4.1 - [MODIFY] Update `DashboardPanel` Component
**Description**: Update the frontend to match new data semantics. Most/Least active users now show request counts instead of currency. Add `seatBaseCost` to the spending breakdown.

**File**: `src/components/dashboard/DashboardPanel.tsx`

**Changes**:
1. Update `UserSpendingEntry` interface → `UserActivityEntry` with `totalRequests: number`
2. Update `DashboardData` interface to include `seatBaseCost: number`
3. Most/Least active user lists: change `formatCurrency(user.totalAmount)` → display `user.totalRequests.toLocaleString()` with " requests" suffix
4. Total Spending card: add subtitle showing breakdown (e.g., "$X.XX paid requests + $Y.XX seat licenses")

**Definition of Done**:
- [x] `DashboardData` interface includes `seatBaseCost` field
- [x] `UserActivityEntry` interface replaces `UserSpendingEntry` with `totalRequests: number`
- [x] Most active users display request count (e.g., "1,234 requests") instead of currency
- [x] Least active users display request count instead of currency
- [x] Total Spending card shows spending breakdown in subtitle text
- [x] Component renders correctly with all data states (normal, empty, zero spending)

### Phase 5: Update Tests

#### Task 5.1 - [MODIFY] Update `dashboard-metrics.test.ts` Unit Tests
**Description**: Fix the `makeUsageItem` helper to generate realistic data with distinct gross/discount/net values. Update existing tests and add new tests that verify the correct columns are used.

**File**: `src/lib/__tests__/dashboard-metrics.test.ts`

**Changes**:
1. Update `makeUsageItem()` to accept discount/net parameters or derive them realistically:
   - New signature: `makeUsageItem(model, grossQuantity, grossAmount, discountQuantity?, discountAmount?)` where `netQuantity = grossQuantity - discountQuantity` and `netAmount = grossAmount - discountAmount`
2. Update existing test assertions for spending to reflect netAmount (not grossAmount)
3. Update existing test assertions for user entries to use `totalRequests` instead of `totalAmount`
4. Add test: "correctly computes total spending as SUM(netAmount) plus seat base cost"
5. Add test: "correctly computes included premium requests used from discountQuantity"
6. Add test: "model usage totalAmount reflects netAmount not grossAmount"
7. Add test: "most active users ranked by grossQuantity not grossAmount"
8. Add test: "seatBaseCost is stored as activeSeats × 19"
9. Update existing premium request tests for the new discountQuantity-based logic

**Definition of Done**:
- [ ] `makeUsageItem` helper supports distinct gross/discount/net values
- [ ] Test for total spending verifies `SUM(netAmount) + seatBaseCost` (not grossAmount)
- [ ] Test for model usage verifies `totalAmount` = `SUM(netAmount)` per model
- [ ] Test for most active users verifies ranking by `grossQuantity` DESC and field is `totalRequests`
- [ ] Test for least active users verifies ranking by `grossQuantity` ASC and field is `totalRequests`
- [ ] Test for included premium requests verifies use of `discountQuantity` (not capped grossQuantity)
- [ ] Test for `seatBaseCost` verifies `activeSeats * 19`
- [ ] Test with mixed gross/net values (some items fully discounted, some partially paid) passes
- [ ] All existing tests either pass or are correctly updated with correct assertions
- [ ] All tests pass (`npm run test`)

#### Task 5.2 - [MODIFY] Update `route.test.ts` API Tests
**Description**: Update seed data and assertions to match new field semantics (user entries have `totalRequests`, response includes `seatBaseCost`).

**File**: `src/app/api/dashboard/__tests__/route.test.ts`

**Changes**:
1. Update `seedSummary` default values: add `seatBaseCost`, change user entries from `totalAmount` to `totalRequests`
2. Update assertion for stored summary response to check `seatBaseCost` and user `totalRequests`
3. Update empty-state response assertion to include `seatBaseCost: 0`

**Definition of Done**:
- [ ] `seedSummary` helper includes `seatBaseCost` field
- [ ] User entries in seed data use `totalRequests` instead of `totalAmount`
- [ ] All response assertions verify `seatBaseCost` field presence and value
- [ ] Empty-state assertions include `seatBaseCost: 0`
- [ ] All tests pass (`npm run test`)

#### Task 5.3 - [MODIFY] Update E2E Dashboard Tests
**Description**: Update the E2E seed data and assertions for the dashboard page. User activity entries now show request counts instead of currency.

**File**: `e2e/dashboard.spec.ts`

**Changes**:
1. Update `seedDashboardSummary`: add `seatBaseCost` column to INSERT; change user entries from `totalAmount` to `totalRequests` with integer values
2. Update user-related assertions: instead of checking for currency display, check for request count display
3. Update premium request assertions if values change due to new metric semantics
4. Update spending assertion if total spending value changes

**Definition of Done**:
- [ ] `seedDashboardSummary` inserts `seatBaseCost` value
- [ ] User entries in seed data use `totalRequests` with numeric request count
- [ ] E2E test for most active users checks request count display (e.g., "150 requests")
- [ ] E2E test for least active users checks request count display
- [ ] E2E test for total spending matches the new computation
- [ ] E2E test for premium requests passes with updated values
- [ ] All E2E tests pass (`npm run test:e2e`)

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Automated Code Review
**Description**: Run the `tsh-code-reviewer` agent to review all changes for correctness, consistency, and adherence to project standards.

**Definition of Done**:
- [ ] Code review completed by `tsh-code-reviewer` agent
- [ ] All review findings addressed

## Security Considerations

- **No new attack surface**: Changes are limited to internal SQL aggregation queries. No new endpoints or user inputs are introduced.
- **SQL injection**: All SQL queries continue to use parameterized queries (`$1`, `$2`). The JSONB field access (`item->>'netAmount'`) uses hardcoded column names, not user input. No risk.
- **Data accuracy**: The fix ensures financial data (spending) is accurate. Inaccurate financial data could lead to incorrect business decisions — this is a data integrity fix, not a security vulnerability, but it improves trust in the system.
- **Type casting**: The `::numeric` casts in SQL are applied to known JSONB fields from the GitHub API. Invalid data (non-numeric) would result in a SQL error during aggregation, which is caught by the existing try/catch in `refreshDashboardMetrics` callers.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Given a user with usage items where `grossAmount = 2.12`, `discountAmount = 2.12`, `netAmount = 0`, the total spending does NOT include this $2.12 in the premium request cost component (only $19 seat license shows)
- [ ] Given 5 active seats, total spending includes $95 ($19 × 5) for seat base cost
- [ ] Model usage "Total Cost" column shows `SUM(netAmount)` per model, displaying $0.00 when all usage is fully discounted
- [ ] Most active users are ranked by total request count (highest first), not by dollar amount
- [ ] Least active users are ranked by total request count (lowest first)
- [ ] Most/least active user entries display request counts (e.g., "1,234 requests") not currency
- [ ] "Included Used" premium requests show `SUM(discountQuantity)` (actual API-reported value), not a capped approximation
- [ ] "Paid Requests" = `totalPremiumRequests − includedPremiumRequestsUsed` is mathematically consistent
- [ ] All unit tests pass (`npm run test`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] No TypeScript compilation errors (`npm run build`)
- [ ] No lint errors (`npm run lint`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Add gross vs net breakdown to model usage table**: Show both "Total Value" (grossAmount) and "Paid Cost" (netAmount) columns so users can see the full picture of usage value vs actual spending.
- **Historical recalculation job**: After deploying this fix, existing `dashboard_monthly_summary` rows contain incorrect values. A one-time recalculation job for historical months would correct past data.
- **Configurable seat cost**: The $19/seat/month is currently hardcoded. In the future, this could be a configuration setting in the `configuration` table to handle different GitHub Copilot plans (Business at $19 vs Enterprise at $39).
- **Per-user spending breakdown**: Add a detail view showing per-user paid vs included premium request breakdown.
- **Alerting on paid overages**: Notify admins when paid premium requests (netQuantity > 0) indicate users exceeding their included allowance.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
