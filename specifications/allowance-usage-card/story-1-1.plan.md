# Story 1.1 — Display Allowance Usage Percentage Card on Dashboard — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | — |
| Title | Display Allowance Usage Percentage card on dashboard |
| Description | Add a new "Allowance Used" summary card to the dashboard that shows the percentage of included premium request allowance consumed in the selected month, with color-coded severity thresholds and edge-case handling for zero-allowance and no-data states. |
| Priority | High |
| Related Research | `specifications/allowance-usage-card/extracted-tasks.md`, `specifications/allowance-usage-card/jira-tasks.md` |

## Proposed Solution

Add a fourth summary card ("Allowance Used") to the existing 3-card grid on the main dashboard. The card computes the allowance usage percentage client-side from data the dashboard API already returns (`includedPremiumRequestsUsed` ÷ `includedPremiumRequests` × 100). No API or database changes are needed.

The card displays:
- **Main metric**: Usage percentage (e.g., "72%") with color-coded text based on severity thresholds
- **Supporting detail**: Absolute values (e.g., "2,160 / 3,000 requests")
- **Edge cases**: "N/A" when allowance is zero (no active seats), "—" when the dashboard is in empty state (handled by existing `isEmpty` check which renders a global empty state message before the card grid)

A new helper function `getAllowanceThresholdColor` is added to `usage-helpers.ts` to return color classes based on the allowance-specific thresholds (green < 80%, amber 80–100%, red > 100%). This is distinct from the existing `getUsageColour` function which measures per-user seat activity (different meaning, inverted thresholds).

```
┌────────────────── Summary Cards Grid ──────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Total   │ │  Total   │ │  Active  │ │ Allowance│  │
│  │  Seats   │ │ Spending │ │  Seats   │ │   Used   │  │
│  │          │ │          │ │          │ │  72%     │  │
│  │  42      │ │  $770.00 │ │  38      │ │ 2160 /   │  │
│  │  38 act  │ │  $48 +   │ │  90% of  │ │ 3000 req │  │
│  │  4 inact │ │  $722    │ │  total   │ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└────────────────────────────────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented
- `DashboardPanel` component — `src/components/dashboard/DashboardPanel.tsx` — Renders the main dashboard with summary cards, premium requests section, model usage table, and user lists. Summary card grid currently has 3 cards (Total Seats, Total Spending, Active Seats).
- `DashboardData` interface — `src/components/dashboard/DashboardPanel.tsx` — Already includes `includedPremiumRequests`, `includedPremiumRequestsUsed`, and `includedPremiumRequestsRemaining` fields.
- Dashboard API route — `src/app/api/dashboard/route.ts` — Already computes and returns `includedPremiumRequests` (activeSeats × premiumRequestsPerSeat) and `includedPremiumRequestsUsed`. No API changes required.
- `DashboardMonthlySummary` entity — `src/entities/dashboard-monthly-summary.entity.ts` — Stores `includedPremiumRequestsUsed` and `totalPremiumRequests` per month/year.
- `getPremiumAllowance` helper — `src/lib/get-premium-allowance.ts` — Returns configurable premiumRequestsPerSeat (default 300). Used by the API to compute `includedPremiumRequests`.
- `calcUsagePercent` helper — `src/lib/usage-helpers.ts` — Generic percentage calculation with division-by-zero guard. Can be reused for the allowance percentage calculation.
- `getUsageColour` helper — `src/lib/usage-helpers.ts` — Returns color for per-user seat usage (green ≥ 90%, orange 50–89%, red < 50%). **Not suitable for allowance thresholds** — different meaning and inverted scale.
- `formatCurrency` helper — `src/lib/format-helpers.ts` — Formats currency values.
- E2E test suite — `e2e/dashboard.spec.ts` — Covers dashboard rendering, premium request metrics, month filter switching, and empty state.
- Unit test suite — `src/app/api/dashboard/__tests__/route.test.ts` — Covers API response structure including `includedPremiumRequests` and `includedPremiumRequestsUsed`.
- Unit test suite — `src/lib/__tests__/usage-helpers.test.ts` — Covers `getUsageColour` and `calcUsagePercent`.
- `DashboardWithFilter` component — `src/components/dashboard/DashboardWithFilter.tsx` — Wraps `DashboardPanel` with month filter. Month changes trigger re-render of `DashboardPanel` which re-fetches data. The new card will automatically update on month change because it uses the same `data` state.
- Empty state handling — `src/components/dashboard/DashboardPanel.tsx` — When no data exists for the selected month (`totalSeats === 0 && modelUsage.length === 0 && mostActiveUsers.length === 0`), a global empty state message is shown. The card grid (including the new card) does not render.

### To Be Modified
- `src/components/dashboard/DashboardPanel.tsx` — Add the "Allowance Used" card as a fourth card in the summary card grid. Change grid from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4` for responsive layout.
- `src/lib/usage-helpers.ts` — Add `getAllowanceThresholdColor` function with allowance-specific thresholds (green < 80%, amber 80–100%, red > 100%).
- `src/lib/__tests__/usage-helpers.test.ts` — Add tests for the new `getAllowanceThresholdColor` function.
- `e2e/dashboard.spec.ts` — Add E2E tests verifying the new card renders with correct data, color coding, and edge cases.

