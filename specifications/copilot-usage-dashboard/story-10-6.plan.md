# Story 10.6: Backfill Historical Team Membership via Date-Range Assignment — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.6 |
| Title | Backfill historical team membership via date-range assignment |
| Description | As a user, I want to select a person and specify a start/end month range to indicate when they were part of the team, so that the system creates snapshot entries for every month in that range and historical usage reflects accurate team composition. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (line 1775), `specifications/copilot-usage-dashboard/story-7-2.plan.md` |

## Proposed Solution

Add a **backfill** capability to the existing team member management system that allows creating `team_member_snapshot` entries for a range of past months. The solution consists of:

1. **Backend API**: New route at `POST /api/teams/[id]/members/backfill` that accepts `seatIds`, `startMonth`, `startYear`, `endMonth`, `endYear`. It generates snapshot rows for every month in the specified range, using `INSERT ... ON CONFLICT DO NOTHING` for idempotent writes.
2. **Validation**: New Zod schema `teamMembersBackfillSchema` extending the existing seat ID validation with date-range fields and cross-field refinements (start ≤ end, no future months).
3. **Frontend**: A new "Backfill History" button in `TeamMembersPanel` that opens a dedicated backfill flow with month/year range selectors and the same multi-select seat picker used in the "Add Members" flow. A success message shows how many months were added.
4. **No database changes**: The existing `team_member_snapshot` table, unique constraint, and indexes fully support backfill writes. The usage API already reads from snapshots parameterised by month/year, so historical usage data is updated automatically.

### Data Flow

```
┌─────────────────────────┐      ┌───────────────────────────────────┐      ┌──────────────────────────────┐
│  TeamMembersPanel        │─────▶│ POST /api/teams/[id]/members/     │─────▶│  PostgreSQL                  │
│  + BackfillMembersFlow   │      │      backfill                     │      │  team_member_snapshot         │
│  (date range + seat      │      │ { seatIds, startMonth, startYear, │      │  (teamId, seatId, month, yr) │
│   multi-select)          │      │   endMonth, endYear }             │      │  UQ constraint → DO NOTHING  │
└─────────────────────────┘      └───────────────────────────────────┘      └──────────────────────────────┘
                                                                                        │
                                                                                        ▼
                                 ┌───────────────────────────────────┐      ┌──────────────────────────────┐
                                 │ GET /api/usage/teams/[teamId]     │◀─────│  historical usage queries     │
                                 │ ?month=X&year=Y                   │      │  join team_member_snapshot    │
                                 │ (already works — no changes)      │      │  with copilot_usage           │
                                 └───────────────────────────────────┘      └──────────────────────────────┘
```

### Key Design Decisions

- **Separate endpoint (`/backfill`) rather than extending existing POST**: The backfill is a distinct multi-month write operation with different validation rules (date range). Keeping it separate avoids changing the semantics of the existing current-month-only POST endpoint and its tests.
- **Idempotent via `ON CONFLICT DO NOTHING`**: Months where the person already has a snapshot are silently skipped, matching the existing pattern in the current-month POST.
- **Bulk insert**: All month × seatId combinations are inserted in a single SQL statement to minimise round-trips and leverage the database's transactional guarantees.
- **Maximum range cap of 24 months**: Prevents accidental massive writes. 100 seatIds × 24 months = 2,400 max rows per request — manageable in a single INSERT.
- **No migration needed**: The existing `team_member_snapshot` schema fully supports this feature.
- **Usage auto-reflects**: The team usage API (`GET /api/usage/teams/[teamId]?month=X&year=Y`) already joins `team_member_snapshot` for the requested month/year, so backfilled snapshots are reflected immediately without any additional work.

## Current Implementation Analysis

