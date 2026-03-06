# Most Active Users — Add Total Spending (grossAmount) - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Add total spending (grossAmount) to most active users on the dashboard |
| Description | Enhance the "Most Active Users" section on the dashboard to display not only request count (`totalRequests`) but also total spending per user, derived from `SUM(grossAmount)` across all usage items for the month. |
| Priority | Medium |
| Related Research | N/A — requirement from product owner |

## Proposed Solution

Add a `totalSpending` field (based on `SUM(grossAmount)`) to the `UserActivityEntry` interface and propagate it through the aggregation query, API response, stored JSONB summary, and frontend rendering.

**Data flow:**

```
copilot_usage.usageItems (JSONB)
  │
  ├── grossQuantity → SUM → totalRequests  (already exists)
  ├── grossAmount   → SUM → totalSpending  (NEW)
  │
  ▼
dashboard_monthly_summary.mostActiveUsers (JSONB)
  = [ { githubUsername, firstName, lastName, totalRequests, totalSpending } ]
  │
  ▼
GET /api/dashboard → { mostActiveUsers: [...] }
  │
  ▼
DashboardPanel.tsx → renders requests + spending per user
```

Since `mostActiveUsers` and `leastActiveUsers` are stored as JSONB columns, adding a new field to the JSON objects requires **no database migration**. Existing rows without `totalSpending` will simply have the field absent (treated as `undefined` in TypeScript) until the next recalculation.

The `grossAmount` field represents the total monetary value of requests _before_ discounts. This is the user's raw spending footprint, which is the most meaningful metric for ranking "most active" from a cost perspective.

## Current Implementation Analysis

### Already Implemented
- `UsageItem` interface — `src/entities/copilot-usage.entity.ts` — includes `grossAmount` field from the GitHub API
- `DashboardMonthlySummary` entity — `src/entities/dashboard-monthly-summary.entity.ts` — stores `mostActiveUsers` / `leastActiveUsers` as JSONB
- `refreshDashboardMetrics()` — `src/lib/dashboard-metrics.ts` — SQL aggregation for most/least active users already joins `copilot_usage` × `copilot_seat` and cross-joins `jsonb_array_elements()`; currently only aggregates `grossQuantity` as `totalRequests`
- Dashboard API route — `src/app/api/dashboard/route.ts` — passes `mostActiveUsers` through as-is
- `DashboardPanel` component — `src/components/dashboard/DashboardPanel.tsx` — renders most/least active users showing `totalRequests`
- Unit tests — `src/lib/__tests__/dashboard-metrics.test.ts` — validate most/least active user aggregation
- API route tests — `src/app/api/dashboard/__tests__/route.test.ts` — validate API response shape
- E2E tests — `e2e/dashboard.spec.ts` — validate dashboard renders most/least active users

### To Be Modified
- `UserActivityEntry` interface — `src/entities/dashboard-monthly-summary.entity.ts` — add `totalSpending: number` field
- `refreshDashboardMetrics()` — `src/lib/dashboard-metrics.ts` — add `SUM((item->>'grossAmount')::numeric) AS "totalSpending"` to both most active and least active user queries; map the new field in the result
- `DashboardPanel` component — `src/components/dashboard/DashboardPanel.tsx` — update `UserActivityEntry` interface and render `totalSpending` alongside `totalRequests` for most active users
- Unit tests — `src/lib/__tests__/dashboard-metrics.test.ts` — add assertions for `totalSpending` on most/least active users
- API route tests — `src/app/api/dashboard/__tests__/route.test.ts` — update seed data to include `totalSpending`; add assertions
- E2E tests — `e2e/dashboard.spec.ts` — update seed data to include `totalSpending`; add assertions for spending display

### To Be Created
- Nothing needs to be created from scratch — all changes are modifications to existing code.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should `totalSpending` also be added to least active users? | Yes — for consistency, both lists should carry the same data shape. The frontend can choose whether to display it. | ✅ Resolved |
| 2 | Does adding a field to the JSONB column require a migration? | No — JSONB is schema-less. Existing rows will be missing the field until recalculated, which is acceptable. | ✅ Resolved |
| 3 | Which amount field to use — `grossAmount` or `netAmount`? | `grossAmount` per the user's explicit requirement. This represents total spending before discounts. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Entity & Aggregation

#### Task 1.1 - [MODIFY] Add `totalSpending` to `UserActivityEntry` interface
**Description**: Add a `totalSpending: number` field to the `UserActivityEntry` interface in the dashboard monthly summary entity file. This field will hold `SUM(grossAmount)` for each user.

**Definition of Done**:
- [x] `UserActivityEntry` interface in `src/entities/dashboard-monthly-summary.entity.ts` includes `totalSpending: number`
- [x] No TypeScript compilation errors

#### Task 1.2 - [MODIFY] Update SQL queries in `refreshDashboardMetrics()` to aggregate `grossAmount`
**Description**: Modify the most active users (Section 3) and least active users (Section 4) raw SQL queries in `src/lib/dashboard-metrics.ts` to additionally `SELECT SUM((item->>'grossAmount')::numeric) AS "totalSpending"`. Update the TypeScript row type annotations and the `.map()` calls to include `totalSpending` in the resulting `UserActivityEntry[]`.

**Definition of Done**:
- [x] Most active users SQL query (Section 3) includes `SUM((item->>'grossAmount')::numeric) AS "totalSpending"` in the SELECT clause
- [x] Least active users SQL query (Section 4) includes `SUM((item->>'grossAmount')::numeric) AS "totalSpending"` in the SELECT clause
- [x] TypeScript row type for both queries includes `totalSpending: number`
- [x] `.map()` calls for both `mostActiveUsers` and `leastActiveUsers` include `totalSpending: Number(row.totalSpending)`
- [x] No TypeScript compilation errors

