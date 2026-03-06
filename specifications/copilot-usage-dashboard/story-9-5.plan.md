# Colour-Coded Usage Progress Bar on Individual Usage Detail Pages - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 9.5 |
| Title | Colour-coded usage progress bar on individual usage detail pages |
| Description | Add a prominent colour-coded progress bar at the top of every individual usage detail page (seat, team, department) showing the premium request usage percentage. The bar uses the same colour thresholds as the rest of the app: red (0–50%), orange (50–90%), green (90–100%+). The bar fills proportionally, displays the exact percentage as text, updates when the selected month changes, and shows 0% when no data is available. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 9, Story 9.5) |

## Proposed Solution

Create a reusable `UsageProgressBar` component and integrate it into all three detail panels (`SeatDetailPanel`, `TeamDetailPanel`, `DepartmentDetailPanel`). The component accepts a `percent` prop, renders a horizontal bar that fills proportionally, applies colour-coded backgrounds using the existing `getUsageColour()` helper, and displays the percentage as text.

**Data flow:**

```
API responses (each detail endpoint)
  ↓ totalRequests and premiumRequestsPerSeat
  ↓
Detail Panel components calculate usagePercent via calcUsagePercent()
  ↓
UsageProgressBar receives percent prop
  ↓ calls getUsageColour() for colour
  ↓ renders filled bar + percentage text
```

**Per-entity usage percentage calculation:**

| Entity | Calculation | API Source |
|---|---|---|
| Seat | `totalRequests / premiumRequestsPerSeat × 100` | `/api/usage/seats/[seatId]` — needs `premiumRequestsPerSeat` added to response |
| Team | `totalRequests / (memberCount × premiumRequestsPerSeat) × 100` | `/api/usage/teams/[teamId]` — already returns `premiumRequestsPerSeat`, `team.totalRequests`, `team.memberCount` |
| Department | `department.usagePercent` | `/api/usage/departments/[departmentId]` — already returns `usagePercent` and `premiumRequestsPerSeat` |

**Key backend change:** The seat detail API (`/api/usage/seats/[seatId]`) is the only endpoint that does not return `premiumRequestsPerSeat`. It must be enriched to include this value so the `SeatDetailPanel` can calculate the seat-level usage percentage.

**Component hierarchy:**

```
SeatDetailPanel / TeamDetailPanel / DepartmentDetailPanel
  └── UsageProgressBar  (new, placed immediately after the back link, before the header)
        ├── Filled bar (width = min(percent, 100)%, colour from getUsageColour)
        └── Percentage text label
```

**Colour thresholds (from existing `getUsageColour`):**
- Red (`bg-red-500`): 0–49.9%
- Orange (`bg-orange-500`): 50–89.9%
- Green (`bg-green-500`): ≥90%

## Current Implementation Analysis

### Already Implemented
- `getUsageColour()` — `src/lib/usage-helpers.ts` — returns `bgClass` and `label` based on percent thresholds (red <50%, orange 50–89%, green ≥90%)
- `calcUsagePercent()` — `src/lib/usage-helpers.ts` — calculates usage % with division-by-zero guard
- `UsageStatusIndicator` — `src/components/usage/UsageStatusIndicator.tsx` — small square indicator using `getUsageColour()`; already used across tables (Story 9.4)
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — seat detail page with back link, header, MonthFilter, summary cards, daily chart, model table
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — team detail page with back link, header, MonthFilter, summary cards, daily chart, member table; already has `premiumRequestsPerSeat` from API
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — department detail page with back link, header, MonthFilter, member chart, member table; already has `premiumRequestsPerSeat` and `department.usagePercent` from API
- `getPremiumAllowance()` — `src/lib/get-premium-allowance.ts` — reads configurable allowance from Configuration table
- Seat detail API — `src/app/api/usage/seats/[seatId]/route.ts` — returns seat info, summary (totalRequests, grossSpending, netSpending), dailyUsage, modelBreakdown
- Team detail API — `src/app/api/usage/teams/[teamId]/route.ts` — returns team info (with totalRequests, memberCount), members, dailyUsagePerMember, `premiumRequestsPerSeat`
- Department detail API — `src/app/api/usage/departments/[departmentId]/route.ts` — returns department info (with `usagePercent`, totalRequests, memberCount), members, `premiumRequestsPerSeat`
- Unit tests for `getUsageColour` and `calcUsagePercent` — `src/lib/__tests__/usage-helpers.test.ts`
- Unit tests for `UsageStatusIndicator` — `src/components/usage/__tests__/UsageStatusIndicator.test.ts`
- E2E seat usage tests — `e2e/seat-usage.spec.ts`
- E2E team usage tests — `e2e/team-usage.spec.ts`
- E2E department usage tests — `e2e/department-usage.spec.ts`

