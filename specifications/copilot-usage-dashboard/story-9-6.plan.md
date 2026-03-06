# Story 9.6: Cap individual usage at premium request allowance in aggregate calculations — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 9.6 |
| Title | Cap individual usage at premium request allowance in aggregate calculations |
| Description | When calculating team, department, and seat usage percentages and progress bars, each individual member's premium requests are capped at `premiumRequestsPerSeat` before aggregation. This prevents outliers from inflating the aggregate percentage (e.g., 1000 requests with a 300 cap contributes 300 to the team total for percentage calculation). Raw totals remain visible for transparency. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md`, `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md` |

## Proposed Solution

Cap per-member premium request contributions at `premiumRequestsPerSeat` when computing aggregate usage percentages across all backend API routes that return `usagePercent`. Individual seat progress bars and status indicators also cap at 100%. Raw `totalRequests` values remain uncapped for transparency in summary views.

### Architecture Overview

```
                        ┌──────────────────────────┐
                        │   usage-helpers.ts        │
                        │                           │
                        │  calcUsagePercent()        │ ← Unchanged (single seat %)
                        │  + calcCappedUsagePercent()│ ← NEW: aggregate capped %
                        └──────────────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
  │  SQL-based routes  │  │ JS-aggregate routes │  │  Frontend comps   │
  │                    │  │                    │  │                    │
  │ /api/usage/teams   │  │ /api/usage/teams/  │  │ UsageProgressBar   │
  │ /api/usage/depts   │  │  [teamId]          │  │  → cap display %   │
  │ /api/teams         │  │ /api/usage/depts/  │  │                    │
  │ /api/departments   │  │  [departmentId]    │  │ calcUsagePercent   │
  │                    │  │                    │  │  calls → cap ≤100  │
  │ cap in SQL:        │  │ cap in JS:         │  │  for individual    │
  │ LEAST(requests,    │  │ Math.min(total,    │  │  seat rendering    │
  │   premiumAllowance)│  │   premiumAllowance)│  │                    │
  └───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Key Design Decisions

1. **Cap at aggregation boundary, not at display**: Usage percentages are capped server-side (in API routes) where member contributions are aggregated. This ensures all consumers (frontend components, potential future API consumers) receive correct capped values without duplicating logic.

2. **Two-tier capping strategy**:
   - **SQL-level capping**: List routes (`/api/usage/teams`, `/api/usage/departments`, `/api/teams`, `/api/departments`) already aggregate per-member data via SQL CTEs. The cap is applied in the SQL using `LEAST(requests, $premiumAllowance)` in the aggregation CTE, producing a `cappedRequests` column used for `usagePercent` while keeping raw `totalRequests` for display.
   - **JS-level capping**: Detail routes (`/api/usage/teams/[teamId]`, `/api/usage/departments/[departmentId]`) already compute members in JS. The cap is applied via `Math.min(m.totalRequests, premiumRequestsPerSeat)` during the reduce step.

3. **New helper function `calcCappedUsagePercent`**: A thin helper in `usage-helpers.ts` that takes an array of per-member request totals, a cap value, and member count — returns the capped aggregate percentage. Used by the `TeamDetailPanel` frontend component which currently computes its own aggregate from the API response.

4. **`UsageProgressBar` caps display text at 100%**: The text label already shows `Math.round(percent)%`. It now caps at 100% to match the requirement that individual seat progress bars show only the capped percentage. The fill bar already caps at 100%.

5. **`calcUsagePercent` unchanged for single-seat use**: Individual seat percentages can still exceed 100% internally for colour coding (`getUsageColour` uses uncapped values for its thresholds), but `UsageProgressBar` and status display will show the capped value. The existing `calcUsagePercent` function is unmodified.

6. **Raw totals preserved**: All `totalRequests` fields in API responses remain uncapped. Only `usagePercent` reflects the per-seat cap.

### Data Model

No database schema changes required. All changes are computation-level in API route handlers and frontend helpers.

## Current Implementation Analysis

### Already Implemented
- `UsageProgressBar` already caps the fill bar width at `Math.min(percent, 100)` — but the text label shows uncapped percentage.
- `calcUsagePercent` correctly computes individual seat percentage with zero-division guard.
- All 6 API routes compute `usagePercent` but without per-member capping.
- Per-member breakdown data is already available in detail routes.

### To Be Modified
- `src/lib/usage-helpers.ts` — Add `calcCappedUsagePercent` helper function.
- `src/components/usage/UsageProgressBar.tsx` — Cap display text at 100%.
- `src/app/api/usage/teams/route.ts` — Cap per-member requests in SQL CTE before summing for `usagePercent`.
- `src/app/api/usage/departments/route.ts` — Cap per-member requests in SQL CTE before summing for `usagePercent`.
- `src/app/api/usage/teams/[teamId]/route.ts` — Cap per-member requests in JS aggregation.
- `src/app/api/usage/departments/[departmentId]/route.ts` — Cap per-member requests in JS aggregation.
- `src/app/api/teams/route.ts` — Cap per-member requests in SQL CTE before summing for `usagePercent`.
- `src/app/api/departments/route.ts` — Cap per-member requests in SQL CTE before summing for `usagePercent`.
- `src/components/usage/TeamDetailPanel.tsx` — Use capped aggregate data from API response instead of computing from raw totals.
- `src/lib/__tests__/usage-helpers.test.ts` — Add tests for the new helper function.
- `src/app/api/usage/teams/__tests__/route.test.ts` — Update existing tests and add capping-specific tests.
- `src/app/api/usage/departments/__tests__/route.test.ts` — Update existing tests and add capping-specific tests.
- `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts` — Add capping-specific tests.
- `src/app/api/usage/departments/[departmentId]/__tests__/route.test.ts` — Add capping-specific tests.
- E2E tests: `e2e/team-usage.spec.ts`, `e2e/department-usage.spec.ts`, `e2e/seat-usage.spec.ts` — Add capping scenarios.

### To Be Created
- No new files. All changes modify existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `getUsageColour` thresholds use capped or uncapped percentage? | Capped — colour indicators should reflect the capped value so a seat at 1000/300 shows green (100%) not green (333%). The colour is derived from the same capped percentage used for display. | ✅ Resolved |
| 2 | Should `DashboardPanel` most/least active users list show capped usage indicators? | Yes — Dashboard individual seat indicators use `calcUsagePercent` which feeds into `UsageStatusIndicator`. Since the status indicator receives the uncapped percent but the requirement says "capping applies everywhere usage % is shown", the `DashboardPanel` should also pass capped values. | ✅ Resolved |
| 3 | Should `totalRequests` in team/department detail API responses include both raw and capped? | API returns `totalRequests` (raw, uncapped) and `usagePercent` (computed from capped values). No separate `cappedTotalRequests` field needed — frontend uses `usagePercent` from API. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend Helpers & API Route Changes

#### Task 1.1 - [MODIFY] Add `calcCappedUsagePercent` helper to `usage-helpers.ts`
**Description**: Add a new helper function that computes an aggregate usage percentage by capping each member's contribution at a given allowance before summing. Also add a `capPercent` utility for single-seat display capping.

**Files to modify**:
- `src/lib/usage-helpers.ts`

**Detailed changes**:
- Add `calcCappedUsagePercent(memberRequests: number[], premiumRequestsPerSeat: number): number` — takes an array of per-member raw request counts, caps each at `premiumRequestsPerSeat`, sums the capped values, divides by `memberRequests.length * premiumRequestsPerSeat`, returns percentage (0 if no members or allowance is 0).

**Definition of Done**:
- [x] `calcCappedUsagePercent` function added and exported from `src/lib/usage-helpers.ts`
- [x] Function returns 0 when memberRequests is empty or premiumRequestsPerSeat is 0
- [x] Function caps each member's contribution at premiumRequestsPerSeat before summing
- [x] Example: `calcCappedUsagePercent([1000, 100], 300)` returns `(300 + 100) / (2 × 300) × 100 = 66.67`
- [x] Unit tests added in `src/lib/__tests__/usage-helpers.test.ts` covering: normal case, over-cap members, zero members, zero allowance, all under cap, all at exactly cap

#### Task 1.2 - [MODIFY] Cap per-member requests in `/api/usage/teams` SQL query
**Description**: Modify the teams usage list route to cap each member's requests at `premiumRequestsPerSeat` before aggregating for `usagePercent` computation. Keep raw `totalRequests` uncapped.

**Files to modify**:
- `src/app/api/usage/teams/route.ts`

**Detailed changes**:
- In the SQL CTE `team_aggregates`, add a `cappedTotalRequests` column: `COALESCE(SUM(LEAST(mu.requests, $3)), 0) AS "cappedTotalRequests"`, passing `premiumRequestsPerSeat` as the third SQL parameter.
- In the JS mapping, compute `usagePercent` from `cappedTotalRequests` instead of `totalRequests`:
  ```
  usagePercent = memberCount > 0 ? (cappedTotalRequests / (memberCount * premiumRequestsPerSeat)) * 100 : 0
  ```
- Keep `totalRequests` in the response unchanged (raw value) for display purposes.

**Definition of Done**:
- [x] SQL query uses `LEAST(mu.requests, $3)` to cap per-member requests in the aggregate
- [x] `usagePercent` in the API response is computed from capped totals
- [x] `totalRequests` in the API response remains the raw uncapped sum
- [x] Existing test "returns teams with aggregated usage metrics" updated if its assertion changes
- [x] New test: team with member exceeding cap → `usagePercent` reflects capped value (e.g., 2 members: 1000 and 100 requests, cap 300 → usagePercent ≈ 66.67%, totalRequests = 1100)
- [x] New test: all members under cap → `usagePercent` identical to uncapped calculation
- [x] All existing tests pass after the change

#### Task 1.3 - [MODIFY] Cap per-member requests in `/api/usage/departments` SQL query
**Description**: Apply the same SQL-level capping approach to the departments usage list route.

**Files to modify**:
- `src/app/api/usage/departments/route.ts`

**Detailed changes**:
- In the SQL CTE `dept_aggregates`, add `cappedTotalRequests` using `LEAST(su.requests, $3)` (the parameter `$3` already holds `premiumRequestsPerSeat` for the ORDER BY clause).
- Compute `usagePercent` from `cappedTotalRequests` instead of raw `totalRequests`.
- Keep `totalRequests` uncapped in the response.

**Definition of Done**:
- [x] SQL query uses `LEAST(su.requests, $3)` to cap per-seat requests
- [x] `usagePercent` computed from capped totals
- [x] `totalRequests` remains raw uncapped value
- [x] Existing test "usagePercent is correctly computed" updated to reflect capped behaviour
- [x] New test: department with member exceeding cap → `usagePercent` reflects capped value
- [x] All existing tests pass

#### Task 1.4 - [MODIFY] Cap per-member requests in `/api/usage/teams/[teamId]` JS aggregation
**Description**: In the team detail route, cap each member's `totalRequests` at `premiumRequestsPerSeat` when computing the team-level `totalRequests` used for `usagePercent`. The raw per-member `totalRequests` in the `members` array remains uncapped.

**Files to modify**:
- `src/app/api/usage/teams/[teamId]/route.ts`

**Detailed changes**:
- After building the `members` array, compute a `cappedTotalRequests`:
  ```
  const cappedTotalRequests = members.reduce(
    (sum, m) => sum + Math.min(m.totalRequests, premiumRequestsPerSeat), 0
  );
  ```
- Add `usagePercent` to the `team` object in the response:
  ```
  usagePercent: memberCount > 0
    ? (cappedTotalRequests / (memberCount * premiumRequestsPerSeat)) * 100
    : 0
  ```
- Keep `totalRequests` (raw uncapped) in the response for transparency.

**Definition of Done**:
- [x] `team` object in API response includes `usagePercent` computed from capped per-member totals
- [x] `team.totalRequests` remains the raw uncapped sum
- [x] Each member in `members` array retains their raw `totalRequests`
- [x] New test: team with one member at 1000 requests (cap 300) → `team.usagePercent` based on 300, `team.totalRequests` = 1000, `members[0].totalRequests` = 1000
- [x] All existing tests pass

#### Task 1.5 - [MODIFY] Cap per-member requests in `/api/usage/departments/[departmentId]` JS aggregation
**Description**: Apply the same JS-level capping to the department detail route.

**Files to modify**:
- `src/app/api/usage/departments/[departmentId]/route.ts`

**Detailed changes**:
- After building the `members` array, compute `cappedTotalRequests` using `Math.min(m.totalRequests, premiumRequestsPerSeat)`.
- Compute `usagePercent` from capped totals.
- Keep `totalRequests` uncapped.

**Definition of Done**:
- [x] `department.usagePercent` computed from capped per-member totals
- [x] `department.totalRequests` remains raw uncapped
- [x] Members array retains raw totals
- [x] New test: department with member exceeding cap → capped `usagePercent`
- [x] All existing tests pass

#### Task 1.6 - [MODIFY] Cap per-member requests in `/api/teams` management route SQL
**Description**: The team management route also computes `usagePercent` for display in the management table. Apply the same SQL capping.

**Files to modify**:
- `src/app/api/teams/route.ts`

**Detailed changes**:
- In the SQL CTE `member_usage`, no per-member cap is needed (the raw requests are computed per seat). In the aggregation query, add `COALESCE(SUM(LEAST(mu.requests, $3)), 0) AS "cappedTotalRequests"` alongside `totalRequests`.
- Pass `premiumRequestsPerSeat` as the third SQL parameter.
- Compute `usagePercent` from `cappedTotalRequests` in the JS mapping.

**Definition of Done**:
- [x] SQL query uses `LEAST(mu.requests, $3)` for capped aggregation
- [x] `usagePercent` in the response uses capped totals
- [x] Management table displays correct capped usage percentages
- [x] Existing tests pass (update test assertions if needed)

#### Task 1.7 - [MODIFY] Cap per-seat requests in `/api/departments` management route SQL
**Description**: The department management route also computes `usagePercent`. Apply SQL capping.

**Files to modify**:
- `src/app/api/departments/route.ts`

**Detailed changes**:
- In the SQL CTE `seat_usage`, cap has been computed per seat. In `dept_aggregates`, add `COALESCE(SUM(LEAST(su.requests, $3)), 0) AS "cappedTotalRequests"`.
- Pass `premiumRequestsPerSeat` as the third SQL parameter (it's already `$3` in the current ORDER BY; adjust parameter numbering accordingly).
- Compute `usagePercent` from `cappedTotalRequests`.

**Definition of Done**:
- [x] SQL query uses `LEAST(su.requests, $3)` for capping
- [x] `usagePercent` in response reflects capped values
- [x] Existing tests pass

### Phase 2: Frontend Component Changes

#### Task 2.1 - [MODIFY] Cap `UsageProgressBar` display text at 100%
**Description**: The progress bar's text label should show `Math.min(Math.round(percent), 100)%` instead of `Math.round(percent)%`, so individual seat progress bars with >100% display "100%" text.

**Files to modify**:
- `src/components/usage/UsageProgressBar.tsx`

**Detailed changes**:
- Change `const displayPercent = \`${Math.round(percent)}%\`;` to `const displayPercent = \`${Math.min(Math.round(percent), 100)}%\`;`

