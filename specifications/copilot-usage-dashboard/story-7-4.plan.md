# Story 7.4 — System Tracks Team Composition Per Month — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.4 |
| Title | System tracks team composition per month |
| Description | As a user, I want team composition changes to be tracked per month so that I can view historical team usage even when membership has changed over time. |
| Priority | Medium |
| Related Research | [jira-tasks.md](./jira-tasks.md) (Story 7.4 section) |

## Proposed Solution

All acceptance criteria for Story 7.4 are **already fully implemented and tested** in the existing codebase. No code changes are required.

The snapshot-per-month data model (`team_member_snapshot` keyed by `teamId`, `seatId`, `month`, `year`) stores team composition snapshots. The usage APIs query snapshots by month/year, so historical usage reflects the correct composition. Member mutation endpoints (`POST`/`DELETE /api/teams/[id]/members`) are restricted to the current month via `getCurrentMonthYear()`, ensuring historical records cannot be altered. The **team usage detail page** (`/usage/teams/[teamId]`) already provides a `MonthFilter` for users to view past team compositions and their usage — fulfilling the "view past team compositions by selecting a previous month" requirement.

**Data Flow (already implemented):**

```
Team Usage Detail (/usage/teams/[teamId])
        │
        ├── MonthFilter (selects month/year)
        │
        ▼
GET /api/usage/teams/[teamId]?month=M&year=Y
        │
        ▼
SELECT ... FROM team_member_snapshot tms
  JOIN copilot_seat cs ON cs.id = tms."seatId"
  LEFT JOIN copilot_usage cu ON ...
  WHERE tms."teamId" = $1 AND tms.month = $2 AND tms.year = $3
        │
        ▼
Response: { team: {...}, members: [...], dailyUsagePerMember: [...], month, year }
        │
        ▼
TeamDetailPanel renders:
  - Team summary cards (total requests, avg/member, spending)
  - Members table with per-member usage for that month's snapshot
  - Daily usage chart per member
```

**Historical record protection (already implemented):**

```
POST /api/teams/[id]/members   → getCurrentMonthYear() → only inserts for current month
DELETE /api/teams/[id]/members → getCurrentMonthYear() → only deletes for current month
DELETE /api/teams/[id]         → soft-deletes team, removes only current-month snapshots
```

## Current Implementation Analysis

### Already Implemented

All components of Story 7.4 are **fully implemented and tested**:

- **Snapshot storage** — `team_member_snapshot` table (`migrations/1772400000000-CreateTeamTables.ts`) — stores team composition per `(teamId, seatId, month, year)` with unique constraint `UQ_team_member_snapshot`
- **Snapshot entity** — `src/entities/team-member-snapshot.entity.ts` — TypeORM entity schema with indices on `(teamId, month, year)` and `(seatId)` for efficient queries
- **Historical usage — team list** — `src/app/api/usage/teams/route.ts` — CTE-based SQL joins `team_member_snapshot` by `month`/`year` to compute per-team aggregates; always uses the selected month's snapshot composition
- **Historical usage — team detail** — `src/app/api/usage/teams/[teamId]/route.ts` — per-member usage breakdown for selected month/year using that month's snapshot composition; accepts `month`/`year` query parameters
- **Historical composition UI** — `src/components/usage/TeamDetailPanel.tsx` — renders team detail page with `MonthFilter`; switching months re-fetches data showing historical members and their usage for the selected month
- **Member mutation restricted to current month** — `src/app/api/teams/[id]/members/route.ts` — `POST` and `DELETE` use `getCurrentMonthYear()`, only modifying the current month's snapshot
- **Team delete preserves history** — `src/app/api/teams/[id]/route.ts` — soft-deletes team and removes only current-month snapshots; historical snapshots are preserved
- **MonthFilter component** — `src/components/dashboard/MonthFilter.tsx` — reusable month picker; already integrated into `TeamDetailPanel`
- **Unit tests — members API** — `src/app/api/teams/__tests__/[id].members.route.test.ts` — GET, POST, DELETE operations
- **Unit tests — team delete** — `src/app/api/teams/__tests__/[id].route.test.ts` — includes test `"removes current-month snapshots but preserves historical ones"` explicitly verifying historical snapshot preservation
- **Unit tests — team usage** — `src/app/api/usage/teams/__tests__/route.test.ts` and `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts` — verify aggregation uses snapshot composition for the queried month
- **E2E tests — team members** — `e2e/team-members.spec.ts` — add, remove, multi-team membership
- **E2E tests — team usage** — `e2e/team-usage.spec.ts` — team usage with month filtering, team detail page with historical data

### To Be Modified

No modifications needed.

### To Be Created

No new code needs to be created.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should users be able to view past compositions from the team management page (`/teams`)? | No — viewing historical compositions is fulfilled through the team usage detail page (`/usage/teams/[teamId]`) which already has a MonthFilter and shows the member list for the selected month. A separate historical view on the management page is not needed. | ✅ Resolved |
| 2 | Can `POST`/`DELETE` members endpoints modify historical records? | No. Both endpoints use `getCurrentMonthYear()` to restrict mutations to the current month only. Historical records are immutable. | ✅ Resolved |
| 3 | Does the team usage detail page show the correct historical members when switching months? | Yes. `GET /api/usage/teams/[teamId]` accepts `month`/`year` query params and joins `team_member_snapshot` by those values. The `TeamDetailPanel` re-fetches on month change. | ✅ Resolved |

## Implementation Plan

### Phase 1: Verification (No Code Changes Required)

All acceptance criteria are met by the existing implementation. This phase verifies that the implementation satisfies all requirements through code review.

