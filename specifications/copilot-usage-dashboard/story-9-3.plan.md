# Show Premium Request Usage Percentage on Department Tables - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 9.3 |
| Title | Show premium request usage percentage on department tables |
| Description | Add department-level premium request usage percentage to department-related tables: the department management table and department usage analytics table. Percentage is calculated as `(sum of all department members' premium requests) / (number of department members × configurable allowance)`. Departments with no members display 0%. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 9, Story 9.3) |

## Proposed Solution

Add a `usagePercent` field to the `GET /api/departments` response and surface it as a new column in the **department management table** (`DepartmentManagementPanel`). The **department usage analytics table** (`DepartmentUsageTable`) and its backing API (`/api/usage/departments`) already compute and display `usagePercent` — those require no changes.

The approach mirrors the already-completed Story 9.2 pattern for teams, where `GET /api/teams` was enriched with current-month aggregated usage data using a CTE-based SQL query.

**Data flow:**

```
Configuration table (premiumRequestsPerSeat)
  ↓ read by getPremiumAllowance() helper
  ↓
/api/usage/departments  ────────────────→  DepartmentUsagePanel → DepartmentUsageTable (already shows Usage % column ✅)
  ↓ already computes usagePercent ✅
  ↓
/api/departments  ───────────────────────→  DepartmentManagementPanel (needs Usage % column ❌)
  ↓ currently returns only seatCount
  ↓ must be enriched with usagePercent
```

**Changes summary:**

| Location | Current State | Change Needed |
|---|---|---|
| Departments API (`/api/departments`) GET | Returns `{ id, name, seatCount, createdAt, updatedAt }` per department | Add current-month `usagePercent` per department and top-level `premiumRequestsPerSeat` |
| `DepartmentManagementPanel` | Columns: Name, Seats, Created, Actions (4 cols) | Add Usage % column (5 cols), update `colSpan` on edit row |
| Department usage API (`/api/usage/departments`) | Already returns `usagePercent` per department | No changes needed ✅ |
| `DepartmentUsageTable` | Already shows Usage % column | No changes needed ✅ |

**Calculation:**

```
usagePercent = memberCount > 0
  ? (totalRequests / (memberCount × premiumRequestsPerSeat)) × 100
  : 0
```

This matches the pattern in `src/app/api/teams/route.ts` (lines 72–76) and `src/app/api/usage/departments/route.ts` (lines 80–83).

## Current Implementation Analysis

### Already Implemented
- `getPremiumAllowance()` helper — `src/lib/get-premium-allowance.ts` — reads configurable allowance from Configuration table with fallback to 300
- `calcUsagePercent()` utility — `src/lib/usage-helpers.ts` — per-seat usage percentage calculation with division-by-zero guard
- `getUsageColour()` utility — `src/lib/usage-helpers.ts` — returns colour classes based on usage percentage thresholds (red ≤50%, orange 51–99%, green ≥100%)
- `Configuration` entity with `premiumRequestsPerSeat` — `src/entities/configuration.entity.ts` — already has the configurable field (default 300)
- Department usage API with `usagePercent` — `src/app/api/usage/departments/route.ts` — already computes and returns `usagePercent` per department; no modification needed
- `DepartmentUsagePanel` — `src/components/usage/DepartmentUsagePanel.tsx` — interface already includes `usagePercent`; fetches from `/api/usage/departments`
- `DepartmentUsageTable` — `src/components/usage/DepartmentUsageTable.tsx` — already renders Usage % column with `Math.round(dept.usagePercent)%`
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — CRUD panel with inline edit/delete
- Departments API — `src/app/api/departments/route.ts` — GET lists departments with `seatCount`, POST creates departments
- Departments API tests — `src/app/api/departments/__tests__/route.test.ts` — integration tests for GET and POST
- E2E department management tests — `e2e/department-management.spec.ts` — tests for department CRUD
- E2E department usage tests — `e2e/department-usage.spec.ts` — tests for department usage analytics
- `CopilotSeat` entity — `src/entities/copilot-seat.entity.ts` — has `departmentId` FK linking seats to departments
- `CopilotUsage` entity — `src/entities/copilot-usage.entity.ts` — has `usageItems` JSONB with `grossQuantity` per model
- Test helpers — `src/test/db-helpers.ts` — shared test data source and cleanup utilities
- Teams API enrichment (Story 9.2 reference) — `src/app/api/teams/route.ts` — exact pattern to follow for enriching department GET with usage data