**Definition of Done**:
- [x] Progress bar text never displays more than 100%
- [x] Fill bar width remains capped at 100% (already the case)
- [x] `aria-valuenow` already caps at 100 (already the case)
- [x] `aria-label` uses the capped percentage text

#### Task 2.2 - [MODIFY] `TeamDetailPanel` uses `usagePercent` from API
**Description**: `TeamDetailPanel` currently computes `usagePercent` from `team.totalRequests` (uncapped raw total). It should use the new `team.usagePercent` field returned by the API, which is already capped.

**Files to modify**:
- `src/components/usage/TeamDetailPanel.tsx`

**Detailed changes**:
- Replace:
  ```tsx
  const usagePercent = team.memberCount > 0
    ? calcUsagePercent(team.totalRequests, team.memberCount * premiumRequestsPerSeat)
    : 0;
  ```
  With:
  ```tsx
  const usagePercent = team.usagePercent ?? 0;
  ```
- Remove the `calcUsagePercent` import if it's no longer used in this file.

**Definition of Done**:
- [x] `TeamDetailPanel` uses `team.usagePercent` from the API response
- [x] Progress bar shows the capped percentage
- [x] Raw `team.totalRequests` is still displayed in summary statistics (if shown)

#### Task 2.3 - [MODIFY] Cap `calcUsagePercent` callers for individual seat display
**Description**: For individual seat contexts (seat tables, dashboard users lists, seat detail, team member table), cap the percentage value at 100% before passing to `UsageStatusIndicator`. This ensures the colour indicator reflects the capped value.

