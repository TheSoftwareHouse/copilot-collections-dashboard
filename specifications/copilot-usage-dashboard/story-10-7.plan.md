# Story 10.7: Two-Mode Member Removal (Purge vs Retire) — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 10.7 |
| Title | Two-mode member removal (purge vs retire) |
| Description | As a user, I want two options when removing a member from a team — retire (keep history) or purge (erase all history) — so that I can correctly manage team composition for different scenarios. |
| Priority | High |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (line 1822), `specifications/copilot-usage-dashboard/story-7-2.plan.md`, `specifications/copilot-usage-dashboard/story-7-7.plan.md` |

## Proposed Solution

Extend the existing team member removal system with two distinct modes — **retire** (default) and **purge** — each with different data-retention behaviour. The solution modifies the existing `DELETE /api/teams/[id]/members` endpoint to accept a `mode` parameter while preserving full backward compatibility, introduces a new purge-impact preview endpoint, and updates the `TeamMembersPanel` UI with a clear two-option removal flow.

### Core Behaviour

| Mode | SQL Scope | Historical Snapshots | Carry-Forward (7.7) | Use Case |
|---|---|---|---|---|
| **Retire** (default) | `WHERE month = currentMonth AND year = currentYear` | Preserved | Member excluded (not in current month) | Person left the team; keep historical attribution |
| **Purge** | No month/year filter — all months | Deleted | Member excluded (no snapshots exist) | Data correction; person was added by mistake |

### Data Flow

```
┌──────────────────────────┐       ┌────────────────────────────────────┐       ┌──────────────────────────────┐
│ TeamMembersPanel          │       │ DELETE /api/teams/[id]/members      │       │  PostgreSQL                  │
│ (two-mode removal UI)     │──────▶│ { seatIds, mode: "retire"|"purge" }│──────▶│  team_member_snapshot         │
│                            │       │                                    │       │  retire: currentMonth only   │
│ Retire → immediate         │       │ retire → month-scoped DELETE       │       │  purge:  ALL months          │
│ Purge → impact preview     │       │ purge  → team+seat scoped DELETE   │       │                              │
│        → confirm dialog    │       │                                    │       │                              │
└──────────────────────────┘       └────────────────────────────────────┘       └──────────────────────────────┘
         │                                    ▲
         │ GET /api/teams/[id]/members/       │
         │     purge-impact?seatId=X          │
         └────────────────────────────────────┘
         (fetched when user clicks "Purge" to show impact count
          before confirmation)
```

### Key Design Decisions

- **Single endpoint with `mode` param rather than separate routes**: The `DELETE /api/teams/[id]/members` endpoint already handles member removal. Adding `mode` keeps the API surface simple and maintains backward compatibility (defaulting to `"retire"`).
- **Separate purge-impact endpoint (`/purge-impact`)**: The UI needs the count of affected months *before* the user confirms the purge. A dedicated GET endpoint is cleanest — follows the same sub-route pattern as `/backfill`.
- **Inline confirmation UI (no modal)**: The project uses inline confirm/cancel patterns throughout (`TeamMembersPanel`, `TeamManagementPanel`, `UserManagementPanel`). The new flow extends this pattern: "Remove" → "Retire / Purge / Cancel" → (Purge) → "Confirm Purge / Cancel".
- **Carry-forward compatibility**: No changes needed to the carry-forward logic. Retire removes the current-month snapshot, so the next carry-forward won't copy the member. Purge removes all snapshots, achieving the same effect.

## Current Implementation Analysis

### Already Implemented
- `TeamMemberSnapshotEntity` — `src/entities/team-member-snapshot.entity.ts` — Snapshot entity with unique constraint on `(teamId, seatId, month, year)`, indexes on `(teamId, month, year)` and `(seatId)`
- `TeamEntity` — `src/entities/team.entity.ts` — Team table with soft-delete support (`deletedAt` column)
- `teamMembersSeatIdsSchema` — `src/lib/validations/team-members.ts` — Zod schema validating `{ seatIds: number[] }` with min(1), max(100), positive integer constraints
- `DELETE /api/teams/[id]/members` — `src/app/api/teams/[id]/members/route.ts` — Currently implements retire-only behaviour (deletes snapshots for current month/year)
- `TeamMembersPanel` — `src/components/teams/TeamMembersPanel.tsx` — Inline "Remove? Yes/No" confirmation pattern with single-mode removal
- `requireAuth()` / `isAuthFailure()` — `src/lib/api-auth.ts` — Auth guard used by all API routes
- DELETE route tests — `src/app/api/teams/__tests__/[id].members.route.test.ts` — Comprehensive tests for current (retire) behaviour
- E2E tests — `e2e/team-members.spec.ts` — Tests for member add/remove flows
- Carry-forward logic — `src/lib/team-carry-forward.ts` — Copies previous month snapshots to current month; no changes needed