### To Be Modified
- Seat detail API — `src/app/api/usage/seats/[seatId]/route.ts` — add `premiumRequestsPerSeat` to the JSON response
- `SeatDetailPanel` — `src/components/usage/SeatDetailPanel.tsx` — add `premiumRequestsPerSeat` to response interface, calculate usage percent, render `UsageProgressBar` after back link
- `TeamDetailPanel` — `src/components/usage/TeamDetailPanel.tsx` — calculate team-level usage percent, render `UsageProgressBar` after back link
- `DepartmentDetailPanel` — `src/components/usage/DepartmentDetailPanel.tsx` — use existing `department.usagePercent`, render `UsageProgressBar` after back link
- E2E seat usage tests — `e2e/seat-usage.spec.ts` — add tests for progress bar visibility and colour
- E2E team usage tests — `e2e/team-usage.spec.ts` — add tests for progress bar visibility and colour
- E2E department usage tests — `e2e/department-usage.spec.ts` — add tests for progress bar visibility and colour

### To Be Created
- `UsageProgressBar` component — `src/components/usage/UsageProgressBar.tsx` — reusable progress bar with colour coding and percentage label
- `UsageProgressBar` unit tests — `src/components/usage/__tests__/UsageProgressBar.test.ts` — verify colour, fill width, percentage text, accessibility attributes, edge cases (0%, >100%)
- Seat detail API tests — `src/app/api/usage/seats/[seatId]/__tests__/route.test.ts` — integration test asserting `premiumRequestsPerSeat` is returned

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the progress bar be placed above or below the entity header/name? | Above the header, immediately after the back link. This gives maximum visibility — users see the overall usage status before reading the entity name and details. | ✅ Resolved |
| 2 | Should the bar cap visually at 100% or extend beyond? | Cap the visual fill at 100% (using `min(percent, 100)` for bar width) but display the actual percentage as text (e.g. "125%") so users see the true value. | ✅ Resolved |
| 3 | What should the seat-level usage % represent? | `totalRequests / premiumRequestsPerSeat × 100` — same per-seat calculation used elsewhere (Story 9.1). | ✅ Resolved |
| 4 | What should the team-level usage % represent? | `totalRequests / (memberCount × premiumRequestsPerSeat) × 100` — same aggregate calculation used in team tables (Story 9.2). | ✅ Resolved |
| 5 | Does the seat detail API need a backend change? | Yes — `/api/usage/seats/[seatId]` currently does not return `premiumRequestsPerSeat`. It must be added for the frontend to calculate usage %. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Enrich Seat Detail API

#### Task 1.1 - [MODIFY] Add `premiumRequestsPerSeat` to seat detail API response
**Description**: Modify `src/app/api/usage/seats/[seatId]/route.ts` to import `getPremiumAllowance` from `src/lib/get-premium-allowance.ts`, retrieve the configurable premium allowance, and include it as `premiumRequestsPerSeat` in the JSON response. Follow the same pattern used in `src/app/api/usage/teams/[teamId]/route.ts` (line 40 and line 148).

**Definition of Done**:
- [x] `getPremiumAllowance` is imported from `@/lib/get-premium-allowance`
- [x] `premiumRequestsPerSeat` is read after obtaining the data source (before the daily usage query)
- [x] `premiumRequestsPerSeat` is included as a top-level field in the JSON response object
- [x] Existing response structure is unchanged (no fields removed or renamed)

#### Task 1.2 - [CREATE] Integration test for `premiumRequestsPerSeat` in seat detail API
**Description**: Create `src/app/api/usage/seats/[seatId]/__tests__/route.test.ts` with an integration test verifying that the GET response includes `premiumRequestsPerSeat` as a number. Follow the pattern from `src/app/api/configuration/__tests__/route.test.ts` for test structure (imports, setup/teardown, DB helpers).

**Definition of Done**:
- [x] Test file created at `src/app/api/usage/seats/[seatId]/__tests__/route.test.ts`
- [x] Test verifies $`premiumRequestsPerSeat` field is a positive number in the JSON response
- [x] Test passes with `npm run test`

### Phase 2: Frontend — Create Reusable `UsageProgressBar` Component

