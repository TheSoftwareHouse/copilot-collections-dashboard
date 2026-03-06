# Story 3.2: System flags unused seats with appropriate status — Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 3.2 |
| Title | System flags unused seats with appropriate status |
| Description | Extend the existing seat sync pipeline so that seats no longer returned by the GitHub API are flagged as INACTIVE, and seats that reappear in subsequent syncs are restored to ACTIVE. Seats are never deleted from the database. This ensures administrators always have an accurate view of which seats are currently assigned and which have been removed from the Copilot subscription. |
| Priority | Highest |
| Related Research | `specifications/copilot-usage-dashboard/extracted-tasks.md`, `specifications/copilot-usage-dashboard/quality-review.md`, `specifications/copilot-usage-dashboard/story-3-1.plan.md` |

## Proposed Solution

Modify the existing `executeSeatSync()` function in `src/lib/seat-sync.ts` to add two behaviours within the existing transaction:

1. **Active restoration**: When an existing seat appears in the GitHub API response, explicitly set its `status` to `ACTIVE`. This handles the case where a previously INACTIVE seat reappears in the API (e.g., a Copilot licence is reassigned).

2. **Inactive flagging**: After all API seats have been upserted, issue a single bulk `UPDATE` to mark any remaining `ACTIVE` seats whose `githubUsername` is NOT in the current API response as `INACTIVE`.

Both operations happen inside the same database transaction that already wraps the upsert loop, maintaining transactional integrity — if anything fails, the entire batch (upserts + status changes) is rolled back.

### Architecture Overview

```
executeSeatSync() — updated flow
──────────────────────────────────────────────────────────────

1. Check configuration exists → skip if not
2. Create JobExecution(SEAT_SYNC, RUNNING)
3. Fetch all seats via GitHub API (paginated)
4. BEGIN TRANSACTION
   4a. For each API seat:
       - Find by githubUsername
       - If exists → update metadata + set status = ACTIVE  ← NEW (restoration)
       - If new    → insert with status = ACTIVE
   4b. Collect set of API usernames                         ← NEW
   4c. UPDATE copilot_seat                                  ← NEW (flagging)
       SET status = INACTIVE
       WHERE status = ACTIVE
       AND githubUsername NOT IN (<api usernames>)
5. COMMIT TRANSACTION
6. Update JobExecution(SUCCESS, recordsProcessed, recordsDeactivated)
```

### Key Design Decisions

1. **Single transaction for upserts and status updates**: The inactive flagging runs in the same transaction as the seat upserts. This ensures atomicity — if the flagging fails, the upserts are rolled back too, preserving the "existing seat data is not corrupted when a sync fails" guarantee.

2. **Bulk UPDATE for inactive flagging**: Instead of iterating over each seat to check if it's still in the API response, a single SQL `UPDATE ... WHERE githubUsername NOT IN (...)` statement is used. This is efficient even for large seat counts and avoids N+1 queries.

3. **Empty API response handling**: If the GitHub API returns zero seats (successful response, but empty list), ALL currently ACTIVE seats are marked INACTIVE. This is correct — a successful empty response means no seats are assigned. The edge case is handled separately to avoid SQL issues with empty `NOT IN` clauses.

4. **Explicit ACTIVE restoration on upsert**: Currently, the upsert for existing seats does not touch the `status` field. This change adds `status: SeatStatus.ACTIVE` to every existing-seat update. This is the mechanism for restoring previously inactive seats — no separate query needed.

5. **`recordsDeactivated` in result**: The `SeatSyncResult` interface is extended with an optional `recordsDeactivated` field to provide operational visibility. The API response is also extended to include this value. This is additive and backward-compatible.

6. **Enrichment data preservation**: The inactive flagging bulk UPDATE only touches the `status` column. Enrichment fields (`firstName`, `lastName`, `department`) remain untouched. Similarly, the active restoration via upsert already preserves enrichment fields (spread of `...existing`).

7. **No UI changes required**: The acceptance criterion "The status of each seat is clearly visible in the seat list" is fulfilled by the data model (status column already exists and is populated). The seat list UI is Story 3.3's scope.

### API Contracts

**POST /api/jobs/seat-sync** (updated response)