### To Be Modified
- Departments API — `src/app/api/departments/route.ts` — enrich GET response with current-month `usagePercent` per department and top-level `premiumRequestsPerSeat`
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — add `usagePercent` to interface, add Usage % column to table, update `colSpan` from 4 to 5
- Departments API tests — `src/app/api/departments/__tests__/route.test.ts` — add assertions for `usagePercent` and `premiumRequestsPerSeat` in GET response
- E2E department management tests — `e2e/department-management.spec.ts` — add tests verifying Usage % column header and row values

### To Be Created
Nothing needs to be created from scratch. All changes are modifications to existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the department management table usage % use the current month or a user-selectable month? | Current month (auto-detected), same as the team management table (Story 9.2). The management table is not a usage analytics view — it shows at-a-glance current state. | ✅ Resolved |
| 2 | Does the department usage analytics table already show usage %? | Yes — `DepartmentUsageTable` already renders a Usage % column. The department usage API already returns `usagePercent`. No changes needed for the analytics side. | ✅ Resolved |
| 3 | Should `seatCount` in the department management table be renamed to `Members`? | No — departments use `seatCount` (direct FK from `copilot_seat.departmentId`) unlike teams which use `memberCount` from snapshots. Keep the existing column name for consistency. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Departments Management API Enrichment

#### Task 1.1 - [MODIFY] Enrich departments GET API with current-month `usagePercent`
**Description**: Modify `src/app/api/departments/route.ts` to enrich the department list response with current-month `usagePercent` per department and a top-level `premiumRequestsPerSeat` field. Replace the simple `COUNT(cs.id)` query with a CTE-based SQL query that also aggregates `grossQuantity` from `copilot_usage` for the current month. Import `getPremiumAllowance()` from `src/lib/get-premium-allowance.ts`. Follow the exact pattern from `src/app/api/teams/route.ts` (lines 17–80), adapted for the department data model which uses a direct FK (`copilot_seat.departmentId`) instead of snapshot tables.

The SQL should:
1. Select seats per department via `copilot_seat.departmentId IS NOT NULL`
2. LEFT JOIN `copilot_usage` for current month/year
3. Aggregate `grossQuantity` from JSONB `usageItems` per seat
4. Aggregate per department: `memberCount` (COUNT DISTINCT seats) and `totalRequests` (SUM)
5. LEFT JOIN back to `department` for departments with no seats (returning 0)

**Definition of Done**:
- [x] `getPremiumAllowance` imported and called at the start of the GET handler
- [x] SQL query replaced with CTE-based aggregation that computes per-department `totalRequests` from `copilot_usage.usageItems` for current month
- [x] Each department object in the response includes `usagePercent` field (number)
- [x] `usagePercent` calculated as `(totalRequests / (seatCount × premiumRequestsPerSeat)) × 100`
- [x] Departments with 0 seats return `usagePercent: 0`
- [x] Existing `seatCount` field preserved in response
- [x] Top-level response includes `premiumRequestsPerSeat` field
- [x] POST handler is not affected

#### Task 1.2 - [MODIFY] Update departments GET API tests for `usagePercent`
**Description**: Update `src/app/api/departments/__tests__/route.test.ts` to add test cases for the enriched GET response. Follow the test pattern from `src/app/api/teams/__tests__/route.test.ts` (lines 128–206). Import `CopilotUsageEntity` for seeding usage data.

Tests to add:
1. Each department includes `usagePercent` field (number type) — extend existing "returns departments ordered by name" test
2. Departments with seats and usage data return correct `usagePercent` — new test case
3. Departments with no seats return `usagePercent: 0` — extend existing "includes correct seatCount" test
4. Response includes top-level `premiumRequestsPerSeat` (defaults to 300)

**Definition of Done**:
- [x] Existing "returns departments ordered by name" test extended: asserts each department has `usagePercent` property of type `number`
- [x] Existing "includes correct seatCount per department" test extended: asserts `Empty` department has `usagePercent === 0`
- [x] New test: "departments with usage data return correct usagePercent" — seeds 2 seats in a department with known `grossQuantity` values in `copilot_usage`, asserts calculated percentage (e.g., 80 requests / (2 × 300) = 13.33%)
- [x] New test: "response includes premiumRequestsPerSeat" — asserts `json.premiumRequestsPerSeat === 300`
- [x] All existing tests still pass
- [x] All new tests pass

### Phase 2: Frontend — Department Management Table

