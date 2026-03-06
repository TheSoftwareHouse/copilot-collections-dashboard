# Show Premium Request Usage Percentage on Team Tables - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 9.2 |
| Title | Show premium request usage percentage on team tables |
| Description | Add team-level premium request usage percentage to team-related tables: the team management table and team usage analytics table. Percentage is calculated as `(sum of all team members' premium requests) / (number of team members × configurable allowance)`. Teams with no members display 0%. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 9, Story 9.2) |

## Proposed Solution

Add a `usagePercent` field to the team usage API response and surface it in two places: the **team usage analytics table** (`TeamUsageTable`) and the **team management table** (`TeamManagementPanel`). The approach mirrors the existing department usage pattern (`/api/usage/departments`) which already returns `usagePercent` and `premiumRequestsPerSeat`.

**Data flow:**

```
Configuration table (premiumRequestsPerSeat)
  ↓ read by getPremiumAllowance() helper
  ↓
/api/usage/teams  ──────────────────────→  TeamUsagePanel → TeamUsageTable (shows Usage % column)
  ↓ computes usagePercent per team
  ↓ returns premiumRequestsPerSeat
  ↓
/api/teams  ─────────────────────────────→  TeamManagementPanel (shows Usage % column)
  ↓ enriched with current-month aggregated usage
  ↓ returns premiumRequestsPerSeat
```

**Changes summary:**

| Location | Current State | Change Needed |
|---|---|---|
| Team usage API (`/api/usage/teams`) | Returns `memberCount`, `totalRequests`, averages, spending — no `usagePercent`, no `premiumRequestsPerSeat` | Add `usagePercent` per team and `premiumRequestsPerSeat` to response |
| `TeamUsagePanel` | Interface lacks `usagePercent` and `premiumRequestsPerSeat` | Add fields to interface, pass to table |
| `TeamUsageTable` | Columns: Name, Members, Total Requests, Avg Requests/Member, Total Spending — no Usage % | Add Usage % column |
| Teams API (`/api/teams`) | Returns basic team data (id, name, timestamps) — no usage data | Add current-month `usagePercent` and `memberCount` per team |
| `TeamManagementPanel` | Columns: Name, Created, Actions — no usage data | Add Usage % column |

**Calculation:**

```
usagePercent = memberCount > 0
  ? (totalRequests / (memberCount × premiumRequestsPerSeat)) × 100
  : 0
```

This matches the department usage API pattern exactly (`src/app/api/usage/departments/route.ts` lines 80–83).

## Current Implementation Analysis

### Already Implemented
- `getPremiumAllowance()` helper — `src/lib/get-premium-allowance.ts` — reads configurable allowance from Configuration table with fallback to 300
- `calcUsagePercent()` utility — `src/lib/usage-helpers.ts` — per-seat usage percentage calculation with division-by-zero guard
- `getUsageColour()` utility — `src/lib/usage-helpers.ts` — returns colour classes based on usage percentage thresholds (red ≤50%, orange 51–99%, green ≥100%)
- `Configuration` entity with `premiumRequestsPerSeat` — `src/entities/configuration.entity.ts` — already has the configurable field (default 300)
- Department usage API with `usagePercent` — `src/app/api/usage/departments/route.ts` — reference implementation for team-level usage percentage pattern
- `TeamUsagePanel` — `src/components/usage/TeamUsagePanel.tsx` — fetches from `/api/usage/teams`, renders `TeamUsageTable`
- `TeamUsageTable` — `src/components/usage/TeamUsageTable.tsx` — renders team rows with links to team detail pages
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — CRUD panel for teams with inline edit/delete
- Team usage API — `src/app/api/usage/teams/route.ts` — aggregates member usage per team with SQL CTEs
- Teams API — `src/app/api/teams/route.ts` — basic CRUD for teams (GET lists, POST creates)
- `DepartmentUsageTable` — `src/components/usage/DepartmentUsageTable.tsx` — reference for how Usage % column is shown (displays `Math.round(dept.usagePercent)%`)
- Team usage API tests — `src/app/api/usage/teams/__tests__/route.test.ts` — integration tests for aggregated team usage
- E2E team usage tests — `e2e/team-usage.spec.ts` — tests for team usage tab and team detail page
- E2E team management tests — `e2e/team-management.spec.ts` — tests for team CRUD
- Test helpers — `src/test/db-helpers.ts` — shared test data source and cleanup utilities