### Already Implemented
- `TeamMemberSnapshotEntity` — `src/entities/team-member-snapshot.entity.ts` — Snapshot entity with FK to team and copilot_seat, unique constraint on `(teamId, seatId, month, year)`, indexes on `(teamId, month, year)` and `(seatId)`
- `TeamEntity` — `src/entities/team.entity.ts` — Team table with soft-delete support (deletedAt column)
- `CopilotSeatEntity` — `src/entities/copilot-seat.entity.ts` — Seat table with githubUsername, firstName, lastName, status
- `teamMembersSeatIdsSchema` — `src/lib/validations/team-members.ts` — Zod schema validating `{ seatIds: number[] }` with min(1), max(100), positive integer constraints
- Team members API — `src/app/api/teams/[id]/members/route.ts` — GET (list current members), POST (add to current month with ON CONFLICT DO NOTHING), DELETE (remove from current month)
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — Client component with member list, "Add Members" flow (multi-select seat picker with search), and individual "Remove" actions
- `TeamManagementPanel` — `src/components/teams/TeamManagementPanel.tsx` — Integrates TeamMembersPanel via "Members" button per team row
- Team usage API — `src/app/api/usage/teams/[teamId]/route.ts` — Reads from `team_member_snapshot` joined with `copilot_usage` for given month/year, supports `?month=X&year=Y` query params
- Auth helpers — `src/lib/api-auth.ts` — `requireAuth()`/`isAuthFailure()` pattern used by all API routes
- Test helpers — `src/test/db-helpers.ts` — `getTestDataSource`, `cleanDatabase`, `destroyTestDataSource`
- E2E helpers — `e2e/helpers/auth.ts` — `seedTestUser`, `loginViaApi`
- E2E team members tests — `e2e/team-members.spec.ts` — Tests for add, remove, view, multi-team membership
- `MONTH_NAMES` constant — `src/lib/constants.ts` — Shared month name array for UI display
- Unit tests for team members API — `src/app/api/teams/__tests__/[id].members.route.test.ts` — Full test suite for GET/POST/DELETE handlers

### To Be Modified
- `teamMembersSeatIdsSchema` module — `src/lib/validations/team-members.ts` — Add new `teamMembersBackfillSchema` with date-range fields and cross-field refinements
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — Add "Backfill History" button that opens the backfill flow
- E2E team members tests — `e2e/team-members.spec.ts` — Add tests for backfill flow

### To Be Created
- Backfill API route — `src/app/api/teams/[id]/members/backfill/route.ts` — POST handler for multi-month snapshot creation
- Unit tests for backfill API — `src/app/api/teams/__tests__/[id].members.backfill.route.test.ts` — Test suite for the backfill endpoint
- Unit tests for backfill validation — `src/lib/validations/__tests__/team-members.test.ts` — Test suite for the new Zod schema

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should the backfill use a separate endpoint or extend the existing POST? | Separate endpoint `POST /api/teams/[id]/members/backfill`. The backfill is a distinct multi-month write with different validation rules. Keeping it separate avoids changing the existing POST semantics and its tests. | ✅ Resolved |
| 2 | What is the maximum date range allowed? | 24 months. This caps the maximum single-request write at 100 seatIds × 24 months = 2,400 rows, which is manageable in a single INSERT. | ✅ Resolved |
| 3 | Should the response indicate which months were new vs skipped? | No — returning `{ added }` (actual new rows) and `{ totalMonthsInRange }` is sufficient for the success message. Per-month detail adds complexity without clear user value. | ✅ Resolved |
| 4 | What determines "current month" for the future-month validation? | Current UTC month/year (same approach as existing `getCurrentMonthYear()` in the members route). The current month IS allowed (not considered "future"). | ✅ Resolved |

## Implementation Plan

### Phase 1: Backend — Validation Schema and Backfill API

#### Task 1.1 — [MODIFY] Add backfill validation schema to team-members validations
**Description**: Extend `src/lib/validations/team-members.ts` with a new `teamMembersBackfillSchema` that validates the backfill request payload: `seatIds` (reuse existing constraints), `startMonth`, `startYear`, `endMonth`, `endYear`, with cross-field refinements ensuring start ≤ end and no future months.