| Status | Body |
|--------|------|
| 200 | `{ jobExecutionId, status: "success", recordsProcessed, recordsDeactivated }` |
| 200 | `{ jobExecutionId, status: "failure", errorMessage }` |
| 401 | `{ error: "Authentication required" }` |
| 409 | `{ error: "Configuration not found. Complete first-run setup before syncing." }` |

The `recordsDeactivated` field is added to the success response. It reports how many seats were marked INACTIVE during the sync.

## Current Implementation Analysis

### Already Implemented
- `src/entities/copilot-seat.entity.ts` — `CopilotSeat` entity with `status` column using `SeatStatus` enum, `ACTIVE` default, and index on `status` — fully reusable, no changes needed
- `src/entities/enums.ts` — `SeatStatus` enum with `ACTIVE` and `INACTIVE` values — fully reusable, no changes needed
- `src/lib/github-api.ts` — GitHub API client with pagination, error handling, and typed responses — fully reusable, no changes needed
- `src/lib/seat-sync.ts` — `executeSeatSync()` function with configuration check, job execution logging, paginated seat fetch, transactional upsert, and error handling — to be modified
- `src/app/api/jobs/seat-sync/route.ts` — Auth-guarded POST endpoint for manual sync — to be modified (response extension)
- `src/lib/__tests__/seat-sync.test.ts` — Integration tests for sync service with mocked GitHub API — to be extended
- `src/app/api/jobs/__tests__/seat-sync.route.test.ts` — Integration tests for API route — to be extended
- `src/test/db-helpers.ts` — Test database setup and cleanup — fully reusable, no changes needed
- `instrumentation.ts` — Daily sync scheduler — no changes needed
- `src/components/settings/JobStatusPanel.tsx` — Sync Now button and status display — no changes needed
- `migrations/1772266160629-CreateCopilotSeat.ts` — Database migration for `copilot_seat` table — no changes needed

### To Be Modified
- `src/lib/seat-sync.ts` — Add `status: SeatStatus.ACTIVE` to existing seat updates (restoration), add bulk INACTIVE flagging after upsert loop, extend `SeatSyncResult` with `recordsDeactivated`, add logging for deactivated count
- `src/app/api/jobs/seat-sync/route.ts` — Include `recordsDeactivated` in the success response body
- `src/lib/__tests__/seat-sync.test.ts` — Add tests for inactive flagging and active restoration scenarios
- `src/app/api/jobs/__tests__/seat-sync.route.test.ts` — Add test verifying `recordsDeactivated` in API response

### To Be Created
- No new files are needed. All changes are modifications to existing files.

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | What defines a seat as "unused" — is it based on the GitHub API not returning it, or based on zero usage activity? | Based on the GitHub API not returning it. If a seat is no longer in the API response, it means the Copilot licence has been removed or reassigned. Zero usage with an active seat is a different concern (addressed by dashboard analytics in later stories). | ✅ Resolved |
| 2 | Should an empty API response (zero seats returned successfully) mark all existing seats as INACTIVE? | Yes. A successful API response with zero seats means no Copilot seats are currently assigned. All active seats should be marked INACTIVE. The API error case (which would throw `GitHubApiError`) is handled separately — it rolls back and preserves existing data. | ✅ Resolved |
| 3 | Should the inactive flagging happen within the same transaction as the upsert? | Yes. Both operations must be atomic to prevent a state where seats are upserted but not flagged (or vice versa). The existing transaction in `executeSeatSync()` is extended to include the flagging. | ✅ Resolved |
| 4 | Does the status need to be visible in a UI? | The acceptance criterion states "The status of each seat is clearly visible in the seat list." The `status` column already exists in the data model. The seat list UI is delivered by Story 3.3, which includes status as a displayed column. No UI changes are needed for Story 3.2. | ✅ Resolved |
| 5 | Should `recordsDeactivated` be stored in `JobExecution`? | No. The `JobExecution` entity has `recordsProcessed` (number of seats upserted from API). Adding a new column for deactivated counts would require a migration. Instead, `recordsDeactivated` is returned in the API response and logged to console — sufficient for operational visibility without schema changes. | ✅ Resolved |

## Implementation Plan

### Phase 1: Sync Service Logic