### To Be Modified
- Team usage API — `src/app/api/usage/teams/route.ts` — add `usagePercent` per team and `premiumRequestsPerSeat` to response
- Teams API — `src/app/api/teams/route.ts` — add current-month team-level `usagePercent`, `memberCount`, and `premiumRequestsPerSeat` to GET response
- `TeamUsagePanel` — `src/components/usage/TeamUsagePanel.tsx` — add `usagePercent` to `TeamUsageEntry` interface, pass `premiumRequestsPerSeat` through
- `TeamUsageTable` — `src/components/usage/TeamUsageTable.tsx` — add Usage % column to table
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — add Usage % column, fetch and display team-level usage percentage
- Team usage API tests — `src/app/api/usage/teams/__tests__/route.test.ts` — add assertions for `usagePercent` and `premiumRequestsPerSeat`
- E2E team usage tests — `e2e/team-usage.spec.ts` — verify Usage % column appears in team usage table
- E2E team management tests — `e2e/team-management.spec.ts` — verify Usage % column appears in team management table

### To Be Created
- Teams API tests — `src/app/api/teams/__tests__/route.test.ts` — integration tests for enriched GET response with `usagePercent`

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the team management table usage % use the current month or a user-selectable month? | Current month (auto-detected), same as the seat management table approach from Story 9.1. The management table is not a usage analytics view — it shows at-a-glance current state. | ✅ Resolved |
| 2 | Should the team management table sort by usage %? | No — the management table sorts by name ASC. Sorting by usage % is better suited for the usage analytics table. Out of scope. | ✅ Resolved |
| 3 | Should soft-deleted teams show usage %? | No — soft-deleted teams are already excluded from the GET response (`WHERE deletedAt IS NULL`). No change needed. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Team Usage API Enrichment

#### Task 1.1 - [MODIFY] Add `usagePercent` and `premiumRequestsPerSeat` to team usage API response
**Description**: Modify `src/app/api/usage/teams/route.ts` to import and call `getPremiumAllowance()`, compute `usagePercent` per team using the formula `(totalRequests / (memberCount × premiumRequestsPerSeat)) × 100` (0 if no members), and include both `usagePercent` per team and `premiumRequestsPerSeat` in the JSON response. Follow the exact pattern used in `src/app/api/usage/departments/route.ts`.

**Definition of Done**:
- [x] `getPremiumAllowance` imported and called at the start of the GET handler
- [x] Each team object in the response includes a `usagePercent` field (number)
- [x] `usagePercent` calculated as `(totalRequests / (memberCount × premiumRequestsPerSeat)) × 100`
- [x] Teams with 0 members return `usagePercent: 0`
- [x] Top-level response includes `premiumRequestsPerSeat` field
- [x] Existing tests still pass

#### Task 1.2 - [MODIFY] Update team usage API tests for `usagePercent` and `premiumRequestsPerSeat`
**Description**: Update `src/app/api/usage/teams/__tests__/route.test.ts` to assert that each team in the response includes `usagePercent` (correct calculation) and the response includes `premiumRequestsPerSeat`. Add a specific test case for teams with 0 members returning 0% and a test verifying the percentage calculation matches the formula.

**Definition of Done**:
- [x] Existing "returns teams with aggregated usage metrics" test extended with `usagePercent` assertion (e.g., 80 requests / (2 × 300) = 13.3%)
- [x] Existing "team with no members" test asserts `usagePercent` is 0
- [x] Existing "team with members but no usage data" test asserts `usagePercent` is 0
- [x] Response-level `premiumRequestsPerSeat` field asserted (defaults to 300)
- [x] All tests pass