### To Be Created
- No new files needed. All changes are modifications to existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the percentage value display fractional digits (e.g., "72.5%") or round to integer? | Round to the nearest integer for display (e.g., "73%"). The percentage is a quick-glance metric and fractional precision is unnecessary. | ✅ Resolved |
| 2 | When zero allowance: display "N/A" or "0%"? | Display "N/A" since "0%" would misleadingly imply zero consumption when the truth is "not applicable — no allowance exists". The absolute values line should show "0 / 0 requests". | ✅ Resolved |
| 3 | Does the card need an accessible label for the color-coded percentage? | Yes. The percentage text itself conveys the metric; the color is supplementary. An `aria-label` on the percentage value should describe the severity (e.g., "72% — within limit", "120% — over limit"). | ✅ Resolved |

## Implementation Plan

### Phase 1: Add Allowance Threshold Helper

#### Task 1.1 - [MODIFY] Add `getAllowanceThresholdColor` to usage-helpers.ts
**Description**: Add a new function `getAllowanceThresholdColor(percent: number)` to `src/lib/usage-helpers.ts` that returns a text color class and label based on allowance-specific thresholds. This is separate from `getUsageColour` (per-user seat usage) because the thresholds and semantics are inverted: for allowance usage, low = good, high = bad.

Thresholds:
- `< 80%` → `text-green-600` (within budget)
- `80–100%` → `text-amber-600` (approaching limit)
- `> 100%` → `text-red-600` (over limit)

**Definition of Done**:
- [x] `getAllowanceThresholdColor` function is exported from `src/lib/usage-helpers.ts`
- [x] Returns `{ colorClass: "text-green-600", label: "Within limit" }` for percentage < 80
- [x] Returns `{ colorClass: "text-amber-600", label: "Approaching limit" }` for percentage 80–100
- [x] Returns `{ colorClass: "text-red-600", label: "Over limit" }` for percentage > 100
- [x] TypeScript compilation passes with no new errors

#### Task 1.2 - [MODIFY] Add unit tests for `getAllowanceThresholdColor`
**Description**: Add test cases to `src/lib/__tests__/usage-helpers.test.ts` for the new function, following the existing pattern used for `getUsageColour` tests (boundary value testing at each threshold).

**Definition of Done**:
- [x] Test for 0% returns green / "Within limit"
- [x] Test for 79.9% returns green / "Within limit"
- [x] Test for 80% returns amber / "Approaching limit"
- [x] Test for 100% returns amber / "Approaching limit"
- [x] Test for 100.1% returns red / "Over limit"
- [x] Test for 150% returns red / "Over limit"
- [x] All existing usage-helpers tests continue to pass

### Phase 2: Add Allowance Used Card to Dashboard

#### Task 2.1 - [MODIFY] Add Allowance Used card to DashboardPanel.tsx
**Description**: Modify `src/components/dashboard/DashboardPanel.tsx` to add a fourth summary card ("Allowance Used") to the card grid. The card computes the percentage from `data.includedPremiumRequestsUsed / data.includedPremiumRequests * 100`, applies color coding via `getAllowanceThresholdColor`, and displays absolute values as supporting detail.

