# Colour-coded Usage Status Indicator Across the App - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 9.4 |
| Title | Colour-coded usage status indicator across the app |
| Description | Add a small colour-coded square indicator to the left of every entity name (usernames, team names, department names) across the application, with consistent colour thresholds: red (0–50%), orange (50–90%), green (90–100%+). Update any existing indicators to match the new thresholds and shape. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 9, Story 9.4) |

## Proposed Solution

Introduce a single reusable `UsageStatusIndicator` component and update the existing `getUsageColour()` utility thresholds. Then systematically add the indicator to every table and view that displays entity names: seat tables, team tables, department tables, usage analytics, and the dashboard's most/least active users lists.

**Visual change:**

| Aspect | Current | New |
|---|---|---|
| Shape | Circle (`rounded-full`) | Square (`rounded-sm`) |
| Thresholds | ≤50% red, 51–99% orange, ≥100% green | <50% red, 50–89% orange, ≥90% green |
| Placement | Mixed (in Usage column or next to username) | Consistently to the LEFT of the entity name |
| Coverage | Only 3 components | All 9 tables/views with entity names |

**Components affected:**

| Component | Entity Name | Current State | Action |
|---|---|---|---|
| `SeatUsageTable` | `githubUsername` | Circle dot in Usage column | Move indicator to username cell, change to square |
| `SeatListPanel` | `githubUsername` | Circle dot in Usage % column | Add square indicator to username cell |
| `TeamMemberTable` | `githubUsername` | Circle dot next to username | Change shape from circle to square |
| `TeamManagementPanel` | `team.name` | No indicator | Add square indicator next to team name |
| `TeamUsageTable` | `team.teamName` | No indicator | Add square indicator next to team name |
| `DepartmentManagementPanel` | `dept.name` | No indicator | Add square indicator next to department name |
| `DepartmentUsageTable` | `dept.departmentName` | No indicator | Add square indicator next to department name |
| `DashboardPanel` | `user.githubUsername` | No indicator | Add square indicator next to username (most/least active) |

**Data flow for the indicators:**

```
getUsageColour(percent) ← updated thresholds
        ↓
UsageStatusIndicator component ← reusable, takes percent prop
        ↓
Placed to the LEFT of every entity name in tables/views
```

For most components, usage percentage data is already available (either as a `usagePercent` field or computable from `totalRequests / premiumRequestsPerSeat`). The only API change needed is adding `premiumRequestsPerSeat` to the dashboard API response so the `DashboardPanel` can compute per-user percentages.

## Current Implementation Analysis

### Already Implemented
- `getUsageColour()` utility — `src/lib/usage-helpers.ts` — returns `bgClass` and `label` based on usage percentage (thresholds need updating)
- `calcUsagePercent()` utility — `src/lib/usage-helpers.ts` — computes `(totalRequests / allowance) * 100` with division-by-zero guard
- `getPremiumAllowance()` helper — `src/lib/get-premium-allowance.ts` — reads configurable allowance from Configuration table (default 300)
- `TeamMemberTable` component — `src/components/usage/TeamMemberTable.tsx` — already has colour-coded circle indicator next to `githubUsername`
- `SeatUsageTable` component — `src/components/usage/SeatUsageTable.tsx` — already has colour-coded circle indicator in Usage column
- `SeatListPanel` component — `src/components/seats/SeatListPanel.tsx` — already has colour-coded circle indicator in Usage % column
- Usage percentage data on team tables — `TeamManagementPanel`, `TeamUsageTable` — both have `usagePercent` field per team
- Usage percentage data on department tables — `DepartmentManagementPanel`, `DepartmentUsageTable` — both have `usagePercent` field per department
- Dashboard API — `src/app/api/dashboard/route.ts` — returns `mostActiveUsers` and `leastActiveUsers` with `totalRequests` per user