**Files to modify**:
- `src/components/seats/SeatListPanel.tsx`
- `src/components/usage/SeatUsageTable.tsx`
- `src/components/usage/SeatDetailPanel.tsx`
- `src/components/usage/TeamMemberTable.tsx`
- `src/components/dashboard/DashboardPanel.tsx`

**Detailed changes**:
- In each file, after computing `usagePercent = calcUsagePercent(...)`, cap the value: `const cappedPercent = Math.min(usagePercent, 100);`
- Pass `cappedPercent` to `UsageStatusIndicator` and any display text.
- Keep calculating `usagePercent` uncapped for any raw display (e.g., `TeamMemberTable` shows "1000 / 300 (333%)" — this text should show the capped percentage: "1000 / 300 (100%)").

**Definition of Done**:
- [x] All individual seat status indicators use capped percentage (≤100%)
- [x] All individual seat percentage text display shows ≤100%
- [x] Raw request counts remain visible where shown (e.g., "1000 / 300")
- [x] Colour coding uses the capped value

### Phase 3: Test Coverage

#### Task 3.1 - [MODIFY] Unit tests for `usage-helpers.ts`
**Description**: Add unit tests for the new `calcCappedUsagePercent` function and verify existing `calcUsagePercent` tests still pass.

**Files to modify**:
- `src/lib/__tests__/usage-helpers.test.ts`

