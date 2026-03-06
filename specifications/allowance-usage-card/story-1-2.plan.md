# Story 1.2 — Add Month-over-Month Trend Indicator to Allowance Usage Card — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Add month-over-month trend indicator to Allowance Usage card |
| Description | Enhance the Allowance Usage card (delivered in Story 1.1) with a trend indicator that compares the current month's usage percentage against the previous month, showing directional change with visual cues. The API is enhanced to return previous month allowance data. |
| Priority | High |
| Related Research | `specifications/allowance-usage-card/extracted-tasks.md`, `specifications/allowance-usage-card/jira-tasks.md`, `specifications/allowance-usage-card/story-1-1.plan.md` |

## Proposed Solution

Enhance the dashboard API to fetch the previous calendar month's `DashboardMonthlySummary` alongside the current month's record. The API returns the previous month's `includedPremiumRequests` and `includedPremiumRequestsUsed` (or `null` when no data exists). The frontend computes both months' usage percentages, derives the delta, and renders a trend indicator on the Allowance Used card.

The trend indicator displays:
- **Direction arrow**: `↑` for increase, `↓` for decrease, `—` for no change
- **Delta value**: Rounded integer percentage point difference (e.g., "5%")
- **Color coding**: Red for increase (more usage = bad), green for decrease (less usage = good), gray for no change
- **No prior data state**: When no previous month record exists or previous allowance is zero, display "No prior data" in gray

A new helper function `calcAllowanceTrend` is added to `usage-helpers.ts` for testable trend computation, following the same pattern as the existing `getAllowanceThresholdColor`.