### Phase 2: Backend — Teams Management API Enrichment

#### Task 2.1 - [MODIFY] Enrich teams GET API with current-month `usagePercent`
**Description**: Modify `src/app/api/teams/route.ts` to enrich the team list response with current-month `usagePercent` and `memberCount` per team, plus a top-level `premiumRequestsPerSeat` field. Use the same CTE-based SQL pattern as the team usage API to compute aggregated premium request usage for the current month. Import `getPremiumAllowance()` from `src/lib/get-premium-allowance.ts`.

**Definition of Done**:
- [x] GET response includes `usagePercent` (number) and `memberCount` (number) per team object
- [x] Top-level response includes `premiumRequestsPerSeat` field
- [x] `usagePercent` calculation uses current month/year (auto-detected from UTC)
- [x] Teams with 0 members for the current month return `usagePercent: 0`
- [x] Soft-deleted teams remain excluded from the response
- [x] POST handler is not affected

#### Task 2.2 - [CREATE] Teams GET API integration tests for `usagePercent`
**Description**: Create `src/app/api/teams/__tests__/route.test.ts` with integration tests for the enriched GET response. Tests should cover: teams with usage data returning correct `usagePercent`, teams with no members returning 0%, response including `premiumRequestsPerSeat`, and 401 without session. Follow the testing pattern from `src/app/api/usage/teams/__tests__/route.test.ts`.

**Definition of Done**:
- [x] Test file created at `src/app/api/teams/__tests__/route.test.ts`
- [x] Test: returns 401 without session
- [x] Test: returns empty list when no teams exist
- [x] Test: each team includes `usagePercent` and `memberCount` fields
- [x] Test: teams with members and usage return correct `usagePercent` (e.g., 80 requests / (2 × 300) = 13.3%)
- [x] Test: teams with no members return `usagePercent: 0` and `memberCount: 0`
- [x] Test: response includes `premiumRequestsPerSeat` (defaults to 300)
- [x] All tests pass

### Phase 3: Frontend — Team Usage Analytics Table

#### Task 3.1 - [MODIFY] Update `TeamUsagePanel` interface with `usagePercent`
**Description**: Add `usagePercent` to the `TeamUsageEntry` interface in `src/components/usage/TeamUsagePanel.tsx` and update the `TeamUsageResponse` interface to include `premiumRequestsPerSeat`. Pass both through to `TeamUsageTable`.

**Definition of Done**:
- [x] `TeamUsageEntry` interface includes `usagePercent: number`
- [x] `TeamUsageResponse` interface includes `premiumRequestsPerSeat?: number`
- [x] `TeamUsageTable` receives `premiumRequestsPerSeat` prop from panel
- [x] TypeScript compiles without errors

#### Task 3.2 - [MODIFY] Add Usage % column to `TeamUsageTable`
**Description**: Add a "Usage %" column to `src/components/usage/TeamUsageTable.tsx`, displaying `Math.round(team.usagePercent)%` for each team. Follow the same pattern used in `DepartmentUsageTable` (`src/components/usage/DepartmentUsageTable.tsx`). The column should be placed after "Total Spending" or after "Avg Requests/Member" for easy comparison.

**Definition of Done**:
- [x] New `<th>` header "Usage %" added to the table header row
- [x] Each team row displays `Math.round(team.usagePercent)%` in the new column
- [x] Column is right-aligned (matching other numeric columns)
- [x] Cell is wrapped in a `Link` component like other cells (for row-click navigation)
- [x] Teams with 0% show "0%"
- [x] TypeScript compiles without errors

### Phase 4: Frontend — Team Management Table

