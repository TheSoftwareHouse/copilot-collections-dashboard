# Story 7.2: User Can Assign Seats to a Team — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.2 |
| Title | User can assign seats to a team |
| Description | As a user, I want to assign seat holders (GitHub users) to a team so that usage can be aggregated at the team level. Includes adding/removing seats and viewing current team membership. |
| Priority | Medium |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (line 936), `specifications/copilot-usage-dashboard/story-7-1.plan.md` |

## Proposed Solution

Implement team member management on top of the existing team CRUD (Story 7.1) and `team_member_snapshot` table. The solution consists of:

1. **Backend API**: New route group at `/api/teams/[id]/members` exposing GET (list current members), POST (add seats), and DELETE (remove seats) handlers. All operations target the **current calendar month** snapshot, which is consistent with how the existing team delete and usage APIs work.
2. **Frontend**: A new `TeamMembersPanel` component accessible from the team list. Each team row gains a "Members" action button that expands/navigates to a member management view showing current members with an "Add Members" flow (multi-select from available seats) and individual "Remove" actions.
3. **Validation**: Zod schema for the `seatIds` array payload shared by POST and DELETE.
4. **Snapshot model**: The existing `team_member_snapshot` table already supports the required data model (`teamId`, `seatId`, `month`, `year`) with a unique constraint preventing duplicate assignments. A seat can belong to multiple teams because the unique constraint is scoped to `(teamId, seatId, month, year)`.

### Data Flow

```
┌────────────────────┐      ┌──────────────────────────────┐      ┌──────────────────────────────┐
│  TeamManagementPanel│─────▶│ /api/teams/[id]/members      │─────▶│  PostgreSQL                  │
│  + TeamMembersPanel │      │ GET  → list current members  │      │  team_member_snapshot         │
│  (multi-select add, │      │ POST → add seatIds           │      │  (teamId, seatId, month, yr) │
│   individual remove)│      │ DELETE → remove seatIds      │      │  copilot_seat (seat lookup)   │
└────────────────────┘      └──────────────────────────────┘      └──────────────────────────────┘
```

### Key Design Decisions

- **Current-month scoping**: All member operations target the current UTC month/year. This aligns with the existing snapshot model used for historical usage tracking. Past month snapshots are immutable from this UI.
- **Bulk add, individual remove**: POST accepts an array of seatIds for efficient multi-add. DELETE also accepts an array for flexibility, but the UI presents per-member remove buttons for clarity.
- **Idempotent add**: Adding a seat that is already a member for the current month returns success (using `ON CONFLICT DO NOTHING`) to avoid unnecessary errors.
- **No cascade to other months**: Adding/removing members only affects the current month's snapshots. Historical data remains untouched.
- **Available seats**: The "Add Members" UI fetches all active seats and filters out those already assigned to the team for the current month.

## Current Implementation Analysis