#### Task 1.1 - [MODIFY] Add inactive seat flagging and active seat restoration to `executeSeatSync()` in `src/lib/seat-sync.ts`
**Description**: Modify the existing sync service to: (a) explicitly set `status: SeatStatus.ACTIVE` when updating existing seats from the API response (enabling restoration of previously inactive seats), (b) after the upsert loop and within the same transaction, bulk-update all remaining ACTIVE seats not in the API response to INACTIVE, and (c) extend `SeatSyncResult` with `recordsDeactivated`. Handle the edge case of an empty API response (mark all active seats as inactive).

**Definition of Done**:
- [x] `SeatSyncResult` interface extended with optional `recordsDeactivated: number` field
- [x] Existing seat update within the upsert loop includes `status: SeatStatus.ACTIVE` to restore previously inactive seats
- [x] After the upsert loop, within the same transaction, a bulk UPDATE marks all ACTIVE seats whose `githubUsername` is NOT in the API response as INACTIVE
- [x] Edge case handled: when API returns zero seats, all ACTIVE seats are marked INACTIVE (avoids empty `NOT IN` clause)
- [x] Enrichment fields (`firstName`, `lastName`, `department`) are NOT touched by the inactive flagging UPDATE
- [x] `recordsDeactivated` count is captured from the bulk UPDATE `affected` rows count
- [x] Success result includes `recordsDeactivated` value
- [x] Console log added: `"Marked {n} seat(s) as inactive"` (logged only when n > 0)
- [x] File compiles without TypeScript errors

#### Task 1.2 - [MODIFY] Include `recordsDeactivated` in API route response at `src/app/api/jobs/seat-sync/route.ts`
**Description**: Extend the success response body of the manual sync trigger endpoint to include the `recordsDeactivated` field from the sync result. This provides immediate feedback to admins using the "Sync Now" button about how many seats were flagged as inactive.

**Definition of Done**:
- [x] Success response includes `recordsDeactivated` field: `{ jobExecutionId, status, recordsProcessed, recordsDeactivated }`
- [x] `recordsDeactivated` defaults to `null` when not present in the result (backward compatibility)
- [x] Failure response is unchanged
- [x] File compiles without TypeScript errors

### Phase 2: Testing

#### Task 2.1 - [MODIFY] Add seat sync service tests for status management in `src/lib/__tests__/seat-sync.test.ts`
**Description**: Add integration tests covering the new inactive flagging and active restoration behaviours. Tests use the existing test database infrastructure and mocked GitHub API.

**Definition of Done**:
- [x] Test: marks ACTIVE seats not in API response as INACTIVE — pre-seed 3 seats, return only 2 from API, verify the missing seat is INACTIVE and `recordsDeactivated` is 1
- [x] Test: does NOT mark seats that ARE in the API response as INACTIVE — pre-seed 2 seats, return both from API, verify both remain ACTIVE and `recordsDeactivated` is 0
- [x] Test: restores previously INACTIVE seat to ACTIVE when it reappears in API response — pre-seed a seat with `status: INACTIVE`, return it from API, verify it is now ACTIVE
- [x] Test: preserves enrichment data (`firstName`, `lastName`, `department`) when marking a seat as INACTIVE — pre-seed a seat with enrichment data, exclude it from API response, verify enrichment fields are unchanged after sync
- [x] Test: marks ALL active seats as INACTIVE when API returns empty list — pre-seed 2 ACTIVE seats, return empty array from API, verify both are INACTIVE and `recordsDeactivated` is 2
- [x] Test: already INACTIVE seats are not double-counted — pre-seed 1 ACTIVE + 1 INACTIVE seat, exclude both from API response, verify `recordsDeactivated` is 1 (only the previously ACTIVE one)
- [x] All new tests pass alongside existing tests
- [x] Database cleaned between tests for isolation

#### Task 2.2 - [MODIFY] Add API route test for `recordsDeactivated` in `src/app/api/jobs/__tests__/seat-sync.route.test.ts`
**Description**: Add an integration test that verifies the API route response includes the `recordsDeactivated` field and that the inactive flagging works end-to-end through the API.

**Definition of Done**:
- [x] Test: successful sync response includes `recordsDeactivated` field — seed 3 seats, return only 2 from API via the POST endpoint, verify the response contains `recordsDeactivated: 1`
- [x] Test: verifies seat status in database after sync through API — after the POST call, query the database to confirm the missing seat is INACTIVE and the returned seats are ACTIVE
- [x] All new tests pass alongside existing tests
- [x] Database cleaned between tests for isolation