```
┌─────────────────────────────────────────────────────────┐
│  Allowance Used Card                                    │
│                                                         │
│  Allowance Used                                         │
│  83%                    ← color-coded (amber)           │
│  9,500 / 11,400 requests                                │
│  ↑ 23% vs last month   ← NEW trend indicator (red)     │
│                                                         │
│  or when no previous data:                              │
│  No prior data          ← gray text                     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────────┐     ┌──────────────────────────────────┐
│  Month Filter        │────▶│  DashboardPanel                  │
│  (month, year)       │     │                                  │
└─────────────────────┘     │  fetch(/api/dashboard?m=3&y=2026)│
                             └──────────────┬───────────────────┘
                                            │
                             ┌──────────────▼───────────────────┐
                             │  GET /api/dashboard               │
                             │                                   │
                             │  1. Fetch summary(month, year)    │
                             │  2. Compute prevMonth/prevYear    │
                             │     (Jan → Dec of prev year)      │
                             │  3. Fetch summary(prevMonth,      │
                             │     prevYear)                     │
                             │  4. Return current data +         │
                             │     previousIncludedPremiumReqs   │
                             │     previousIncludedPremiumUsed   │
                             └──────────────┬───────────────────┘
                                            │
                             ┌──────────────▼───────────────────┐
                             │  DashboardPanel (client)          │
                             │                                   │
                             │  currentPercent = used/total*100  │
                             │  previousPercent = prevUsed/      │
                             │    prevTotal*100                  │
                             │  trend = calcAllowanceTrend(      │
                             │    current, previous)             │
                             │  Render: arrow + delta + color    │
                             └──────────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `DashboardPanel` component — `src/components/dashboard/DashboardPanel.tsx` — Renders the Allowance Used card (Story 1.1) with percentage, absolute values, color coding, and N/A state. All card infrastructure is in place.
- Dashboard API route — `src/app/api/dashboard/route.ts` — Returns `includedPremiumRequests` and `includedPremiumRequestsUsed` for the current month. Uses `summaryRepo.findOne({ where: { month, year } })`.
- `DashboardMonthlySummary` entity — `src/entities/dashboard-monthly-summary.entity.ts` — Stores per-month allowance data (`activeSeats`, `includedPremiumRequestsUsed`) with unique constraint on `(month, year)`.
- `getAllowanceThresholdColor` helper — `src/lib/usage-helpers.ts` — Returns color class and label for allowance percentage thresholds. Pattern to follow for the new trend helper.
- `getPremiumAllowance` helper — `src/lib/get-premium-allowance.ts` — Returns configurable `premiumRequestsPerSeat`. Used by the API for both current and previous month allowance computation.
- `DashboardData` interface — `src/components/dashboard/DashboardPanel.tsx` — TypeScript interface for API response data. Needs new fields.
- E2E seed helpers — `e2e/dashboard.spec.ts` — `seedDashboardSummary` and `seedSummaryForMonth` functions already seed arbitrary month/year data. The `seedSummaryForMonth` helper handles upserts via `ON CONFLICT`.
- Unit test helpers — `src/app/api/dashboard/__tests__/route.test.ts` — `seedSummary` function and `makeGetRequest` builder already in place.
- Year-boundary pattern — Used across test files: `prevMonth = currentMonth === 1 ? 12 : currentMonth - 1`.

### To Be Modified
- `src/app/api/dashboard/route.ts` — Add a second `findOne` query for the previous month's summary. Compute `previousIncludedPremiumRequests` and `previousIncludedPremiumRequestsUsed`. Add both fields to response (both data-exists and empty-state branches).
- `src/components/dashboard/DashboardPanel.tsx` — Extend `DashboardData` interface with `previousIncludedPremiumRequests: number | null` and `previousIncludedPremiumRequestsUsed: number | null`. Compute previous percentage and trend delta. Render trend indicator in the Allowance Used card.
- `src/lib/usage-helpers.ts` — Add `calcAllowanceTrend` function.
- `src/lib/__tests__/usage-helpers.test.ts` — Add tests for `calcAllowanceTrend`.
- `src/app/api/dashboard/__tests__/route.test.ts` — Add tests for previous month data in API response.
- `e2e/dashboard.spec.ts` — Add E2E tests for trend indicator display, no-prior-data state, and year boundary handling.

### To Be Created
- No new files needed. All changes are modifications to existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the trend delta be in percentage points or relative percent change? | Percentage points (absolute difference between the two percentages). E.g., if current=83% and previous=60%, the delta is "↑ 23%", not "↑ 38%". This is simpler to understand at a glance. | ✅ Resolved |
| 2 | What color should the "increase" trend use? | Red — for allowance usage, higher consumption is the concerning direction. This is consistent with `getAllowanceThresholdColor` where > 100% = red. Decrease uses green (less usage = good). | ✅ Resolved |
| 3 | When previous month has 0 active seats (0 allowance), should we show a trend vs 0%? | No — show "No prior data". A previous period with 0 allowance (0 active seats) has no meaningful baseline for comparison. Division by zero is avoided and the label correctly conveys there's no useful reference point. | ✅ Resolved |
| 4 | Should the current card show a trend when the current month itself has 0 allowance (N/A state)? | No — when the current month displays "N/A", no trend is shown. A trend between "N/A" and a previous percentage is meaningless. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add Trend Calculation Helper

#### Task 1.1 - [MODIFY] Add `calcAllowanceTrend` to usage-helpers.ts
**Description**: Add a new function `calcAllowanceTrend(currentPercent: number, previousPercent: number)` to `src/lib/usage-helpers.ts` that computes the trend delta and returns the directional arrow, rounded delta value, color class, and accessibility label.

Return type: `{ arrow: string; delta: number; colorClass: string; label: string }`

Logic:
- `delta = Math.round(currentPercent - previousPercent)`
- `delta > 0` → `{ arrow: "↑", delta, colorClass: "text-red-600", label: "Increased usage" }`
- `delta < 0` → `{ arrow: "↓", delta: Math.abs(delta), colorClass: "text-green-600", label: "Decreased usage" }`
- `delta === 0` → `{ arrow: "—", delta: 0, colorClass: "text-gray-500", label: "No change" }`

**Definition of Done**:
- [x] `calcAllowanceTrend` function is exported from `src/lib/usage-helpers.ts`
- [x] Returns arrow `"↑"`, red color class, and positive delta for increase
- [x] Returns arrow `"↓"`, green color class, and positive absolute delta for decrease
- [x] Returns arrow `"—"`, gray color class, and delta 0 for no change
- [x] Delta is rounded to nearest integer
- [x] TypeScript compilation passes with no new errors

#### Task 1.2 - [MODIFY] Add unit tests for `calcAllowanceTrend`
**Description**: Add test cases to `src/lib/__tests__/usage-helpers.test.ts` for the new function, following the existing boundary-value pattern used for `getAllowanceThresholdColor` tests.

Test cases:
- Positive delta: current=83, previous=60 → arrow "↑", delta 23, red
- Negative delta: current=60, previous=83 → arrow "↓", delta 23, green
- Zero delta: current=75, previous=75 → arrow "—", delta 0, gray
- Large increase: current=120, previous=0 → arrow "↑", delta 120, red
- Rounding: current=83.3, previous=82.7 → delta rounds to 1

**Definition of Done**:
- [x] Test for positive delta returns correct arrow, delta, and color
- [x] Test for negative delta returns correct arrow, absolute delta, and color
- [x] Test for zero delta returns no-change indicator
- [x] Test for large increase (0% → 120%) works correctly
- [x] Test for rounding behavior (fractional percentages round to integer delta)
- [x] All existing usage-helpers tests continue to pass

### Phase 2: API Enhancement — Return Previous Month Data

#### Task 2.1 - [MODIFY] Enhance dashboard API to include previous month allowance data
**Description**: Modify `src/app/api/dashboard/route.ts` to fetch the previous calendar month's `DashboardMonthlySummary` record and include the computed allowance data in the response. The previous month calculation must handle year boundaries (January → December of previous year).

Changes:
1. After fetching the current month's summary, compute `prevMonth` and `prevYear` with year-boundary handling
2. Fetch the previous month's summary: `summaryRepo.findOne({ where: { month: prevMonth, year: prevYear } })`
3. If previous summary exists: compute `previousIncludedPremiumRequests = previousSummary.activeSeats * premiumRequestsPerSeat` and extract `previousIncludedPremiumRequestsUsed`
4. If not: set both to `null`
5. Add both fields to the JSON response in the data-exists branch
6. In the empty-state branch (no current month data), return `null` for both fields without a DB query

**Definition of Done**:
- [x] API response includes `previousIncludedPremiumRequests` field (number or null)
- [x] API response includes `previousIncludedPremiumRequestsUsed` field (number or null)
- [x] When previous month summary exists, values are computed from `activeSeats * premiumRequestsPerSeat` and `includedPremiumRequestsUsed`
- [x] When previous month summary does not exist, both fields are `null`
- [x] January correctly fetches December of the previous year
- [x] Empty-state response includes `null` for both previous month fields
- [x] TypeScript compilation passes with no new errors

#### Task 2.2 - [MODIFY] Add unit tests for previous month API data
**Description**: Add test cases to `src/app/api/dashboard/__tests__/route.test.ts` verifying the new previous-month fields in the API response. Follow the existing test patterns using `seedSummary`, `makeGetRequest`, and `seedAuthSession`.

Test cases:
1. When previous month summary exists → response includes non-null `previousIncludedPremiumRequests` and `previousIncludedPremiumRequestsUsed`
2. When previous month summary does not exist → both are `null`
3. Year boundary: requesting month=1, year=2026 with data seeded for month=12, year=2025 → previous month data is returned
4. Empty-state response includes `null` for both fields
5. Verify response structure includes the new fields

**Definition of Done**:
- [x] Test verifies previous month data returned when row exists
- [x] Test verifies `null` returned when no previous month row
- [x] Test verifies year boundary (January → December previous year)
- [x] Test verifies empty-state response includes null for previous month fields
- [x] Test verifies response structure includes new fields
- [x] All existing dashboard API tests continue to pass

### Phase 3: Update Allowance Used Card with Trend Indicator

#### Task 3.1 - [MODIFY] Add trend indicator to Allowance Used card in DashboardPanel.tsx
**Description**: Modify `src/components/dashboard/DashboardPanel.tsx` to display a trend indicator on the Allowance Used card. The indicator shows the direction and magnitude of change compared to the previous month.

Changes:
1. Extend `DashboardData` interface with `previousIncludedPremiumRequests: number | null` and `previousIncludedPremiumRequestsUsed: number | null`
2. Import `calcAllowanceTrend` from `@/lib/usage-helpers`
3. After computing `allowancePercent`, compute the previous percentage and trend:
   - If previous data is not null and `previousIncludedPremiumRequests > 0`: compute `previousPercent` and call `calcAllowanceTrend(allowancePercent, previousPercent)`
   - Otherwise: `trend = null`
4. In the Allowance Used card JSX, below the absolute values line, add:
   - When `hasAllowance` is true and `trend` is not null: display `"{arrow} {delta}% vs last month"` with the trend's color class, and an `aria-label` describing the trend
   - When `hasAllowance` is true and `trend` is null: display `"No prior data"` in gray text
   - When `hasAllowance` is false (N/A state): no trend indicator shown

**Definition of Done**:
- [x] `DashboardData` interface includes `previousIncludedPremiumRequests: number | null` and `previousIncludedPremiumRequestsUsed: number | null`
- [x] Trend indicator displays arrow and delta when previous data exists (e.g., "↑ 23% vs last month")
- [x] Increase trend uses red color (`text-red-600`)
- [x] Decrease trend uses green color (`text-green-600`)
- [x] No-change trend uses gray color (`text-gray-500`)
- [x] "No prior data" text is shown in gray when no previous month data is available
- [x] "No prior data" is shown when previous month has 0 allowance (0 active seats)
- [x] No trend indicator is shown when current month displays "N/A" (0 allowance)
- [x] Trend indicator has an `aria-label` for accessibility
- [x] Card continues to update when the month filter changes
- [x] TypeScript compilation passes with no new errors

### Phase 4: E2E Testing

#### Task 4.1 - [MODIFY] Add E2E tests for trend indicator
**Description**: Add E2E tests to `e2e/dashboard.spec.ts` to verify the trend indicator renders correctly with seeded data across various scenarios.

Tests to add:
1. **Trend displays correct direction and delta**: Seed current month (38 active × 300 = 11,400; 9,500 used → 83%) and previous month (8 active × 300 = 2,400; 900 used → 38%). Verify trend shows "↑ 46%" (83 - 38 = 45, rounded from actual 83.33 - 37.5 = 45.83 → 46).
2. **"No prior data" when no previous month exists**: Seed only current month data. Verify "No prior data" text is visible.
3. **"No prior data" when previous month has 0 active seats**: Seed current month with data and previous month with `activeSeats: 0`. Verify "No prior data" is shown.
4. **Trend updates when month filter changes**: Seed 3 months of data (A, B, C). Select month B → shows trend vs A. Select month C → shows trend vs B. Delta values should differ.

**Definition of Done**:
- [x] E2E test verifies trend indicator shows correct direction and delta with seeded data
- [x] E2E test verifies "No prior data" shown when no previous month row exists
- [x] E2E test verifies "No prior data" shown when previous month has 0 active seats
- [x] E2E test verifies trend updates when month filter changes
- [x] All new E2E tests pass
- [x] All existing E2E dashboard tests continue to pass

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a thorough code review of all changes made in Phases 1–4. The review should verify API response structure, trend calculation correctness, year-boundary edge cases, accessibility of the trend indicator, proper test coverage, and consistency with Story 1.1 patterns.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **Minimal new API surface**: The API enhancement adds a single read-only `findOne` query against the same `DashboardMonthlySummary` table. No new endpoints, no write operations.
- **No privilege escalation**: The previous month data is from the same entity and table that the current month data comes from. Authentication is enforced by the existing `requireAuth()` middleware.
- **No user-controlled query parameters for previous month**: The previous month/year are computed server-side from the validated current month/year. No additional user input is parsed, eliminating injection vectors.
- **No XSS vectors**: The trend arrow characters (`↑`, `↓`, `—`) and numeric delta are rendered via React JSX (automatic escaping). No raw HTML.
- **No sensitive data exposure**: The previous month's allowance data (active seats × premiumRequestsPerSeat, includedPremiumRequestsUsed) is derived from the same category of data already visible on the dashboard.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The Allowance Usage card displays a trend indicator showing the direction of change vs the previous month (e.g., "↑ 5%" or "↓ 3%")
- [x] The trend is calculated by comparing the current month's usage percentage against the previous month's usage percentage
- [x] The API provides previous month's allowance usage data alongside the current month's response
- [x] When no previous month data is available (e.g., first month of usage), "No prior data" is displayed instead of a trend
- [x] The trend indicator uses visual cues to distinguish increasing vs decreasing usage (directional arrow + color: red for increase, green for decrease)
- [x] "Previous month" correctly wraps across year boundaries (e.g., January 2026 compares against December 2025)
- [x] When previous month has 0 active seats (0 allowance), "No prior data" is shown
- [x] When current month shows "N/A" (0 allowance), no trend is displayed
- [x] Trend indicator has an `aria-label` for screen reader accessibility
- [x] All E2E tests pass (existing + new)
- [x] All unit tests pass (existing + new)
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors

## Improvements (Out of Scope)

- **Configurable trend periods**: Comparing against N months ago instead of always the immediately previous month. Not part of this story per the extracted-tasks out-of-scope section.
- **Trend indicators on other dashboard cards**: The trend pattern could be applied to Total Seats, Total Spending, and Active Seats cards. Not part of this epic.
- **Sparkline or mini chart**: A small chart showing the last N months of allowance usage could replace or supplement the single-value trend. Deferred as a future enhancement.
- **Batch previous month fetch**: The API makes two separate `findOne` queries. A single query with `WHERE (month = X AND year = Y) OR (month = X2 AND year = Y2)` could reduce to one round trip. The performance difference is negligible given the indexed unique constraint, so this optimization is not warranted now.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Phases 1–4 implemented: `calcAllowanceTrend` helper, API previous-month fetch, UI trend indicator, E2E tests. All 22 unit tests, 11 API tests, 21 E2E tests pass. TypeScript and ESLint clean. |
| 2026-03-05 | Phase 5 code review completed by `tsh-code-reviewer` — **PASS**. No critical/high/medium findings. 3 info-level observations (all intentional). |