#### Task 2.1 - [CREATE] `UsageProgressBar` component
**Description**: Create `src/components/usage/UsageProgressBar.tsx`. The component accepts a `percent` prop (number), delegates to `getUsageColour()` for colour determination, and renders a horizontal bar with:
- A full-width grey background container (`h-4 rounded-full bg-gray-200`)
- An inner filled div whose width is `min(percent, 100)%` and background colour is the `bgClass` from `getUsageColour()`
- A text label showing `Math.round(percent)%` positioned to the right of the bar or inside it
- `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label` for accessibility

When `percent` is 0, the bar shows an empty track with "0%" text.

**Definition of Done**:
- [x] Component file created at `src/components/usage/UsageProgressBar.tsx`
- [x] Component exported as a named export `UsageProgressBar`
- [x] Imports and uses `getUsageColour()` from `@/lib/usage-helpers`
- [x] Bar container uses `h-4 w-full rounded-full bg-gray-200` classes
- [x] Inner fill uses `h-full rounded-full transition-all` with the colour `bgClass` from `getUsageColour()`
- [x] Fill width is capped at 100% (`Math.min(percent, 100)`)
- [x] Percentage text (`Math.round(percent)%`) is displayed to the right of the bar
- [x] Component has `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label`
- [x] 0% renders an empty bar track with "0%" text
- [x] Values above 100% cap the visual bar at 100% but display the actual rounded percentage as text (e.g. "125%")

#### Task 2.2 - [CREATE] Unit tests for `UsageProgressBar`
**Description**: Create `src/components/usage/__tests__/UsageProgressBar.test.ts`. Verify the component exports correctly and tests the key rendering scenarios. Follow the pattern from `src/components/usage/__tests__/UsageStatusIndicator.test.ts` (vitest, node environment, named export verification).

**Definition of Done**:
- [x] Test file created at `src/components/usage/__tests__/UsageProgressBar.test.ts`
- [x] Test verifies `UsageProgressBar` is exported as a named function export
- [x] All tests pass with `npm run test`

### Phase 3: Frontend — Integrate Progress Bar into Detail Panels

#### Task 3.1 - [MODIFY] Add progress bar to `SeatDetailPanel`
**Description**: Modify `src/components/usage/SeatDetailPanel.tsx`:
1. Add `premiumRequestsPerSeat?: number` to the `SeatDetailResponse` interface
2. Import `UsageProgressBar` from `@/components/usage/UsageProgressBar` and `calcUsagePercent` from `@/lib/usage-helpers`
3. After destructuring `data`, extract `premiumRequestsPerSeat` (default 300) and calculate `usagePercent` via `calcUsagePercent(summary.totalRequests, premiumRequestsPerSeat)`
4. Render `<UsageProgressBar percent={usagePercent} />` immediately after the back link, before the header `<div>` — inside the main `space-y-6` container.
5. When `isEmpty` is true (no usage data), still render the progress bar with `percent={0}`.

**Definition of Done**:
- [x] `SeatDetailResponse` interface includes `premiumRequestsPerSeat?: number`
- [x] `UsageProgressBar` is imported and rendered after the back link
- [x] `calcUsagePercent` is used to compute `usagePercent` from `summary.totalRequests` and `premiumRequestsPerSeat`
- [x] Progress bar shows 0% when no usage data is available
- [x] Progress bar updates when month changes (re-renders with new data after fetch)

#### Task 3.2 - [MODIFY] Add progress bar to `TeamDetailPanel`
**Description**: Modify `src/components/usage/TeamDetailPanel.tsx`:
1. Import `UsageProgressBar` from `@/components/usage/UsageProgressBar` and `calcUsagePercent` from `@/lib/usage-helpers`
2. After destructuring `data`, calculate team-level `usagePercent` as `team.memberCount > 0 ? calcUsagePercent(team.totalRequests, team.memberCount * premiumRequestsPerSeat) : 0`
3. Render `<UsageProgressBar percent={usagePercent} />` immediately after the back link, before the header `<div>`.
4. When `!hasMembers` (no members), the bar shows 0%.

**Definition of Done**:
- [x] `UsageProgressBar` is imported and rendered after the back link
- [x] Team-level `usagePercent` is correctly calculated as `totalRequests / (memberCount × premiumRequestsPerSeat) × 100`
- [x] Progress bar shows 0% when team has no members
- [x] Progress bar updates when month changes

#### Task 3.3 - [MODIFY] Add progress bar to `DepartmentDetailPanel`
**Description**: Modify `src/components/usage/DepartmentDetailPanel.tsx`:
1. Import `UsageProgressBar` from `@/components/usage/UsageProgressBar`
2. After destructuring `data`, read `department.usagePercent` (already available from the API response)
3. Render `<UsageProgressBar percent={department.usagePercent} />` immediately after the back link, before the header `<div>`.
4. When `!hasMembers`, the bar shows 0% (the API already returns `usagePercent: 0` for departments with no members).