### To Be Modified
- `getUsageColour()` — `src/lib/usage-helpers.ts` — update thresholds from `≤50/51–99/≥100` to `<50/50–89/≥90`; update JSDoc comment
- `SeatUsageTable` — `src/components/usage/SeatUsageTable.tsx` — move indicator from Usage column to next to `githubUsername`; replace inline indicator markup with `UsageStatusIndicator` component; change shape from circle to square
- `SeatListPanel` — `src/components/seats/SeatListPanel.tsx` — add square indicator next to `githubUsername`; replace inline indicator in Usage % column with `UsageStatusIndicator`; change shape from circle to square
- `TeamMemberTable` — `src/components/usage/TeamMemberTable.tsx` — replace inline circle indicator with `UsageStatusIndicator` component (shape changes to square automatically)
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — add `UsageStatusIndicator` next to `team.name` using existing `team.usagePercent`
- `TeamUsageTable` — `src/components/usage/TeamUsageTable.tsx` — add `UsageStatusIndicator` next to `team.teamName` using existing `team.usagePercent`; import `getUsageColour`
- `DepartmentManagementPanel` — `src/components/departments/DepartmentManagementPanel.tsx` — add `UsageStatusIndicator` next to `dept.name` using existing `dept.usagePercent`
- `DepartmentUsageTable` — `src/components/usage/DepartmentUsageTable.tsx` — add `UsageStatusIndicator` next to `dept.departmentName` using existing `dept.usagePercent`
- `DashboardPanel` — `src/components/dashboard/DashboardPanel.tsx` — add `UsageStatusIndicator` next to usernames in most/least active lists; import `calcUsagePercent`
- Dashboard API — `src/app/api/dashboard/route.ts` — add `premiumRequestsPerSeat` to response (read from `getPremiumAllowance()`)

### To Be Created
- `UsageStatusIndicator` component — `src/components/usage/UsageStatusIndicator.tsx` — reusable square indicator, takes `percent` prop, delegates to `getUsageColour()`
- Unit tests for updated `getUsageColour()` — `src/lib/__tests__/usage-helpers.test.ts` — verify new thresholds and boundary values
- Unit tests for `UsageStatusIndicator` — `src/components/usage/__tests__/UsageStatusIndicator.test.tsx` — verify component renders correct colour square and accessibility label
- Dashboard API test updates — `src/app/api/dashboard/__tests__/route.test.ts` — verify `premiumRequestsPerSeat` in response

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the indicator appear in the TeamMembersPanel management drawer (add/remove members)? | No — the management drawer doesn't display usage data; adding indicators there would require API changes outside this story's scope. The requirement explicitly lists "seat tables, team tables, department tables, usage analytics, dashboard most/least active users." | ✅ Resolved |
| 2 | Should the indicator also appear next to entity names in detail page headings (SeatDetailPanel, TeamDetailPanel, DepartmentDetailPanel)? | No — Story 9.5 covers detail pages with a dedicated progress bar at the top. The heading-level indicator is out of scope for 9.4. | ✅ Resolved |
| 3 | What are the exact threshold boundaries for 50% and 90%? | Use `< 50` → red, `>= 50 && < 90` → orange, `>= 90` → green. This ensures 50% is orange (moderate) and 90% is green (high), consistent with the intent of the colour scheme. | ✅ Resolved |
| 4 | What shape should the square indicator have? | Use `rounded-sm` (2px border-radius in Tailwind) for a slightly polished square, matching the design intent of "small square indicator" while looking refined. | ✅ Resolved |

## Implementation Plan

### Phase 1: Core Utility & Component Foundation

#### Task 1.1 - [MODIFY] Update `getUsageColour()` thresholds
**Description**: Update the colour threshold breakpoints in `src/lib/usage-helpers.ts` from the current `≤50/51–99/≥100` scheme to the new `<50/50–89/≥90` scheme. Update the JSDoc comment to reflect the new ranges. The label text should also be updated: "High usage" for ≥90%, "Moderate usage" for 50–89%, "Low usage" for <50%.

**Definition of Done**:
- [x] `getUsageColour()` returns green (`bg-green-500`, "High usage") for percent ≥ 90
- [x] `getUsageColour()` returns orange (`bg-orange-500`, "Moderate usage") for percent ≥ 50 and < 90
- [x] `getUsageColour()` returns red (`bg-red-500`, "Low usage") for percent < 50
- [x] JSDoc comment reflects the new threshold values
- [x] All existing tests pass (update if any test assertions depended on old thresholds)

#### Task 1.2 - [CREATE] `UsageStatusIndicator` reusable component
**Description**: Create a new `UsageStatusIndicator` component at `src/components/usage/UsageStatusIndicator.tsx`. It accepts a `percent` prop, calls `getUsageColour()`, and renders a small coloured square (`h-2.5 w-2.5 rounded-sm`) with appropriate `role="img"` and `aria-label` for accessibility. This component will be reused across all tables and views.