#### Task 4.1 - [MODIFY] Add `usagePercent` display to `TeamManagementPanel`
**Description**: Modify `src/components/teams/TeamManagementPanel.tsx` to use the enriched `usagePercent` and `memberCount` fields from the updated `/api/teams` response and display a "Usage %" column in the team list table. Update the `TeamRecord` interface to include `usagePercent` and `memberCount`. Follow the same display pattern: `Math.round(usagePercent)%`.

**Definition of Done**:
- [x] `TeamRecord` interface includes `usagePercent: number` and `memberCount: number`
- [x] `fetchTeams` callback maps `usagePercent` and `memberCount` from API response
- [x] Table header includes "Members" and "Usage %" columns
- [x] Each non-editing team row displays `memberCount` and `Math.round(usagePercent)%`
- [x] Teams with 0% show "0%"
- [x] Edit mode `<td colSpan>` updated to match new column count
- [x] TypeScript compiles without errors

### Phase 5: E2E Tests

#### Task 5.1 - [MODIFY] Update team usage E2E tests for Usage % column
**Description**: Update `e2e/team-usage.spec.ts` to verify the Usage % column appears in the team usage analytics table. Extend the existing "Team tab shows teams with aggregated usage metrics" test to assert the presence of a usage percentage value. Add a test for teams with no members displaying "0%".

**Definition of Done**:
- [x] Existing "Team tab shows teams with aggregated usage metrics" test verifies presence of usage percentage (e.g., check for "50%" when 300 requests / (2 × 300) = 50%)
- [x] Existing "teams with no members display zero usage" test verifies "0%" is displayed
- [x] All E2E tests pass

#### Task 5.2 - [MODIFY] Update team management E2E tests for Usage % column
**Description**: Update `e2e/team-management.spec.ts` to verify the Usage % column appears in the team management table. Add a test case that creates a team with members and usage data and verifies the percentage is displayed. Verify teams with no usage show "0%".

**Definition of Done**:
- [x] New test or extended test verifies "Usage %" header visible in team management table
- [x] Test verifies correct percentage value for a team with known usage data
- [x] Test verifies a team with no members shows "0%"
- [x] All E2E tests pass

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run code review using the `tsh-code-reviewer` agent to verify all changes align with project patterns, accessibility standards, and testing coverage.

**Definition of Done**:
- [x] All modified and created files reviewed
- [x] No critical or high-severity issues found
- [x] Code follows existing patterns (department usage for reference)
- [x] All tests (unit, integration, E2E) pass

## Security Considerations

- No new authentication or authorisation concerns — all modified endpoints already use `requireAuth()` and `isAuthFailure()` guards
- The `premiumRequestsPerSeat` value is read from the shared configuration table using an existing helper, not from user input on these endpoints
- SQL queries use parameterised inputs ($1, $2, $3) preventing injection — no changes to query parameterisation approach needed

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each team row in team management table displays a usage percentage
- [x] Each team row in team usage analytics table displays a usage percentage
- [x] Percentage is calculated as `(sum of all members' requests) / (number of members × configurable allowance)`
- [x] Percentage is shown on team management table and team usage analytics table
- [x] Teams with no members display 0%
- [x] Usage percentage updates when the selected month changes (team usage analytics table)
- [x] Integration tests cover `usagePercent` and `premiumRequestsPerSeat` in both API responses
- [x] E2E tests verify Usage % column visibility and correct values in both tables
- [x] All existing tests continue to pass after modifications

## Improvements (Out of Scope)

- **Sortable Usage % column**: Allow sorting teams by usage percentage in both tables — would require SQL ORDER BY changes and UI sort controls
- **Usage % colour indicator on team tables**: Story 9.4 will add colour-coded squares next to team names — should be implemented after this story
- **Usage % on team detail summary cards**: The team detail page (`TeamDetailPanel`) shows summary cards (Total Requests, Total Spending) but no team-level usage percentage card — could be added for consistency
- **Caching getPremiumAllowance()**: The helper reads from the database on every API call; a short TTL cache could reduce DB reads in high-traffic scenarios

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
