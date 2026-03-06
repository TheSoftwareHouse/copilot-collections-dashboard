# Story 7.3 — System Calculates Average Premium Request Usage Per Team — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.3 |
| Title | System calculates average premium request usage per team |
| Description | As a user, I want to see the average Copilot premium request usage for a team based on its members' individual usage so that I can evaluate team-level efficiency. |
| Priority | Medium |
| Related Research | [jira-tasks.md](./jira-tasks.md) (Story 7.3 section) |

## Proposed Solution

Calculate the average premium request usage per team by dividing the sum of all team members' `grossQuantity` (from `copilot_usage.usageItems` JSONB) by the number of members in the team for the selected month. Display this metric in two places:

1. **Team Usage Tab** (`/api/usage/teams`) — the `Avg Requests/Member` column in the team list table.
2. **Team Detail View** (`/api/usage/teams/[teamId]`) — the `Avg Requests/Member` summary card on the team detail page.

The calculation uses `team_member_snapshot` to determine team composition for the selected month/year, then joins with `copilot_usage` to aggregate individual usage. The formula:

```
averageRequestsPerMember = totalRequests / memberCount   (0 when memberCount = 0)
averageGrossAmountPerMember = totalGrossAmount / memberCount   (0 when memberCount = 0)
```

**Data Flow Diagram:**

```
team_member_snapshot (month, year)
        │
        ├──► copilot_usage (seatId, month, year)
        │         │
        │         └──► jsonb_array_elements(usageItems) → grossQuantity, grossAmount
        │
        └──► COUNT(DISTINCT seatId) → memberCount
                    │
                    ├──► SUM(grossQuantity) / memberCount = averageRequestsPerMember
                    └──► SUM(grossAmount) / memberCount = averageGrossAmountPerMember
```

## Current Implementation Analysis

### Already Implemented

All components of story 7.3 are **fully implemented and tested**:

- **Team Usage List API** — `src/app/api/usage/teams/route.ts` — CTE-based SQL query joins `team_member_snapshot` → `copilot_usage` → `jsonb_array_elements(usageItems)` to compute `totalRequests`, `totalGrossAmount` per team. Application code then computes `averageRequestsPerMember` and `averageGrossAmountPerMember` from these aggregates.
- **Team Detail API** — `src/app/api/usage/teams/[teamId]/route.ts` — Per-member usage breakdown query with team-level aggregate computation including `averageRequestsPerMember` and `averageGrossAmountPerMember`. Also returns daily usage per member for chart rendering.
- **TeamUsagePanel component** — `src/components/usage/TeamUsagePanel.tsx` — Fetches `/api/usage/teams?month=&year=` and passes data (including `averageRequestsPerMember`) to TeamUsageTable.
- **TeamUsageTable component** — `src/components/usage/TeamUsageTable.tsx` — Renders `Avg Requests/Member` column with 1-decimal formatting.
- **TeamDetailPanel component** — `src/components/usage/TeamDetailPanel.tsx` — Renders `Avg Requests/Member` summary card with 1-decimal formatting, alongside Total Requests and Total Spending cards.
- **TeamMemberTable component** — `src/components/usage/TeamMemberTable.tsx` — Shows per-member breakdown with usage as count & percentage relative to `PREMIUM_REQUESTS_PER_SEAT` (300), with colour indicators (red ≤50%, orange 51-99%, green ≥100%).
- **Unit tests for team usage list** — `src/app/api/usage/teams/__tests__/route.test.ts` — Tests for aggregated metrics, empty teams, zero usage, correct average calculation (total / memberCount), ordering.
- **Unit tests for team detail** — `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts` — Tests for per-member breakdown, team-level aggregates with averages, empty teams, members with no usage, daily chart data.
- **E2E tests** — `e2e/team-usage.spec.ts` — Full end-to-end coverage for Team tab, team detail page, summary cards, member table with percentages, colour indicators, month filter, navigation.

### To Be Modified

No modifications needed.

### To Be Created

No new code needs to be created.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Is the average calculation based on `grossQuantity` the correct metric? | Yes — the existing implementation sums all `grossQuantity` values across all usage items for all days in the month per member, then divides by member count. This matches the requirement of "average premium request usage per team based on individual member data". | ✅ Resolved |
| 2 | Should the average include inactive/zero-usage members? | Yes — the current implementation counts all members in the `team_member_snapshot` for the month, including those with zero usage. This correctly reflects team composition. | ✅ Resolved |
| 3 | Should the average be displayed as a single metric or broken down by model? | The current implementation shows a single aggregate average (across all models). Model-level breakdown is available per member in the detail view. This matches the acceptance criteria. | ✅ Resolved |