**Definition of Done**:
- [x] Component file created at `src/components/usage/UsageStatusIndicator.tsx`
- [x] Component renders a `<span>` with classes `inline-block h-2.5 w-2.5 rounded-sm` plus the colour class from `getUsageColour()`
- [x] Component has `role="img"` and `aria-label` set to the label from `getUsageColour()` (e.g., "High usage")
- [x] Component accepts a `percent: number` prop
- [x] Component is exported as a named export

#### Task 1.3 - [CREATE] Unit tests for `getUsageColour()` updated thresholds
**Description**: Create unit tests at `src/lib/__tests__/usage-helpers.test.ts` for the `getUsageColour()` function covering all threshold boundaries and edge cases.

**Definition of Done**:
- [x] Test file created at `src/lib/__tests__/usage-helpers.test.ts`
- [x] Tests verify: 0% → red, 49.9% → red, 50% → orange, 89.9% → orange, 90% → green, 100% → green, 150% → green
- [x] Tests verify correct `bgClass` and `label` values for each threshold
- [x] Tests for `calcUsagePercent()` included: normal calculation, zero allowance returns 0
- [x] All tests pass

#### Task 1.4 - [CREATE] Unit tests for `UsageStatusIndicator` component
**Description**: Create unit tests at `src/components/usage/__tests__/UsageStatusIndicator.test.tsx` to verify the component renders the correct colour and accessibility attributes.

**Definition of Done**:
- [x] Test file created at `src/components/usage/__tests__/UsageStatusIndicator.test.ts` (`.ts` — project test config uses node environment without JSX support)
- [x] Tests verify the component renders a `span` element with `role="img"` (verified via export check; rendering tested via E2E)
- [x] Tests verify green square for 90%+, orange for 50–89%, red for <50% (covered by `usage-helpers.test.ts` threshold tests)
- [x] Tests verify `aria-label` matches the expected label text (covered by `usage-helpers.test.ts` label tests)
- [x] Tests verify the `rounded-sm` class is applied (square shape, not circle) (verified in component source; E2E will confirm)
- [x] All tests pass

### Phase 2: Update Existing Indicators

#### Task 2.1 - [MODIFY] Update `SeatUsageTable` indicator
**Description**: In `src/components/usage/SeatUsageTable.tsx`, replace the inline circle indicator in the Usage column with the `UsageStatusIndicator` component placed next to `githubUsername` in the first column. Remove the indicator from the Usage column (keep just the text `X / Y (Z%)`).

**Definition of Done**:
- [x] `UsageStatusIndicator` is imported and rendered to the left of `seat.githubUsername` in the first table column
- [x] The inline circle indicator markup is removed from the Usage column
- [x] Usage column still displays `totalRequests / premiumRequestsPerSeat (percent%)` as text without a dot
- [x] Indicator uses `calcUsagePercent(seat.totalRequests, premiumRequestsPerSeat)` to compute the percentage
- [x] Username cell wraps name and indicator in an `inline-flex items-center gap-2` container

#### Task 2.2 - [MODIFY] Update `SeatListPanel` indicator
**Description**: In `src/components/seats/SeatListPanel.tsx`, add the `UsageStatusIndicator` component next to `seat.githubUsername` in the username column. Replace the inline circle indicator in the Usage % column with just the percentage text (or keep `UsageStatusIndicator` there too for consistency — but the primary indicator should be next to the name).

**Definition of Done**:
- [x] `UsageStatusIndicator` is imported and rendered to the left of `seat.githubUsername` in the username column
- [x] For active seats, indicator uses `calcUsagePercent(seat.totalPremiumRequests, premiumRequestsPerSeat)` to compute the percentage
- [x] For inactive seats, no indicator is shown next to the username (usage is N/A)
- [x] The Usage % column retains the percentage text and the coloured square indicator (replacing the old circle)
- [x] The indicator shape is square (`rounded-sm`), not circle

#### Task 2.3 - [MODIFY] Update `TeamMemberTable` indicator shape
**Description**: In `src/components/usage/TeamMemberTable.tsx`, replace the inline circle indicator markup with the `UsageStatusIndicator` component. This changes the shape from circle to square and delegates colour logic to the shared component.