### To Be Modified
- `src/lib/validations/team-members.ts` — Add `teamMembersRemoveSchema` with optional `mode` field
- `src/app/api/teams/[id]/members/route.ts` — Update `DELETE` handler to accept `mode` param and implement purge SQL
- `src/components/teams/TeamMembersPanel.tsx` — Replace simple "Remove? Yes/No" with two-mode removal flow (Retire/Purge)
- `src/app/api/teams/__tests__/[id].members.route.test.ts` — Add purge-mode tests alongside existing retire tests
- `e2e/team-members.spec.ts` — Add E2E tests for both removal modes

### To Be Created
- `src/app/api/teams/[id]/members/purge-impact/route.ts` — GET endpoint returning count of months affected by purge
- `src/app/api/teams/__tests__/[id].members.purge-impact.route.test.ts` — Integration tests for purge-impact endpoint

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should retire remain the default when no mode is specified? | Yes. This ensures backward compatibility with existing API consumers and tests. The `mode` field defaults to `"retire"` in the Zod schema. | ✅ Resolved |
| 2 | Does the carry-forward logic need modification? | No. Retire removes the current-month snapshot, so carry-forward won't copy the member next month. Purge removes all snapshots, achieving the same result. | ✅ Resolved |
| 3 | Should the purge-impact endpoint count include the current month? | Yes. The count represents all months that have snapshots for this member-team pair, including the current month, since purge deletes ALL of them. | ✅ Resolved |
| 4 | Should we use an inline confirmation or a modal dialog for purge? | Inline. The project uses inline confirm/cancel patterns everywhere (no modals exist). Extending to a two-step inline flow is consistent. | ✅ Resolved |

## Implementation Plan

### Phase 1: Validation Schema Update

#### Task 1.1 - [MODIFY] Add `teamMembersRemoveSchema` to validation module
**Description**: Add a new Zod schema in `src/lib/validations/team-members.ts` that extends the existing seat ID validation with an optional `mode` field (`"retire"` | `"purge"`, defaulting to `"retire"`). The existing `teamMembersSeatIdsSchema` remains unchanged for backward compatibility with the POST endpoint.

**Definition of Done**:
- [x] `teamMembersRemoveSchema` exported from `src/lib/validations/team-members.ts`
- [x] Schema accepts `{ seatIds: number[], mode?: "retire" | "purge" }`
- [x] `mode` defaults to `"retire"` when omitted
- [x] Existing `teamMembersSeatIdsSchema` is unchanged
- [x] TypeScript compiles without errors

---

### Phase 2: Purge-Impact API Endpoint

#### Task 2.1 - [CREATE] `GET /api/teams/[id]/members/purge-impact` route
**Description**: Create a new API route at `src/app/api/teams/[id]/members/purge-impact/route.ts` that returns the number of distinct months a given seat has snapshots for in a specific team. This data is used by the UI to show the purge impact before confirmation.

The endpoint:
1. Requires authentication via `requireAuth()`
2. Validates team ID parameter and `seatId` query parameter
3. Checks team exists and is not soft-deleted
4. Queries: `SELECT COUNT(*) FROM team_member_snapshot WHERE "teamId" = $1 AND "seatId" = $2`
5. Returns `{ months: N }`

**Definition of Done**:
- [x] File `src/app/api/teams/[id]/members/purge-impact/route.ts` exists
- [x] Exports `GET` handler
- [x] Requires authentication (returns 401 if unauthenticated)
- [x] Returns 400 for invalid team ID or missing/invalid `seatId` query parameter
- [x] Returns 404 for non-existent or soft-deleted team
- [x] Returns `{ months: N }` with count of snapshot rows for the given team and seat
- [x] Returns `{ months: 0 }` when no snapshots exist

#### Task 2.2 - [CREATE] Integration tests for purge-impact endpoint
**Description**: Create `src/app/api/teams/__tests__/[id].members.purge-impact.route.test.ts` following the established test patterns from `[id].members.route.test.ts`. Use `getTestDataSource()`, `cleanDatabase()`, mock `@/lib/db` and `next/headers`.