**Definition of Done**:
- [x] `teamMembersBackfillSchema` exported from `src/lib/validations/team-members.ts`
- [x] Validates `seatIds` as non-empty array of positive integers (max 100), same as existing schema
- [x] Validates `startMonth` (1–12), `startYear` (≥ 2020), `endMonth` (1–12), `endYear` (≥ 2020)
- [x] Cross-field refinement: rejects when start date is after end date (e.g., startYear=2026, startMonth=3, endYear=2026, endMonth=1)
- [x] Cross-field refinement: rejects when end date is in the future (after current UTC month/year)
- [x] Cross-field refinement: rejects when range exceeds 24 months
- [x] Type `TeamMembersBackfillInput` is exported
- [x] TypeScript compiles without errors

#### Task 1.2 — [CREATE] Unit tests for backfill validation schema
**Description**: Create unit tests for the new `teamMembersBackfillSchema` covering valid inputs, boundary conditions, and all rejection cases. Follow the test pattern in `src/lib/validations/__tests__/`.

**Definition of Done**:
- [x] File `src/lib/validations/__tests__/team-members.test.ts` exists
- [x] Test: valid payload with single seat and single-month range passes
- [x] Test: valid payload spanning multiple months passes
- [x] Test: valid payload where range ends at current month passes
- [x] Test: rejects empty seatIds
- [x] Test: rejects non-integer seatIds
- [x] Test: rejects seatIds exceeding max (100)
- [x] Test: rejects start month > 12 or < 1
- [x] Test: rejects start year < 2020
- [x] Test: rejects when start date is after end date (same year, month reversed)
- [x] Test: rejects when start date is after end date (year reversed)
- [x] Test: rejects when end date is in the future
- [x] Test: rejects range exceeding 24 months
- [x] All tests pass

#### Task 1.3 — [CREATE] POST `/api/teams/[id]/members/backfill` route
**Description**: Create the API handler for creating team member snapshots across a range of months. Validates input, checks team exists/not deleted, validates all seatIds exist, generates month list, and performs a bulk idempotent insert.

**Definition of Done**:
- [x] File `src/app/api/teams/[id]/members/backfill/route.ts` exists
- [x] `POST` requires authentication (returns 401 without valid session)
- [x] `POST` returns 400 for invalid (non-integer or non-positive) team ID
- [x] `POST` returns 400 for invalid body (Zod validation failures with detailed error messages)
- [x] `POST` returns 404 if team does not exist or is soft-deleted (`deletedAt IS NOT NULL`)
- [x] `POST` validates that all provided seatIds reference existing copilot seats (returns 400 with `invalidSeatIds` if any are missing)
- [x] `POST` generates a list of all (month, year) pairs from start to end inclusive
- [x] `POST` performs a single `INSERT INTO team_member_snapshot ... ON CONFLICT DO NOTHING` with all (teamId, seatId, month, year) combinations
- [x] `POST` returns 201 with `{ added, totalMonthsInRange, startMonth, startYear, endMonth, endYear }`
- [x] `added` accurately reflects only newly-created rows (excludes skipped duplicates)
- [x] Internal errors return 500 with generic message
- [x] Route follows existing file organisation pattern (`src/app/api/teams/[id]/members/backfill/route.ts`)

#### Task 1.4 — [CREATE] Unit tests for backfill API route
**Description**: Create unit tests for the backfill POST handler following the test pattern in `src/app/api/teams/__tests__/[id].members.route.test.ts`. Tests use the test database with real schema.