**Definition of Done**:
- [x] New `describe("calcCappedUsagePercent")` block with tests:
  - Empty array returns 0
  - Zero allowance returns 0
  - All members under cap returns correct percentage
  - Members exceeding cap are capped at allowance
  - Mixed under/over cap returns correct aggregate
  - Exact cap value is not reduced
  - Single member at exactly cap returns 100%
- [x] All existing tests pass unchanged

#### Task 3.2 - [MODIFY] Integration tests for usage API routes with capping scenarios
**Description**: Add integration tests that specifically verify the capping behaviour in all 4 usage API routes.

**Files to modify**:
- `src/app/api/usage/teams/__tests__/route.test.ts`
- `src/app/api/usage/departments/__tests__/route.test.ts`
- `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts`
- `src/app/api/usage/departments/[departmentId]/__tests__/route.test.ts`

**Definition of Done**:
- [x] Team list test: 2 members (1000 and 100 requests, cap 300) → `usagePercent ≈ 66.67`, `totalRequests = 1100`
- [x] Team detail test: member exceeding cap → `team.usagePercent` uses capped value, `members[*].totalRequests` stays raw
- [x] Department list test: equivalent capping scenario
- [x] Department detail test: equivalent capping scenario
- [x] Tests verify `totalRequests` is uncapped while `usagePercent` is capped
- [x] All existing tests updated where their assertions relied on uncapped `usagePercent` values (specifically test "usagePercent is correctly computed" in departments)
- [x] All tests pass