**Definition of Done**:
- [x] Test file exists at `src/app/api/teams/__tests__/[id].members.purge-impact.route.test.ts`
- [x] Tests use real database via `getTestDataSource()` (not mocked)
- [x] Test: returns 401 without session
- [x] Test: returns 400 for invalid team ID
- [x] Test: returns 400 for missing `seatId` query parameter
- [x] Test: returns 400 for non-numeric `seatId`
- [x] Test: returns 404 for non-existent team
- [x] Test: returns 404 for soft-deleted team
- [x] Test: returns `{ months: 0 }` when no snapshots exist for the seat in the team
- [x] Test: returns correct months count when snapshots exist across multiple months
- [x] Test: counts only snapshots for the specified team (not other teams)
- [x] All tests pass with `vitest run`

---

### Phase 3: Modify DELETE Endpoint for Two-Mode Removal

#### Task 3.1 - [MODIFY] Update `DELETE /api/teams/[id]/members` to support `mode` parameter
**Description**: Modify the existing DELETE handler in `src/app/api/teams/[id]/members/route.ts` to:
1. Switch from `teamMembersSeatIdsSchema` to `teamMembersRemoveSchema` for validation
2. Read the `mode` field (defaults to `"retire"`)
3. For `mode: "retire"` — keep existing behaviour (delete current month/year snapshots only)
4. For `mode: "purge"` — delete ALL snapshots for the given seatIds in this team (no month/year filter)
5. Return appropriate response shape for each mode:
   - Retire: `{ removed: N, month: M, year: Y }` (unchanged)
   - Purge: `{ removed: N, mode: "purge" }` (total rows deleted across all months)

**Definition of Done**:
- [x] DELETE handler uses `teamMembersRemoveSchema` for validation
- [x] `mode: "retire"` (default) retains the existing current-month-only deletion behaviour
- [x] `mode: "purge"` executes `DELETE FROM team_member_snapshot WHERE "teamId" = $1 AND "seatId" IN (...)` without month/year filter
- [x] Retire response: `{ removed: N, month: M, year: Y }` (backward compatible)
- [x] Purge response: `{ removed: N, mode: "purge" }`
- [x] All existing DELETE tests continue to pass without modification (they use default retire mode)
- [x] TypeScript compiles without errors

#### Task 3.2 - [MODIFY] Add purge-mode integration tests to DELETE test suite
**Description**: Add new test cases to `src/app/api/teams/__tests__/[id].members.route.test.ts` for the purge mode. These should test the destructive behaviour and verify that all months' snapshots are deleted.

**Definition of Done**:
- [x] Test: purge mode removes snapshots from ALL months (not just current)
- [x] Test: purge mode returns total count of removed snapshots across all months
- [x] Test: purge mode response includes `mode: "purge"`
- [x] Test: purge with non-existent team returns 404
- [x] Test: purge with soft-deleted team returns 404
- [x] Test: purge does not affect other teams' snapshots for the same seat
- [x] Test: purge does not affect other seats' snapshots in the same team
- [x] Test: purge with seat that has no snapshots succeeds with `removed: 0`
- [x] All existing retire-mode tests continue to pass unmodified
- [x] All tests pass with `vitest run`

---

### Phase 4: Frontend — Two-Mode Removal UI

#### Task 4.1 - [MODIFY] Update `TeamMembersPanel` with two-mode removal flow
**Description**: Replace the current simple "Remove? Yes / No" inline confirmation in `TeamMembersPanel` with a two-step flow that provides both retire and purge options:

**Step 1 — Mode selection** (replaces current "Remove? Yes/No"):
When user clicks "Remove" on a member row, show three inline options:
- **Retire** — Executes immediately (like old "Yes"): calls `DELETE` with `mode: "retire"`, removes from current month only
- **Purge** — Transitions to step 2 for confirmation
- **Cancel** — Collapses back (like old "No")

Brief explanatory text should be visible:
- Next to Retire: "current month only"
- Next to Purge: "all months"

**Step 2 — Purge confirmation** (new):
When user clicks "Purge":
1. Fetch `GET /api/teams/[id]/members/purge-impact?seatId=X`
2. Display impact: "This will remove {username} from {N} months of team history."
3. Show two buttons: **Confirm Purge** (red, executes the DELETE with `mode: "purge"`) and **Cancel**
4. Show a loading indicator while the purge-impact request is in flight
5. Show a loading indicator while the purge delete is in progress