**Definition of Done**:
- [x] File `src/app/api/teams/__tests__/[id].members.backfill.route.test.ts` exists
- [x] Tests mock `@/lib/db` and `next/headers` following the existing pattern
- [x] Tests use `getTestDataSource`/`cleanDatabase`/`destroyTestDataSource` from `src/test/db-helpers.ts`
- [x] Test: returns 401 without auth session
- [x] Test: returns 400 for invalid team ID (non-integer, negative, zero)
- [x] Test: returns 400 for malformed JSON body
- [x] Test: returns 400 for empty seatIds
- [x] Test: returns 400 when start date is after end date
- [x] Test: returns 400 when end date is in a future month
- [x] Test: returns 404 for non-existent team
- [x] Test: returns 404 for soft-deleted team
- [x] Test: returns 400 when seatIds reference non-existent seats (includes `invalidSeatIds` in response)
- [x] Test: successfully creates snapshots for a multi-month range (returns 201 with correct `added` count)
- [x] Test: idempotent — months with existing snapshots are skipped (returns 201 with `added` reflecting only new rows)
- [x] Test: range spanning a year boundary works correctly (e.g., Nov 2025 → Feb 2026)
- [x] Test: single-month range works (start = end)
- [x] Test: backfill does not affect snapshots outside the specified range
- [x] All tests pass

### Phase 2: Frontend — Backfill UI

#### Task 2.1 — [MODIFY] Add "Backfill History" flow to TeamMembersPanel
**Description**: Add a "Backfill History" button to `TeamMembersPanel` that opens a backfill flow. The flow includes start/end month-year selectors and the same multi-select seat picker used for "Add Members". Client-side validation prevents future months and invalid ranges. On submit, calls `POST /api/teams/[id]/members/backfill` and displays a success message with the count of months added.

**Definition of Done**:
- [x] "Backfill History" button visible in `TeamMembersPanel` below the header area, alongside the existing "Add Members" button
- [x] Clicking "Backfill History" opens the backfill flow (and closes Add Members flow if open)
- [x] Backfill flow includes: "Start Month" dropdown (month selector, Jan–Dec), "Start Year" dropdown (2020 to current year), "End Month" dropdown, "End Year" dropdown
- [x] Default date range: start = current month/year, end = current month/year
- [x] Client-side validation: disables the submit button and shows inline error if start date is after end date
- [x] Client-side validation: disables months/years that would result in future dates beyond the current month
- [x] Backfill flow includes a seat picker with the same search and multi-select pattern as the existing "Add Members" flow
- [x] Available seats are filtered to exclude already-assigned members for all months (or at minimum shown as-is since backfill is idempotent)
- [x] "Backfill Selected" submit button shows seat count (e.g., "Backfill Selected (3)")
- [x] Submit button is disabled when no seats are selected or date range is invalid
- [x] On successful submit (201), a success message is displayed: "Added X snapshots across Y months" (values from response)
- [x] On error, error message is displayed in an alert role
- [x] Loading indicator shown during backfill request
- [x] "Cancel" button closes the backfill flow
- [x] After successful backfill, the member list is refreshed (re-fetch GET /api/teams/[id]/members)
- [x] All interactive elements have proper `aria-*` attributes for accessibility
- [x] Error messages use `role="alert"`
- [x] Component uses the shared `MONTH_NAMES` constant from `src/lib/constants.ts`

### Phase 3: End-to-End Tests

#### Task 3.1 — [MODIFY] E2E tests for backfill flow
**Description**: Extend `e2e/team-members.spec.ts` with tests for the backfill history flow. Tests seed teams and seats via direct DB queries and exercise the full UI flow.

**Definition of Done**:
- [x] E2E tests for backfill exist in `e2e/team-members.spec.ts`
- [x] Test setup seeds teams and copilot seats via direct DB queries
- [x] Test: Can open backfill flow, select a date range and seats, submit, and see success message
- [x] Test: Backfilled member appears in team usage for the historical month (navigate to usage page with month parameter or verify via the DB)
- [x] Test: Cannot submit with future month (submit button disabled or validation error)
- [x] Test: Cannot submit when start date is after end date (submit button disabled or validation error)
- [x] Test: Idempotent — backfilling same seat/range again succeeds with "added: 0" or similar non-error indication
- [x] Test: Cannot backfill to a soft-deleted team (verify error message) — covered by unit test (soft-deleted team returns 404 at team lookup; UI cannot open members panel for deleted teams)
- [x] Tests clean up data in `beforeEach` to ensure isolation
- [x] All E2E tests pass