#### Task 1.1 - [REUSE] Verify snapshot storage per month
**Description**: Confirm that the `team_member_snapshot` table stores team composition keyed by `(teamId, seatId, month, year)` with a unique constraint preventing duplicates.

**Definition of Done**:
- [ ] `team_member_snapshot` table has columns `teamId`, `seatId`, `month`, `year` with unique constraint `UQ_team_member_snapshot`
- [ ] Members added via `POST /api/teams/[id]/members` are inserted for the current month only
- [ ] Different months can have different member compositions for the same team
- [ ] Existing unit tests in `src/app/api/teams/__tests__/[id].members.route.test.ts` pass

#### Task 1.2 - [REUSE] Verify historical usage uses correct composition
**Description**: Confirm that usage APIs (`GET /api/usage/teams`, `GET /api/usage/teams/[teamId]`) join `team_member_snapshot` filtered by the selected `month`/`year`, ensuring historical usage reflects the composition at that point in time.

**Definition of Done**:
- [ ] `GET /api/usage/teams?month=M&year=Y` computes per-team aggregates using that month's snapshot composition
- [ ] `GET /api/usage/teams/[teamId]?month=M&year=Y` returns per-member usage based on that month's snapshot
- [ ] Members who were in the team during month M but not in the current month still appear in historical results
- [ ] Existing unit tests in `src/app/api/usage/teams/__tests__/route.test.ts` and `src/app/api/usage/teams/[teamId]/__tests__/route.test.ts` pass

#### Task 1.3 - [REUSE] Verify current-month changes do not alter historical records
**Description**: Confirm that `POST` and `DELETE` member endpoints only modify the current month's snapshot, and that team deletion preserves historical snapshots.

**Definition of Done**:
- [ ] `POST /api/teams/[id]/members` inserts snapshots only for the current month (via `getCurrentMonthYear()`)
- [ ] `DELETE /api/teams/[id]/members` deletes snapshots only for the current month
- [ ] `DELETE /api/teams/[id]` (team soft-delete) removes only current-month snapshots; historical months' snapshots are preserved
- [ ] Existing unit test `"removes current-month snapshots but preserves historical ones"` in `src/app/api/teams/__tests__/[id].route.test.ts` passes

#### Task 1.4 - [REUSE] Verify user can view past team compositions
**Description**: Confirm that the team usage detail page (`/usage/teams/[teamId]`) provides a `MonthFilter` that allows users to select a previous month and see the team's historical member list and their usage.

**Definition of Done**:
- [ ] `TeamDetailPanel` component renders a `MonthFilter` for month/year selection
- [ ] Selecting a previous month re-fetches data from `GET /api/usage/teams/[teamId]?month=M&year=Y`
- [ ] The response includes historical members from `team_member_snapshot` for the selected month
- [ ] The member table shows the correct historical composition, not the current month's composition
- [ ] E2E tests in `e2e/team-usage.spec.ts` cover month filtering on the team detail page

### Phase 2: Code Review

#### Task 2.1 - [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run the `tsh-code-reviewer` agent to verify the existing implementation against the Story 7.4 acceptance criteria, code quality standards, and test coverage.

**Definition of Done**:
- [ ] Code reviewer confirms all four acceptance criteria are met
- [ ] Code reviewer confirms unit test coverage for snapshot storage, historical composition retrieval, and historical record immutability
- [ ] Code reviewer confirms E2E test coverage for team usage detail page with month filtering
- [ ] No code quality issues identified

## Security Considerations

- All team member and usage endpoints are protected by `requireAuth()` middleware — unauthenticated requests receive 401.
- Member mutation endpoints (`POST`/`DELETE /api/teams/[id]/members`) are restricted to the current month server-side via `getCurrentMonthYear()`, so historical records cannot be modified even if the API is called directly.
- SQL queries use parameterised values (`$1`, `$2`, etc.) to prevent SQL injection.
- Team IDs and month/year parameters are validated as integers before querying; invalid values result in 400 or safe fallback defaults.
- JSONB aggregation uses explicit field casting (`::numeric`) to prevent type confusion.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Each month's team composition is stored as a snapshot (`team_member_snapshot` table with `(teamId, seatId, month, year)` unique constraint)
- [x] Historical usage reflects the composition at that point in time (usage APIs join `team_member_snapshot` filtered by selected month/year)
- [x] Current membership changes do not alter historical records (`POST`/`DELETE` restricted to current month; team delete preserves historical snapshots)
- [x] User can view past team compositions by selecting a previous month (`TeamDetailPanel` on `/usage/teams/[teamId]` with `MonthFilter`)
- [x] Unit tests verify snapshot storage, historical aggregation, and historical record preservation
- [x] E2E tests cover team usage detail page with month filtering
- [x] No regression in existing team management (create, edit, delete, add/remove members)
- [x] No regression in existing team usage analytics (team tab, team detail page)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Automatic snapshot carry-forward**: When a new month begins, automatically copy the previous month's team composition snapshot to the new month, so teams start each month with their last known composition rather than empty. Currently, members must be manually added each month.
- **Composition diff view**: Show a visual diff between two months' compositions (members added/removed) to help users understand changes over time.
- **Bulk snapshot management**: Allow copying all members from one month's snapshot to another (e.g., "Copy January composition to February").
- **Snapshot audit trail**: Record who made changes to team composition and when, for compliance reporting.
- **Historical viewing on team management page**: Add a `MonthFilter` to the team management members panel (`/teams`) to allow viewing past compositions outside of the usage context.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Updated: removed planned backend/frontend changes after confirming historical composition viewing is already available via team usage detail page (`/usage/teams/[teamId]`). All acceptance criteria met by existing implementation. |