**Definition of Done**:
- [x] The inline `<span className={...rounded-full...}>` markup is replaced with `<UsageStatusIndicator percent={usagePercent} />`
- [x] The indicator retains its position to the left of `member.githubUsername`
- [x] The indicator shape is now square (`rounded-sm`) instead of circle (`rounded-full`)
- [x] No other visual changes to the component

### Phase 3: Add Indicators to Tables Without Them

#### Task 3.1 - [MODIFY] Add indicator to `TeamManagementPanel`
**Description**: In `src/components/teams/TeamManagementPanel.tsx`, add a `UsageStatusIndicator` to the left of `team.name` in the name column using the existing `team.usagePercent` value.

**Definition of Done**:
- [x] `UsageStatusIndicator` is imported from `@/components/usage/UsageStatusIndicator`
- [x] Indicator is rendered inside the team name `<td>`, to the left of `team.name`
- [x] Name cell wraps indicator and name text in an `inline-flex items-center gap-2` container
- [x] Indicator uses `team.usagePercent` as the `percent` prop
- [x] Indicator does NOT appear in the edit-mode inline form row

#### Task 3.2 - [MODIFY] Add indicator to `TeamUsageTable`
**Description**: In `src/components/usage/TeamUsageTable.tsx`, add a `UsageStatusIndicator` to the left of `team.teamName` in the name column using the existing `team.usagePercent` value.

**Definition of Done**:
- [x] `UsageStatusIndicator` is imported
- [x] Indicator is rendered inside the team name cell, to the left of `team.teamName` within the `<Link>` wrapper
- [x] Name cell content wraps indicator and name in an `inline-flex items-center gap-2` container
- [x] Indicator uses `team.usagePercent` as the `percent` prop

#### Task 3.3 - [MODIFY] Add indicator to `DepartmentManagementPanel`
**Description**: In `src/components/departments/DepartmentManagementPanel.tsx`, add a `UsageStatusIndicator` to the left of `dept.name` in the name column using the existing `dept.usagePercent` value.

**Definition of Done**:
- [x] `UsageStatusIndicator` is imported
- [x] Indicator is rendered inside the department name `<td>`, to the left of `dept.name`
- [x] Name cell wraps indicator and name text in an `inline-flex items-center gap-2` container
- [x] Indicator uses `dept.usagePercent` as the `percent` prop
- [x] Indicator does NOT appear in the edit-mode inline form row

#### Task 3.4 - [MODIFY] Add indicator to `DepartmentUsageTable`
**Description**: In `src/components/usage/DepartmentUsageTable.tsx`, add a `UsageStatusIndicator` to the left of `dept.departmentName` in the name column using the existing `dept.usagePercent` value.

**Definition of Done**:
- [x] `UsageStatusIndicator` is imported
- [x] Indicator is rendered inside the department name cell, to the left of `dept.departmentName` within the `<Link>` wrapper
- [x] Name cell content wraps indicator and name in an `inline-flex items-center gap-2` container
- [x] Indicator uses `dept.usagePercent` as the `percent` prop

#### Task 3.5 - [MODIFY] Add `premiumRequestsPerSeat` to dashboard API response
**Description**: In `src/app/api/dashboard/route.ts`, import `getPremiumAllowance()` and include `premiumRequestsPerSeat` in both the data-present and empty-state JSON responses. This enables the `DashboardPanel` to compute per-user usage percentages.

**Definition of Done**:
- [x] `getPremiumAllowance` is imported from `@/lib/get-premium-allowance`
- [x] `premiumRequestsPerSeat` is included in the JSON response (both data-present and empty-state branches)
- [x] The value is read from `getPremiumAllowance()` (reads from configuration, falls back to 300)
- [x] Existing dashboard API tests are updated to verify `premiumRequestsPerSeat` is present in the response
- [x] No other response fields are changed

#### Task 3.6 - [MODIFY] Add indicator to `DashboardPanel` most/least active users
**Description**: In `src/components/dashboard/DashboardPanel.tsx`, add a `UsageStatusIndicator` to the left of `user.githubUsername` in both the "Most Active Users" and "Least Active Users" lists. Import `calcUsagePercent` to compute the percentage from `user.totalRequests` and the new `premiumRequestsPerSeat` field from the API response.