## Implementation Plan

### Phase 1: Verification (No Code Changes Required)

All acceptance criteria are met by the existing implementation. This phase verifies that the implementation satisfies all requirements through code review.

#### Task 1.1 - [REUSE] Verify average calculation in Team Usage List API
**Description**: Confirm that `GET /api/usage/teams` correctly computes `averageRequestsPerMember` and `averageGrossAmountPerMember` for each team based on the selected month's member snapshot and usage data.

**Definition of Done**:
- [ ] `averageRequestsPerMember` is calculated as `totalRequests / memberCount` (0 when no members)
- [ ] `averageGrossAmountPerMember` is calculated as `totalGrossAmount / memberCount` (0 when no members)
- [ ] Calculation uses `team_member_snapshot` filtered by `month` and `year` parameters
- [ ] Usage data aggregated from `copilot_usage.usageItems` JSONB `grossQuantity` and `grossAmount` fields
- [ ] Existing unit tests pass: `src/app/api/usage/teams/__tests__/route.test.ts`

#### Task 1.2 - [REUSE] Verify average calculation in Team Detail API
**Description**: Confirm that `GET /api/usage/teams/[teamId]` correctly computes `averageRequestsPerMember` and `averageGrossAmountPerMember` in the team summary object.

**Definition of Done**:
- [ ] Team detail response includes `averageRequestsPerMember` and `averageGrossAmountPerMember`
- [ ] Values computed from the same formula: total / memberCount (0 when no members)
- [ ] Per-member breakdown shows individual `totalRequests` and `totalGrossAmount`
- [ ] Existing unit tests pass: `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts`

#### Task 1.3 - [REUSE] Verify average display in Team Usage Tab UI
**Description**: Confirm that the `TeamUsageTable` component displays the `Avg Requests/Member` column with the correct value for each team row.

**Definition of Done**:
- [ ] `Avg Requests/Member` column header is present in the team usage table
- [ ] Values formatted with 1 decimal place (e.g., `40.0`, `125.5`)
- [ ] Column is right-aligned consistent with numeric data presentation

#### Task 1.4 - [REUSE] Verify average display in Team Detail View UI
**Description**: Confirm that the `TeamDetailPanel` component displays the `Avg Requests/Member` summary card for the selected team and month.

**Definition of Done**:
- [ ] `Avg Requests/Member` summary card is present on the team detail page
- [ ] Value formatted with 1 decimal place
- [ ] Card updates when month filter changes
- [ ] Shows 0.0 when team has no members for the selected month

### Phase 2: Code Review

#### Task 2.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent to verify the existing implementation against the story 7.3 acceptance criteria, code quality standards, and test coverage.

**Definition of Done**:
- [ ] Code reviewer confirms all acceptance criteria are met
- [ ] Code reviewer confirms unit test coverage for average calculation edge cases (zero members, members with no usage, correct division)
- [ ] Code reviewer confirms E2E test coverage for average display on both team tab and team detail views
- [ ] No code quality issues identified

## Security Considerations

- All team usage endpoints are protected by `requireAuth()` middleware — unauthenticated requests receive 401.
- SQL queries use parameterised values (`$1`, `$2`, etc.) to prevent SQL injection.
- Team IDs are validated as positive integers before querying; invalid IDs return 400.
- JSONB aggregation uses explicit field casting (`::numeric`) to prevent type confusion.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Average premium request usage per team is calculated from individual member data
- [x] Average is displayed on team detail view (`Avg Requests/Member` summary card in `TeamDetailPanel`)
- [x] Average is displayed on team usage tab (`Avg Requests/Member` column in `TeamUsageTable`)
- [x] Calculation uses data from the selected month (filtered by `month` and `year` query parameters)
- [x] Unit tests verify correct average calculation for teams with multiple members
- [x] Unit tests verify zero average for teams with no members
- [x] Unit tests verify average includes members with zero usage in the denominator
- [x] E2E tests verify team summary metrics are visible on team detail page
- [x] E2E tests verify team tab shows aggregated usage metrics

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Weighted average support**: Currently computes a simple average (total / count). A weighted average by number of active days per member could provide more nuanced insight.
- **Trend comparison**: Show average change (delta or percentage) compared to the previous month in the summary card.
- **Export capability**: Allow exporting team average metrics as CSV for external reporting.
- **Average by model**: Break down the average per AI model (e.g., average GPT-4o requests per member vs average Claude Sonnet requests per member).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created. All acceptance criteria confirmed as already implemented. |