#### Task 3.3 - [MODIFY] E2E tests for capped usage display
**Description**: Add E2E test scenarios that seed data with individual usage exceeding the cap and verify the UI displays capped percentages.

**Files to modify**:
- `e2e/team-usage.spec.ts`
- `e2e/department-usage.spec.ts`
- `e2e/seat-usage.spec.ts`

**Definition of Done**:
- [x] Team usage E2E: seed team with member at 1000 requests (cap 300) → verify progress bar shows ≤100%, verify raw total is still visible
- [x] Department usage E2E: equivalent scenario
- [x] Seat usage E2E: seed seat with 500 requests (cap 300) → verify usage column shows 100% (not 167%)
- [x] All existing E2E tests pass

### Phase 4: Code Review

#### Task 4.1 - [REVIEW] Code review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [ ] All source code reviewed by `tsh-code-reviewer` agent
- [ ] No critical or high-severity issues remain unresolved
- [ ] All review feedback addressed or documented as intentional design decisions
- [ ] Code follows project conventions (naming, structure, formatting)
- [ ] Test coverage is adequate for the feature scope

## Security Considerations

- **No new security surface**: This change modifies computation logic only. No new API routes, no new user inputs, no database schema changes.
- **SQL parameter binding**: The `premiumRequestsPerSeat` value passed to `LEAST()` is provided via parameterised queries (`$3`), preventing SQL injection.
- **Input validation**: `premiumRequestsPerSeat` is read from the database via `getPremiumAllowance()` — no user-controllable override is possible.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] When calculating team usage percentage, each member's contribution is capped at `premiumRequestsPerSeat`
- [x] When calculating department usage percentage, each member's contribution is capped at `premiumRequestsPerSeat`
- [x] Individual seat usage percentage and progress bar are capped at 100%
- [x] Example scenario verified: Seat A = 1000, Seat B = 100, cap = 300 → usage = (300 + 100) / (2 × 300) = 67%, not 183%
- [x] The cap value uses the existing configurable `premiumRequestsPerSeat` from application settings
- [x] Capping applies everywhere usage % is shown: seat tables, team tables, department tables, detail page progress bars
- [x] `totalRequests` displayed in team/department summary views shows the raw uncapped total
- [x] On individual seat detail pages, the progress bar fills to 100% maximum and the text label shows only the percentage (capped at 100%)
- [x] All unit tests pass
- [x] All integration tests pass
- [x] All E2E tests pass
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Configurable cap behaviour**: Allow admins to toggle capping on/off per team or department.
- **Visual indicator for over-cap users**: Show a badge or icon when a member exceeds their allowance, even though the percentage is capped.
- **Historical cap tracking**: Track the `premiumRequestsPerSeat` value at the time of data collection to ensure historical usage percentages reflect the cap that was active at the time.
- **API response field for capped total**: Add an explicit `cappedTotalRequests` field to API responses so clients can distinguish between raw and capped aggregates.
- **DashboardPanel aggregate capping**: The dashboard summary metrics (org-level usage) are computed during data collection and stored in `dashboard_monthly_summary`. Capping these would require changes to the collection job — out of scope for this story.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
| 2026-03-02 | Implementation completed: Phase 1 (backend capping in 6 API routes + helper), Phase 2 (frontend capping in 7 components), Phase 3 (8 unit tests, 5 integration tests, 3 E2E tests). All 565 unit/integration tests pass, 47 E2E tests pass, clean TypeScript. |
| 2026-03-02 | Code review by tsh-code-reviewer: APPROVED with minor findings. Fixed M1 (removed dead `calcCappedUsagePercent` function — never used in production), M2 (removed unused `totalRequests` variables in management routes). Final: 557 tests pass, 47 E2E pass, clean TS. |