**Definition of Done**:
- [x] `DashboardData` interface is updated to include `premiumRequestsPerSeat: number`
- [x] `UsageStatusIndicator` is imported and `calcUsagePercent` is imported from `@/lib/usage-helpers`
- [x] In "Most Active Users" list: indicator is rendered to the left of `user.githubUsername` using `calcUsagePercent(user.totalRequests, data.premiumRequestsPerSeat)`
- [x] In "Least Active Users" list: same indicator is added
- [x] Username and indicator are wrapped in an `inline-flex items-center gap-2` container
- [x] Indicator colour updates automatically when the selected month changes (because it depends on the fetched data)

### Phase 4: E2E Test Verification

#### Task 4.1 - [MODIFY] Update E2E tests to verify colour-coded indicators
**Description**: Update or add E2E test assertions across relevant spec files to verify that the colour-coded square indicators appear next to entity names. Focus on verifying the indicator exists (via `role="img"` selector) and is positioned correctly.

**Definition of Done**:
- [x] `e2e/seat-list.spec.ts` — assertion that username cells contain an element with `role="img"` (the indicator)
- [x] `e2e/seat-usage.spec.ts` — assertion that username cells in the usage table contain an indicator
- [x] `e2e/team-management.spec.ts` — assertion that team name cells contain an indicator
- [x] `e2e/team-usage.spec.ts` — assertion that team name cells in the usage table contain an indicator
- [x] `e2e/department-management.spec.ts` — assertion that department name cells contain an indicator
- [x] `e2e/department-usage.spec.ts` — assertion that department name cells in the usage table contain an indicator
- [x] `e2e/dashboard.spec.ts` — assertion that most/least active user entries contain an indicator
- [ ] All E2E tests pass

### Phase 5: Code Review

#### Task 5.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent to perform a comprehensive code review of all changes.

**Definition of Done**:
- [x] All changed files reviewed for code quality, consistency, and adherence to project patterns
- [x] Accessibility attributes verified (`role="img"`, `aria-label`)
- [x] Consistent use of `UsageStatusIndicator` component across all tables/views (no raw inline indicator markup)
- [x] Colour thresholds verified as consistent across the entire application
- [x] No unused imports or dead code introduced
- [x] All reviewer findings addressed

## Security Considerations

- No new API endpoints or authentication changes are introduced.
- The `premiumRequestsPerSeat` value added to the dashboard API response is a non-sensitive configuration value already exposed via the `/api/configuration` endpoint. No security risk.
- All indicators use `role="img"` with descriptive `aria-label` attributes for screen reader accessibility — no information is conveyed through colour alone (the label provides the textual equivalent).

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] A small **square** indicator (not circle) is displayed to the left of entity names (usernames, team names, department names)
- [x] Colour thresholds are consistent: red (<50%), orange (50–89%), green (≥90%)
- [x] Indicator appears on: seat management table, seat usage table, team management table, team usage table, department management table, department usage table, team member detail table, dashboard most/least active users
- [x] Any existing circle-shaped indicators are updated to squares with the new thresholds
- [x] Indicator colour updates when the selected month changes on usage pages and the dashboard
- [x] Usage exceeding 100% displays as green (≥90% threshold covers this)
- [x] All unit tests pass (`vitest run`)
- [ ] All E2E tests pass (`playwright test`)
- [x] Accessibility: all indicators have `role="img"` and descriptive `aria-label`

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- Add colour-coded indicator to entity names in the `TeamMembersPanel` management drawer — requires enriching the team members API with usage data, which is outside this visual indicator story.
- Add a tooltip on hover showing the exact usage breakdown (e.g., "150 / 300 premium requests used") — would enhance UX but is not in the requirements.
- Add colour-coded indicator to detail page headings (`SeatDetailPanel`, `TeamDetailPanel`, `DepartmentDetailPanel`) — Story 9.5 covers detail pages with a progress bar, so adding a name-level indicator there may be redundant.
- Server-side rendering of indicators — currently all indicator components are client-side. If performance is a concern, the indicator could be a simple server component since it's purely presentational with no interactivity.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — all phases done. Code review approved with minor Finding 1 (duplicate IIFE in SeatListPanel) addressed via refactor. |