### Phase 4: Code Review

#### Task 4.1 — [REUSE] Code review by `tsh-code-reviewer` agent
**Description**: Run a full code review of all changes using the `tsh-code-reviewer` agent to verify code quality, consistency with existing patterns, security, and test coverage.

**Definition of Done**:
- [ ] All new files reviewed for adherence to project conventions
- [ ] Backfill API route follows the same error handling, auth, and validation patterns as existing team member routes
- [ ] Validation schema is consistent with existing Zod patterns
- [ ] Frontend component follows the same structure, styling, and accessibility patterns as the existing "Add Members" flow in `TeamMembersPanel`
- [ ] All unit tests and E2E tests pass
- [ ] No TypeScript compilation errors
- [ ] No ESLint violations

## Security Considerations

- **Authentication**: The backfill endpoint is protected by `requireAuth()`, consistent with all existing team and seat API routes. Unauthenticated requests receive 401.
- **Input Validation**: Server-side Zod validation enforces: seatIds as non-empty array of positive integers (max 100), month values 1–12, year values ≥ 2020, start ≤ end, no future months, max 24-month range.
- **Soft-Deleted Team Guard**: The endpoint checks `deletedAt IS NULL` before allowing backfill, preventing data mutations on logically deleted teams.
- **Seat Existence Check**: All provided seatIds are validated against the `copilot_seat` table before any inserts, preventing orphaned snapshot rows.
- **SQL Injection Prevention**: All database queries use parameterised placeholders (`$1`, `$2`, etc.) — no string interpolation of user input.
- **Write Amplification Cap**: Maximum 100 seatIds × 24 months = 2,400 rows per request. This limits the blast radius of a single request and prevents accidental mass writes.
- **Error Information Disclosure**: Internal errors return generic "Internal server error" without stack traces or implementation details.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] User can select a seat/person and specify a start month/year and end month/year
- [x] System creates team_member_snapshot entries for every month in the specified range
- [x] Months where the person already has a snapshot are skipped (idempotent)
- [x] Validation prevents selecting future months beyond the current month
- [x] Validation prevents submitting a date range where the start month/year is after the end month/year
- [x] Backfill is not allowed for soft-deleted teams — the system returns an error if the team has been deleted
- [x] Historical usage data reflects the backfilled composition immediately
- [x] A success message indicates how many months were added
- [x] All API endpoints require authentication
- [x] All inputs are validated with Zod schemas (server-side) and client-side for UX
- [x] Unit tests cover backfill endpoint and validation schema
- [x] E2E tests cover the full backfill flow including error cases
- [x] UI is accessible (proper labels, aria attributes)
- [x] No TypeScript or ESLint errors

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Batch progress indicator**: For very large backfill operations, show a progress bar or streamed feedback instead of a single success message.
- **Undo/rollback backfill**: Provide an option to undo a recently completed backfill (remove all snapshots that were created in the batch).
- **Preview before submit**: Show a summary of exactly which months/seats will be created before the user confirms the backfill.
- **Audit log**: Track who performed backfill operations, when, and for which date ranges — useful for compliance and debugging.
- **CSV import**: Allow bulk backfill by uploading a CSV file with columns for username, start month, end month.
- **Per-seat date ranges**: Allow specifying different date ranges for different seats in a single operation (current design applies the same range to all selected seats).

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation complete — Phases 1–3 delivered. 534 unit tests pass, 169 E2E tests pass, TypeScript clean. |
| 2026-03-01 | Fix: Button bar always visible so "Backfill History" is clickable when "Add Members" flow is open. Both buttons disabled when their respective flow is active. || 2026-03-01 | Code review: APPROVED. Fixed finding #1 (added route-level future-end-date test) and #2 (deduplicated seatIds field definition). 535 unit tests pass. |