### Phase 3: Code Review

#### Task 3.1 - [REUSE] Code Review by tsh-code-reviewer
**Description**: Final code review performed by the `tsh-code-reviewer` agent to ensure code quality, security, adherence to best practices, and completeness against the acceptance criteria.

**Definition of Done**:
- [x] All modified source code reviewed by `tsh-code-reviewer` agent
- [x] No critical or high-severity issues remain unresolved
- [x] All review feedback addressed or documented as intentional design decisions
- [x] Code follows project conventions (TypeORM EntitySchema pattern, TypeScript strict mode, existing test patterns)
- [x] Test coverage is adequate for the feature scope

## Security Considerations

- **No new attack surface**: This change modifies internal sync logic only. No new endpoints, entities, or authentication flows are introduced.
- **Bulk UPDATE scoped by status**: The inactive flagging query is tightly scoped (`WHERE status = ACTIVE AND githubUsername NOT IN (...)`) — it cannot accidentally modify other columns or affect seats already marked INACTIVE.
- **Transactional integrity preserved**: All changes (upserts + flagging) remain within a single transaction. A failure at any point rolls back everything, preventing inconsistent seat states.
- **No sensitive data in logs**: The console log for deactivated seats reports only a count, not usernames or other identifying information.
- **Enrichment data protection**: The bulk UPDATE explicitly targets only the `status` column. User-provided enrichment data (`firstName`, `lastName`, `department`) cannot be overwritten by the flagging logic.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Seats that are no longer returned by the GitHub API are marked as `INACTIVE` (verified by integration test: pre-seed seats, exclude from API response, check status)
- [x] Seats are never deleted from the application database (verified by existing behaviour — no DELETE queries in sync service; test confirms seat count does not decrease)
- [x] The status of each seat is stored correctly in the `copilot_seat.status` column (verified by database assertions in tests; UI visibility is Story 3.3's scope)
- [x] Previously unused (INACTIVE) seats that reappear in the API response are restored to `ACTIVE` status (verified by integration test: pre-seed INACTIVE seat, return from API, check status is ACTIVE)
- [x] Enrichment data is preserved when seats are marked INACTIVE (verified by test: check firstName, lastName, department unchanged after flagging)
- [x] Enrichment data is preserved when seats are restored to ACTIVE (verified by existing test: existing test already covers enrichment preservation during upsert)
- [x] Transactional integrity is maintained — a failure during flagging rolls back upserts (verified by existing transaction rollback test)
- [x] Empty API response marks all active seats as INACTIVE (verified by test)
- [x] `recordsDeactivated` is included in the sync result and API response (verified by test)
- [x] All new tests pass
- [x] All existing tests continue to pass (no regressions)
- [x] No TypeScript compilation errors
- [x] No ESLint warnings or errors

## Improvements (Out of Scope)

- **Seat status change event logging**: Record individual seat status transitions (ACTIVE→INACTIVE, INACTIVE→ACTIVE) with timestamps in a separate audit table. This would enable historical analysis of seat churn without relying solely on sync job logs.
- **Notification on seats becoming inactive**: Trigger an alert (in-app or email) when seats are flagged as inactive, so admins are proactively informed rather than having to check the seat list.
- **Configurable grace period**: Instead of immediately flagging seats as INACTIVE when they disappear from the API, wait for N consecutive syncs before flagging. This would handle transient API issues more gracefully.
- **Inactive seat count on dashboard**: Display a summary metric showing the number of inactive seats on the main dashboard (Story 5.1 scope, not 3.2).
- **Soft-delete timestamp**: Add an `inactiveSince` timestamp column to track when a seat was first marked inactive, enabling "inactive for X days" reporting.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed: all Phase 1 and Phase 2 tasks done. 132/132 tests passing, build succeeds. |
| 2026-02-28 | Code review by tsh-code-reviewer: APPROVED. No critical or high-severity findings. 1 medium finding (M1: recordsDeactivated not persisted to JobExecution) acknowledged as intentional trade-off per Open Question #5. 3 low findings (grammar nit, N+1 pre-existing pattern, NOT IN scalability) — all out of scope or trivial. |