### Phase 2: Frontend — Display Spending

#### Task 2.1 - [MODIFY] Update `DashboardPanel` component to show spending for most active users
**Description**: Update the local `UserActivityEntry` interface in `DashboardPanel.tsx` to include `totalSpending`. In the "Most Active Users" list, render the spending amount below or next to the request count using the existing `formatCurrency()` helper.

**Definition of Done**:
- [x] `UserActivityEntry` interface in `DashboardPanel.tsx` includes `totalSpending: number`
- [x] Each most active user entry displays the total spending formatted as currency (e.g., `$125.50`) in addition to request count
- [x] The spending is rendered as a secondary line or inline detail, visually distinct from the request count
- [x] When `totalSpending` is `0` or `undefined` (for legacy data), the spending display gracefully handles the edge case (shows `$0.00` or omits the line)
- [x] No TypeScript compilation errors

### Phase 3: Tests — Unit, Integration, and E2E

#### Task 3.1 - [MODIFY] Update unit tests for `refreshDashboardMetrics()`
**Description**: Modify existing test cases in `src/lib/__tests__/dashboard-metrics.test.ts` to assert `totalSpending` is present and correct on `mostActiveUsers` and `leastActiveUsers` entries. The `makeUsageItem()` helper already produces `grossAmount`, so the aggregation can be validated against known seed data.

**Definition of Done**:
- [x] Test "correctly identifies top 5 most active users by request count" additionally asserts `totalSpending` is correct for `mostActiveUsers[0]` (e.g., `500 * 0.5 = 250`) and `mostActiveUsers[4]`
- [x] Test "correctly identifies bottom 5 least active users by request count" additionally asserts `totalSpending` is correct for `leastActiveUsers[0]` and `leastActiveUsers[4]`
- [x] Test "includes firstName and lastName in user activity entries" additionally asserts `totalSpending` is present and correct
- [x] Test "stores empty arrays and seatBaseCost spending when no usage data exists" still passes (empty arrays)
- [x] All existing tests pass without regressions

#### Task 3.2 - [MODIFY] Update API route tests
**Description**: Update seed data in `src/app/api/dashboard/__tests__/route.test.ts` to include `totalSpending` in `mostActiveUsers` and `leastActiveUsers` fixtures. Add assertions that the API response preserves the `totalSpending` field.

**Definition of Done**:
- [x] `seedSummary()` helper includes `totalSpending` in `mostActiveUsers` and `leastActiveUsers` entries
- [x] Test "returns stored summary data when row exists" asserts `mostActiveUsers[0].totalSpending` is present and correct
- [x] Test "returns valid response structure with all expected fields" implicitly validates the structure
- [x] All existing API route tests pass

#### Task 3.3 - [MODIFY] Update E2E tests for dashboard
**Description**: Update the E2E seed data in `e2e/dashboard.spec.ts` to include `totalSpending` in `mostActiveUsers` and `leastActiveUsers` JSON fixtures. Add assertions that the spending values are visible on the rendered dashboard.

**Definition of Done**:
- [x] `seedDashboardSummary()` includes `totalSpending` in each `mostActiveUsers` and `leastActiveUsers` entry
- [x] Test "dashboard displays most active users" asserts the spending amount (e.g., `$125.50`) is visible alongside the user
- [x] All existing E2E dashboard tests pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent to review all changes made in Phases 1–3, ensuring code quality, consistency, and adherence to project patterns.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer`
- [x] All review findings addressed or documented
- [x] No critical or high-severity issues remaining

## Security Considerations

- No new API endpoints are introduced; the existing `/api/dashboard` route remains behind `requireAuth()`.
- The `grossAmount` data is already stored in the database from the GitHub API and is not user-supplied — no new input vectors.
- JSONB column contents are not rendered with `dangerouslySetInnerHTML`; React auto-escapes values.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] `UserActivityEntry` interface includes `totalSpending: number`
- [x] `refreshDashboardMetrics()` stores `totalSpending` (from `SUM(grossAmount)`) in both `mostActiveUsers` and `leastActiveUsers` JSONB entries
- [x] The "Most Active Users" section on the dashboard displays the total spending for each user, formatted as currency
- [x] Unit tests in `dashboard-metrics.test.ts` validate `totalSpending` field presence and correctness
- [x] API route tests in `route.test.ts` validate `totalSpending` is returned in the response
- [x] E2E tests in `dashboard.spec.ts` validate that spending values are visible on the dashboard
- [x] Existing tests pass without regressions (no functionality broken by the change)
- [x] Legacy summary data without `totalSpending` doesn't cause runtime errors on the frontend

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- Add sorting toggle on the "Most Active Users" section: allow sorting by request count or spending.
- Add per-user drill-down view to see the full model-by-model breakdown of `grossAmount` per user per day.
- Consider adding `netAmount`-based spending alongside `grossAmount` (gross vs. net spending comparison) for a more complete cost picture.
- Add `totalSpending` display to the "Least Active Users" section on the frontend (data will be stored, just not rendered in this task).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed — all phases done, 281 unit tests + 8 E2E tests passing |
| 2026-02-28 | Code review by `tsh-code-reviewer` — Approved with 2 low-severity findings (F-01: naming ambiguity, F-02: type optionality) and 2 info-level observations. No action required. |