Changes:
1. Import `getAllowanceThresholdColor` from `@/lib/usage-helpers`
2. Update grid classes from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4`
3. Add the card after the Active Seats card with:
   - Title: "Allowance Used" (`h2` tag, same styling as other cards)
   - Main metric: Percentage value with color from `getAllowanceThresholdColor`. When `includedPremiumRequests === 0`, display "N/A" in gray instead of a percentage.
   - Supporting detail: `"{used} / {total} requests"` or `"0 / 0 requests"` for zero-allowance
   - `aria-label` on the percentage for accessibility

**Definition of Done**:
- [x] Allowance Used card is displayed as the fourth card in the summary grid
- [x] Grid uses responsive columns: 1 column on mobile, 2 on `sm`, 4 on `lg`
- [x] Card displays percentage as main metric (e.g., "72%") with color-coded text
- [x] Card displays absolute values as supporting detail (e.g., "2,160 / 3,000 requests")
- [x] When `includedPremiumRequests === 0`, displays "N/A" in gray text
- [x] When usage exceeds allowance, displays values above 100% (e.g., "120%") in red text
- [x] Percentage value has an `aria-label` indicating severity level
- [x] Card follows existing summary card styling (`rounded-lg border border-gray-200 bg-white p-6 shadow-sm`)
- [x] Card updates when the user switches the month filter (inherits from existing `DashboardPanel` re-render behavior)
- [x] TypeScript compilation passes with no new errors

### Phase 3: E2E Testing

#### Task 3.1 - [MODIFY] Add E2E tests for Allowance Used card
**Description**: Add E2E tests to `e2e/dashboard.spec.ts` to verify the new card renders correctly with seeded data, handles the zero-allowance state, displays correct color coding, and updates when the month filter changes.

Tests to add:
1. Card is visible on the dashboard when data exists (verify card heading "Allowance Used" visible)
2. Card displays correct percentage (e.g., seeded data: 38 active seats × 300 = 11,400 included; 9,500 used → 83% → amber color)
3. Card displays absolute values ("9,500 / 11,400 requests")
4. Card shows "N/A" when included allowance is zero (seed a month with zero active seats)
5. Card updates to new data when the month filter is changed

**Definition of Done**:
- [x] E2E test verifies "Allowance Used" card heading is visible on dashboard
- [x] E2E test verifies correct percentage is displayed with seeded data
- [x] E2E test verifies absolute values (used / total requests) are displayed
- [x] E2E test verifies "N/A" state when included allowance is zero
- [x] E2E test verifies card updates when month filter changes
- [x] All new E2E tests pass
- [x] All existing E2E dashboard tests continue to pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review
**Description**: Use the `tsh-code-reviewer` agent to perform a thorough code review of all changes made in Phases 1–3. The review should verify adherence to existing card patterns, accessibility standards, color threshold correctness, edge-case handling, and proper test coverage.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All critical and high-severity findings addressed
- [x] Final code passes TypeScript compilation and lint checks

## Security Considerations

- **No new API surface**: This story does not create or modify any API endpoints. The dashboard API already returns `includedPremiumRequests` and `includedPremiumRequestsUsed`. All computation is client-side.
- **No XSS vectors**: All dynamic content is rendered via React JSX (automatic escaping). Numeric values are converted to strings using `.toLocaleString()` and `Math.round()`. No raw HTML injection.
- **Authentication unchanged**: The dashboard API enforces authentication via `requireAuth()`. The new card renders within the existing authenticated page flow.
- **No sensitive data exposure**: The allowance percentage is derived from existing data already visible on the dashboard (Premium Requests section).

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] The "Allowance Used" card is displayed in the summary card grid alongside Total Seats, Total Spending, and Active Seats
- [x] The card displays the usage percentage as the main metric value (e.g., "72%")
- [x] The card displays absolute values as supporting detail (e.g., "2,160 / 3,000 requests")
- [x] Percentage is calculated as: included premium requests used ÷ included allowance × 100
- [x] When included allowance is zero, the card displays "N/A" without errors
- [x] When no usage data exists for the selected month, the empty state is shown (card grid not rendered)
- [x] When usage exceeds the allowance, the card displays values above 100% without errors
- [x] The percentage uses color-coded thresholds (green < 80%, amber 80–100%, red > 100%)
- [x] The card updates when the user switches the month filter
- [x] All E2E tests pass (existing + new)
- [x] All unit tests pass (existing + new)
- [x] TypeScript compilation has no errors
- [x] ESLint reports no new warnings or errors

## Improvements (Out of Scope)

- **Extract summary cards into reusable components**: The four inline card blocks in `DashboardPanel.tsx` share identical styling. A generic `SummaryCard` component could reduce repetition. Deferred to avoid changing scope — the existing pattern uses inline cards.
- **Server-side percentage calculation**: The percentage could be computed on the API side and returned as a dedicated field, avoiding client-side division. Not needed since the computation is trivial and the required data is already available.
- **Configurable thresholds**: The 80% and 100% thresholds are hardcoded. A future enhancement could make them configurable via the Configuration table. Not part of this story.
- **Story 1.2 trend indicator**: The month-over-month trend arrow is planned separately in Story 1.2 and is explicitly out of scope for this story.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-05 | Initial plan created |
| 2026-03-05 | Implementation complete: Phase 1 (`getAllowanceThresholdColor` + 6 unit tests — all 17 tests pass), Phase 2 (Allowance Used card in DashboardPanel, grid changed to 4-col), Phase 3 (4 E2E tests written — execution pending Docker/DB). TypeScript and ESLint clean. |
| 2026-03-05 | Code review (tsh-code-reviewer): Approved with minor suggestions. Fixed M1 (replaced IIFE with pre-computed vars for consistency) and M3 (added aria-label to N/A state). S1 (negative % test) and S2 (E2E color assertion) deferred as nice-to-have. |
| 2026-03-05 | E2E tests: All 17 dashboard tests pass (13 existing + 4 new). Fixed pre-existing `premium request metrics` test — added `{ exact: true }` to disambiguate `11,400` and `9,500` text matches that now appear in both Premium Requests section and Allowance Used card. |