**State management additions**:
- `removeMode`: `null | "choose" | "purge-confirm"` — tracks the removal flow step
- `purgeImpactMonths`: `number | null` — count from the purge-impact API
- `isPurgeImpactLoading`: `boolean` — loading state for the impact fetch
- `isPurging`: `boolean` — loading state for the purge delete

**Definition of Done**:
- [x] Clicking "Remove" shows three options: "Retire" (with "current month only"), "Purge" (with "all months"), "Cancel"
- [x] "Retire" calls `DELETE` with `mode: "retire"` and refreshes the member list on success
- [x] "Purge" fetches purge-impact count and shows confirmation text with the month count
- [x] Purge confirmation dialog shows "This will remove {username} from {N} months of team history."
- [x] "Confirm Purge" button calls `DELETE` with `mode: "purge"` and refreshes the member list on success
- [x] "Cancel" at any step collapses back to the normal member row
- [x] Loading indicators are shown during purge-impact fetch and purge execution
- [x] Error states are handled (network error, API error) with user-friendly messages
- [x] Only one member can be in the remove flow at a time (clicking "Remove" on another member cancels the previous)
- [x] TypeScript compiles without errors

---

### Phase 5: E2E Tests

#### Task 5.1 - [MODIFY] Update existing removal E2E test and add E2E tests for both modes
**Description**: Update `e2e/team-members.spec.ts` to cover the new two-mode removal flow. The existing "can remove a seat from a team" test needs to be updated to work with the new UI flow (clicking "Retire" instead of "Yes"). Add new tests for the purge flow.

**Definition of Done**:
- [x] Existing "can remove a seat from a team" test updated to use the new "Retire" button instead of "Yes"
- [x] New test: retire removes member from current month but preserves historical snapshots
- [x] New test: purge flow shows impact count and requires explicit confirmation
- [x] New test: purge removes member from ALL months (verified via database query)
- [x] New test: cancelling the purge confirmation returns to normal state
- [x] All existing E2E tests in `team-members.spec.ts` continue to pass
- [x] All new E2E tests pass with `npx playwright test e2e/team-members.spec.ts`

---

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Automated code review
**Description**: Run `tsh-code-reviewer` agent to verify all changes meet project quality standards, follow established patterns, and have no security issues.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed
- [x] No critical or high severity issues remain

## Security Considerations

- **Authentication**: All endpoints (DELETE, purge-impact GET) require authentication via `requireAuth()`, consistent with all other team API routes.
- **Destructive operation protection**: Purge mode deletes historical data irrecoverably. The UI enforces a two-step confirmation flow, and the confirmation dialog explicitly states the scope of data loss (number of months affected).
- **SQL injection prevention**: All query parameters are parameterized (`$1`, `$2`, etc.) — no string concatenation of user input in SQL queries. The `mode` parameter is validated against a strict enum (`"retire"` | `"purge"`) via Zod.
- **Authorization scope**: The purge operation is scoped to a specific team and specific seat IDs. It cannot affect data in other teams due to the `WHERE "teamId" = $1` clause.
- **Soft-delete team check**: Both retire and purge check that the team exists and is not soft-deleted before executing, preventing operations on archived teams.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Retire (default): Remove the member from the current month only. Historical snapshots are preserved. The person will not be carried forward by Story 7.7.
- [x] Purge: Remove the member from ALL months. All `team_member_snapshot` entries for this person in this team are deleted.
- [x] The purge option requires explicit confirmation dialog
- [x] The purge confirmation dialog shows impact scope (number of months affected)
- [x] The UI clearly explains the consequence of each option before the user confirms
- [x] After removal, the team's member list and usage data are updated accordingly
- [x] Existing retire-only DELETE tests pass without modification (backward compatibility)
- [x] New purge-mode integration tests cover destructive behaviour and cross-team isolation
- [x] Purge-impact endpoint tests cover all validation and edge cases
- [x] E2E tests verify both modes end-to-end through the UI

## Improvements (Out of Scope)

- **Undo/restore capability for purge**: Currently, purge is irreversible. A future improvement could implement a "trash" or soft-delete mechanism for snapshots to allow undo within a time window.
- **Bulk purge for multiple members**: The current UI handles one member at a time. A bulk purge flow (selecting multiple members and purging all at once) could be added if the use case arises.
- **Audit log for destructive operations**: Logging purge actions (who purged, which member, how many months affected) to an audit table would provide accountability for irreversible data changes.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-02 | Initial plan created |