**Definition of Done**:
- [x] `UsageProgressBar` is imported and rendered after the back link
- [x] `department.usagePercent` is passed directly to the progress bar
- [x] Progress bar shows 0% when department has no members
- [x] Progress bar updates when month changes

### Phase 4: E2E Tests

#### Task 4.1 - [MODIFY] Add E2E tests for seat usage progress bar
**Description**: Add tests to `e2e/seat-usage.spec.ts` that verify:
1. The progress bar is visible on the seat detail page with seeded usage data
2. The bar displays the correct rounded percentage based on `totalRequests / premiumRequestsPerSeat × 100`
3. The bar has the correct colour attribute based on the percentage (verify via `role="progressbar"` locator and `aria-valuenow` attribute)
4. When no usage data exists, the bar shows 0%

**Definition of Done**:
- [x] Test verifies progress bar (`role="progressbar"`) is visible on the seat detail page
- [x] Test verifies the percentage text matches expected calculation
- [x] Test verifies the bar displays 0% when no usage data exists
- [x] Tests pass with `npm run test:e2e`

#### Task 4.2 - [MODIFY] Add E2E tests for team usage progress bar
**Description**: Add tests to `e2e/team-usage.spec.ts` that verify:
1. The progress bar is visible on the team detail page with seeded members and usage data
2. The bar displays the correct rounded team-level percentage
3. When the team has no members, the bar shows 0%

**Definition of Done**:
- [x] Test verifies progress bar (`role="progressbar"`) is visible on the team detail page
- [x] Test verifies the percentage text matches expected team-level calculation
- [x] Test verifies the bar displays 0% when team has no members for the selected month
- [x] Tests pass with `npm run test:e2e`

#### Task 4.3 - [MODIFY] Add E2E tests for department usage progress bar
**Description**: Add tests to `e2e/department-usage.spec.ts` that verify:
1. The progress bar is visible on the department detail page with seeded members and usage data
2. The bar displays the correct rounded department-level percentage
3. When the department has no members, the bar shows 0%

**Definition of Done**:
- [x] Test verifies progress bar (`role="progressbar"`) is visible on the department detail page
- [x] Test verifies the percentage text matches expected department-level calculation
- [x] Test verifies the bar displays 0% when department has no members
- [x] Tests pass with `npm run test:e2e`

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Automated code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent on all modified and created files to verify code quality, adherence to project conventions, and correctness.

**Definition of Done**:
- [x] All modified files reviewed for correctness and consistency with existing codebase patterns
- [x] No critical or high severity issues identified
- [x] All feedback addressed or documented

## Security Considerations

- No new API endpoints or authentication changes are introduced. The seat detail API modification only adds a read-only configuration value (`premiumRequestsPerSeat`) to an already-authenticated endpoint.
- No user input is processed in the new `UsageProgressBar` component — it receives a numeric prop and renders static HTML.
- The `premiumRequestsPerSeat` value is not sensitive data — it is a system-wide configuration value already exposed in multiple existing API responses.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A progress bar showing usage percentage is displayed at the top of every individual usage detail page (seat, team, department)
- [x] Progress bar uses the same colour thresholds: red (0–50%), orange (50–90%), green (90–100%+)
- [x] The bar fills proportionally to the usage percentage
- [x] The exact percentage value is displayed as text alongside or within the bar
- [x] The bar updates when the selected month changes
- [x] When usage data is not available, the bar displays 0% with appropriate styling
- [x] Unit tests pass for the new `UsageProgressBar` component
- [x] Integration test verifies `premiumRequestsPerSeat` in seat detail API response
- [x] E2E tests verify progress bar on seat, team, and department detail pages
- [x] Accessibility: progress bar has `role="progressbar"` with appropriate ARIA attributes

## Improvements (Out of Scope)

- Add a tooltip to the progress bar showing the exact numerator/denominator (e.g. "150 / 300 requests used")
- Animate the bar fill on initial render and month changes for a smoother user experience
- Add a progress bar to the dashboard overview page for org-level or enterprise-level aggregate usage
- Show the progress bar in a skeleton loading state while data is being fetched (currently hidden during loading)

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — all phases done. Code review: 0 critical, 0 high, 1 medium (ARIA `aria-valuenow` capped at 100 for spec compliance — fixed), 3 low (team E2E text assertion added; >100% E2E edge case noted for future; minimal unit test consistent with codebase pattern), 2 info (hardcoded 300 fallback consistent with codebase; colour verification via `aria-valuenow` is pragmatic). All findings addressed. |