### Already Implemented
- `TeamEntity` — `src/entities/team.entity.ts` — Team table with soft-delete support (id, name, deletedAt)
- `TeamMemberSnapshotEntity` — `src/entities/team-member-snapshot.entity.ts` — Snapshot entity with FK to team and copilot_seat, unique constraint on `(teamId, seatId, month, year)`
- `CopilotSeatEntity` — `src/entities/copilot-seat.entity.ts` — Seat table with githubUsername, firstName, lastName, status
- Team CRUD API — `src/app/api/teams/route.ts`, `src/app/api/teams/[id]/route.ts` — Full CRUD with auth, validation, soft-delete
- Team validation — `src/lib/validations/team.ts` — Zod schemas for create/update team
- TeamManagementPanel — `src/components/teams/TeamManagementPanel.tsx` — CRUD UI for teams (list, create, edit, delete)
- Teams page — `src/app/(app)/teams/page.tsx` — Page rendering TeamManagementPanel
- Seats list API — `src/app/api/seats/route.ts` — GET with pagination, search, filtering (provides seat data for the "Add Members" picker)
- Team usage API — `src/app/api/usage/teams/[teamId]/route.ts` — Reads from team_member_snapshot for usage display (validates that snapshots drive usage)
- Auth helpers — `src/lib/api-auth.ts` — `requireAuth`/`isAuthFailure` pattern
- Test helpers — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`
- E2E auth helpers — `e2e/helpers/auth.ts` — `seedTestUser`, `loginViaApi`
- E2E team management — `e2e/team-management.spec.ts` — Existing tests for team CRUD
- Unit tests for team API — `src/app/api/teams/__tests__/route.test.ts`, `src/app/api/teams/__tests__/[id].route.test.ts`
- NavBar — `src/components/NavBar.tsx` — Already has "Teams" link

### To Be Modified
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Add "Members" action button per team row, integrate TeamMembersPanel
- E2E team management — `e2e/team-management.spec.ts` — Extend with member assignment tests (or create separate spec)

### To Be Created
- Team member validation schema — `src/lib/validations/team-members.ts` — Zod schema for `{ seatIds: number[] }`
- Team members API route — `src/app/api/teams/[id]/members/route.ts` — GET, POST, DELETE handlers for member management
- TeamMembersPanel component — `src/components/teams/TeamMembersPanel.tsx` — UI for viewing/adding/removing team members
- Unit tests for members API — `src/app/api/teams/__tests__/[id].members.route.test.ts`
- E2E tests for member assignment — `e2e/team-management.spec.ts` (extended)

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the members API support month/year parameters or always use current month? | Always use current month (UTC). Historical snapshots are read-only via the usage API. Managing snapshots for past months would add complexity without clear business value. | ✅ Resolved |
| 2 | Can a seat belong to multiple teams? | Yes — the unique constraint is `(teamId, seatId, month, year)`, allowing a given seat in multiple teams for the same month. The Jira story explicitly states "A seat can belong to one or more teams (not explicitly restricted)". | ✅ Resolved |
| 3 | Should adding an already-assigned seat be an error? | No — use `INSERT ... ON CONFLICT DO NOTHING` for idempotent behavior. The response reports which seats were actually added. | ✅ Resolved |
| 4 | Should removing a seat not assigned produce an error? | No — DELETE is idempotent. If the seat is not a member, the operation succeeds with no effect. | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend API — Team Members Endpoint

#### Task 1.1 — [CREATE] Zod validation schema for team member operations
**Description**: Create a Zod schema validating the `{ seatIds: number[] }` payload used by both POST and DELETE member operations. Follow the pattern in `src/lib/validations/team.ts`.

**Definition of Done**:
- [x] File `src/lib/validations/team-members.ts` exists
- [x] `teamMembersSeatIdsSchema` validates `seatIds` as required, non-empty array of positive integers
- [x] Maximum array length is 100 to prevent abuse
- [x] Type `TeamMembersSeatIdsInput` is exported
- [x] TypeScript compiles without errors

#### Task 1.2 — [CREATE] GET `/api/teams/[id]/members` route
**Description**: Create the API handler returning the list of seats currently assigned to a team for the current month. Joins `team_member_snapshot` with `copilot_seat` to return seat details.

**Definition of Done**:
- [x] File `src/app/api/teams/[id]/members/route.ts` exists
- [x] `GET` requires authentication (returns 401 without valid session)
- [x] `GET` returns 400 for invalid (non-integer) team ID
- [x] `GET` returns 404 if team does not exist or is soft-deleted
- [x] `GET` returns `{ members: [...], month, year }` with seat details for the current UTC month/year
- [x] Each member object includes `seatId`, `githubUsername`, `firstName`, `lastName`, `status`
- [x] Members are ordered by `githubUsername ASC`
- [x] Empty team returns `{ members: [], month, year }`
- [x] Internal errors return 500 with generic message

#### Task 1.3 — [CREATE] POST `/api/teams/[id]/members` route
**Description**: Create the API handler for adding one or more seats to a team for the current month. Uses `INSERT ... ON CONFLICT DO NOTHING` for idempotent behavior.

**Definition of Done**:
- [x] `POST` requires authentication (returns 401 without valid session)
- [x] `POST` returns 400 for invalid team ID
- [x] `POST` returns 400 for invalid body (missing/empty `seatIds`, non-integer values, array too large)
- [x] `POST` returns 404 if team does not exist or is soft-deleted
- [x] `POST` validates that all provided seatIds reference existing seats (returns 400 with details if any are invalid)
- [x] `POST` inserts `team_member_snapshot` rows for each valid seatId with current month/year
- [x] Duplicate assignments (seat already a member for this month) are silently ignored via `ON CONFLICT DO NOTHING`
- [x] `POST` returns 201 with `{ added: number, month, year }` indicating how many new snapshots were created
- [x] Internal errors return 500 with generic message

#### Task 1.4 — [CREATE] DELETE `/api/teams/[id]/members` route
**Description**: Create the API handler for removing one or more seats from a team for the current month. Deletes matching `team_member_snapshot` rows.

**Definition of Done**:
- [x] `DELETE` requires authentication (returns 401 without valid session)
- [x] `DELETE` returns 400 for invalid team ID
- [x] `DELETE` returns 400 for invalid body (missing/empty `seatIds`, non-integer values)
- [x] `DELETE` returns 404 if team does not exist or is soft-deleted
- [x] `DELETE` removes `team_member_snapshot` rows matching the team, provided seatIds, and current month/year
- [x] Removing a seat that is not a member silently succeeds (idempotent)
- [x] `DELETE` returns 200 with `{ removed: number, month, year }` indicating how many snapshots were deleted
- [x] Historical snapshots (previous months) are never affected
- [x] Internal errors return 500 with generic message

#### Task 1.5 — [CREATE] Unit tests for team members API
**Description**: Create unit tests for all three handlers (GET, POST, DELETE) following the test pattern in `src/app/api/teams/__tests__/[id].route.test.ts`.

**Definition of Done**:
- [x] File `src/app/api/teams/__tests__/[id].members.route.test.ts` exists
- [x] Tests mock `@/lib/db` and `next/headers` following the existing pattern
- [x] Tests use `getTestDataSource`/`cleanDatabase`/`destroyTestDataSource` from `src/test/db-helpers.ts`
- [x] **GET tests**: returns empty members for team with no assignments, returns members with seat details, returns 401 without auth, returns 400 for invalid ID, returns 404 for non-existent team, returns 404 for soft-deleted team
- [x] **POST tests**: adds seats successfully (returns 201 with added count), ignores duplicate assignments (returns 201 with added: 0), returns 400 for empty seatIds, returns 400 for non-integer seatIds, returns 400 for non-existent seatIds, returns 404 for non-existent team, returns 401 without auth, does not affect other months' snapshots
- [x] **DELETE tests**: removes seats successfully (returns 200 with removed count), removing non-member seat succeeds silently, returns 400 for invalid body, returns 404 for non-existent team, returns 401 without auth, does not affect historical snapshots (previous month snapshots remain)
- [x] All tests pass

### Phase 2: Frontend — Team Member Management UI

#### Task 2.1 — [CREATE] TeamMembersPanel component
**Description**: Create a client component that displays and manages team membership. Shows current members with remove buttons and an "Add Members" flow with a multi-select seat picker. The component receives a team ID and fetches member/seat data.

**Definition of Done**:
- [x] File `src/components/teams/TeamMembersPanel.tsx` exists
- [x] Component is a client component (`"use client"`)
- [x] Accepts `teamId: number`, `teamName: string`, and `onClose: () => void` props
- [x] Fetches current members from `GET /api/teams/[id]/members` on mount
- [x] Shows loading state while fetching
- [x] Shows error state with retry button on fetch failure
- [x] Displays current month/year context label (e.g., "Members for March 2026")
- [x] Lists current members in a table showing GitHub username, name (firstName + lastName), and a "Remove" button per member
- [x] "Remove" button calls `DELETE /api/teams/[id]/members` with `{ seatIds: [seatId] }`, then refreshes the member list
- [x] Shows confirmation before removing a member
- [x] "Add Members" button opens an add-member flow
- [x] Add-member flow fetches all active seats from `GET /api/seats?status=active&pageSize=300` and filters out already-assigned seats
- [x] Add-member flow shows a searchable list of available seats with checkboxes for multi-select
- [x] Search filters the available seats list by githubUsername, firstName, or lastName (client-side)
- [x] "Add Selected" button calls `POST /api/teams/[id]/members` with selected seatIds, then refreshes the member list
- [x] Empty state message when team has no members
- [x] Empty state message when all seats are already assigned (no available seats)
- [x] All interactive elements have proper `aria-` attributes for accessibility
- [x] Error messages use `role="alert"`

#### Task 2.2 — [MODIFY] Extend TeamManagementPanel with member management
**Description**: Add a "Members" action button to each team row in the TeamManagementPanel. Clicking it renders the TeamMembersPanel for that team, replacing or appearing alongside the team list.

**Definition of Done**:
- [x] Each team row in `TeamManagementPanel` has a "Members" button alongside "Edit" and "Delete"
- [x] Clicking "Members" sets state to show the `TeamMembersPanel` for the selected team
- [x] The `TeamMembersPanel` is displayed below the team list or replaces the table (depending on layout)
- [x] A "Back to Teams" or close mechanism is available to dismiss the members panel and return to the team list view
- [x] Only one panel (edit/delete/members) is active at a time
- [x] Member management integrates visually with the existing team list styling

### Phase 3: End-to-End Tests

#### Task 3.1 — [MODIFY] E2E tests for team member assignment
**Description**: Extend the existing `e2e/team-management.spec.ts` with tests for member assignment, or create a new describe block within the same file. Tests seed seats and teams via direct DB queries.

**Definition of Done**:
- [x] E2E tests exist in `e2e/team-management.spec.ts` (or a new `e2e/team-members.spec.ts` if cleaner)
- [x] Test setup seeds teams and copilot seats via direct DB queries
- [x] Test: Can view members panel for a team (shows empty state initially)
- [x] Test: Can add one or more seats to a team (seats appear in member list)
- [x] Test: Can remove a seat from a team (seat disappears from member list)
- [x] Test: A seat can belong to multiple teams (add same seat to two different teams)
- [x] Test: Already-assigned seat is handled gracefully (no error on re-add)
- [x] Tests clean up data in `beforeEach` to ensure isolation
- [x] All E2E tests pass

### Phase 4: Code Review

#### Task 4.1 — [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run a full code review of all changes using the `tsh-code-reviewer` agent to verify code quality, consistency with existing patterns, security, and test coverage.

**Definition of Done**:
- [x] All new files reviewed for adherence to project conventions
- [x] API routes follow the same error handling and auth patterns as existing team routes
- [x] Validation schema is consistent with existing Zod patterns
- [x] Frontend component follows the same structure, styling, and accessibility patterns as `TeamManagementPanel`
- [x] All unit tests and E2E tests pass
- [x] No TypeScript compilation errors
- [x] No ESLint violations

## Security Considerations

- **Authentication**: All team member API endpoints are protected by `requireAuth()`, consistent with existing team and seat APIs. Unauthenticated requests receive 401.
- **Input Validation**: The `seatIds` array is validated server-side with Zod — must be non-empty, contain only positive integers, and be capped at 100 entries to prevent abuse.
- **Seat Existence Check**: Before inserting snapshots, the API verifies all provided seatIds exist in the `copilot_seat` table. This prevents creating orphaned snapshot rows.
- **SQL Injection**: All database operations use TypeORM parameterised queries or the query builder with parameter placeholders (`$1`, `$2`, etc.).
- **Integer ID Parsing**: Team ID from the URL path is parsed and validated as a positive integer before use, following the existing pattern.
- **Error Information Disclosure**: Internal errors return generic "Internal server error" without stack traces or implementation details.
- **Rate Limiting**: The `seatIds` array maximum length (100) limits the blast radius of a single request. No additional rate limiting is introduced as it's not present in the existing API pattern.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] User can add one or more seats to a team
- [x] User can remove seats from a team
- [x] A seat can belong to one or more teams
- [x] Current team membership is visible when viewing the team
- [x] Adding an already-assigned seat is handled gracefully (idempotent)
- [x] Removing a non-member seat is handled gracefully (idempotent)
- [x] Historical snapshots (previous months) are never affected by member operations
- [x] All API endpoints require authentication
- [x] All inputs are validated with Zod schemas (client-side and server-side)
- [x] Unit tests cover all API endpoints and edge cases
- [x] E2E tests cover adding, removing, and viewing members
- [x] UI shows current month context for member management
- [x] UI is accessible (proper labels, aria attributes, keyboard navigation)
- [x] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Bulk member management via CSV**: Allow importing team assignments from a CSV file for large teams.
- **Copy members from previous month**: When starting a new month, provide a "copy from last month" action to quickly replicate last month's team composition.
- **Member count in team list**: Show the current member count next to each team name in the team list table (would require extending the GET /api/teams response to include a count sub-query).
- **Drag-and-drop assignment**: Enable drag-and-drop from a seat list to a team for a more interactive UX.
- **Team member change history**: Track and display an audit log of when members were added/removed from teams.
- **Month selector for member management**: Allow managing members for a specific month/year rather than only the current month.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — Phases 1–3 delivered |
| 2026-03-01 | Code review performed by `tsh-code-reviewer` agent — **APPROVED WITH COMMENTS**. 3 minor issues (M1: inconsistent ID validation pattern, M2: race condition in POST added count, M3: no seatIds deduplication), 3 suggestions (S1: aria-busy on loading states, S2: deterministic githubUserId in E2E seed, S3: asymmetry comment for DELETE). All non-blocking. |