#### Task 2.1 - [MODIFY] Add Usage % column to `DepartmentManagementPanel`
**Description**: Modify `src/components/departments/DepartmentManagementPanel.tsx` to display the `usagePercent` field returned by the enriched API. Follow the exact pattern from `src/components/teams/TeamManagementPanel.tsx` (lines 7–14, 383–386, 404, 477).

Changes:
1. Add `usagePercent: number` to the `DepartmentRecord` interface
2. Add a "Usage %" column header between "Seats" and "Created" in the `<thead>` section, with `text-right` alignment
3. Add the data cell rendering `{Math.round(dept.usagePercent)}%` with `text-right` alignment in the `<tbody>` section
4. Update `colSpan={4}` to `colSpan={5}` on the edit form row

**Definition of Done**:
- [x] `DepartmentRecord` interface includes `usagePercent: number`
- [x] Table header includes "Usage %" column (between Seats and Created)
- [x] "Usage %" header has `text-right` alignment matching the team management pattern
- [x] Each department row displays `{Math.round(dept.usagePercent)}%` in the Usage % column
- [x] Usage % cell has `text-right` alignment and consistent styling (`text-sm text-gray-700`)
- [x] Edit form row `colSpan` updated from 4 to 5
- [x] Table renders correctly with 5 columns (Name, Seats, Usage %, Created, Actions)

### Phase 3: E2E Tests

#### Task 3.1 - [MODIFY] Add E2E tests for Usage % column on department management table
**Description**: Modify `e2e/department-management.spec.ts` to add tests verifying the Usage % column appears in the department management table with correct values. Follow the exact test pattern from `e2e/team-management.spec.ts` (lines 129–167).

Add a `seedUsage` helper (following `e2e/team-management.spec.ts` pattern) and two tests:
1. "department management table displays Usage % column" — seeds a department with a seat and usage data, verifies the column header and correct percentage value
2. "department with no seats shows 0% usage" — seeds an empty department, verifies 0% is displayed

**Definition of Done**:
- [x] `seedUsage` helper function added to test file (seed `copilot_usage` rows)
- [x] Test: "department management table displays Usage % column" — seeds department, seat, and usage data; verifies `Usage %` column header visible; verifies correct percentage in row
- [x] Test: "department with no seats shows 0% usage" — seeds department without seats; verifies `0%` displayed in row
- [x] `clearAll` function updated to also clean `copilot_usage` table
- [x] All existing E2E tests still pass
- [x] All new E2E tests pass

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated code review
**Description**: Run the `tsh-code-reviewer` agent to verify implementation quality, adherence to project conventions, test coverage, and consistency with the team management table pattern (Story 9.2).

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed or documented as acceptable

## Security Considerations

- No new endpoints are introduced; changes are limited to enriching the existing authenticated `GET /api/departments` response.
- The `requireAuth` guard already protects the endpoint — no additional authentication changes needed.
- Usage data is aggregated at the department level; no individual-user-level sensitive data is exposed beyond what the existing seat list already shows.
- SQL parameters are passed as parameterised queries (`$1`, `$2`, `$3`) preventing SQL injection — same pattern as the teams API.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each department row in the department management table displays a Usage % column
- [x] Percentage is calculated as `(sum of all members' requests) / (number of members × configurable allowance)`
- [x] Percentage is shown on the department management table
- [x] Percentage is shown on the department usage analytics table (already implemented — verify still works)
- [x] Departments with no members display 0%
- [x] Unit tests cover correct percentage calculation, zero-member edge case, and `premiumRequestsPerSeat` in response
- [x] E2E tests verify Usage % column header visibility and correct row values
- [x] All existing tests pass without modification (backwards compatibility)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- Add sorting by Usage % column in the department management table (click column header to sort)
- Add a colour-coded indicator (square) next to department names in the management table — this is covered by Story 9.4
- Add a progress bar on the department detail page — this is covered by Story 9.5
- Consider caching the `premiumRequestsPerSeat` value to avoid repeated DB reads on every `/api/departments` GET request (current pattern reads from Configuration table on each call)

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation completed — all phases done, all tests pass |
| 2026-03-01 | Code review performed by tsh-code-reviewer. Verdict: APPROVE. 0 critical, 0 major, 2 minor (structural divergence from teams pattern — acceptable; pre-existing Seats column styling mismatch — out of scope), 2 nitpicks (inline import type verbosity — fixed; asymmetric E2E cleanup scope — acceptable). |
