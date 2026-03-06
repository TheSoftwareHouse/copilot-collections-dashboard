# Story 7.7: System automatically carries team composition forward to the next month - Implementation Plan

## Task Details

| Field | Value |
|---|---|
| Jira ID | Story 7.7 |
| Title | System automatically carries team composition forward to the next month |
| Description | At the start of a new month the system automatically copies the previous month's team composition snapshot for every active team, so teams retain their membership without manual re-entry. |
| Priority | Medium |
| Related Research | `specifications/copilot-usage-dashboard/jira-tasks.md` (Epic 7) |

## Proposed Solution

Introduce a new **team carry-forward** job that copies `team_member_snapshot` rows from the previous month to the current month for every non-deleted team. The job follows the same concurrency-guarded, idempotent pattern already established by `seat-sync` and `month-recollection`.

### Core SQL Operation

```sql
INSERT INTO team_member_snapshot ("teamId", "seatId", "month", "year")
SELECT tms."teamId", tms."seatId", $1, $2                -- target month/year
FROM team_member_snapshot tms
JOIN team t ON t.id = tms."teamId" AND t."deletedAt" IS NULL
WHERE tms.month = $3 AND tms.year = $4                    -- source (previous) month/year
ON CONFLICT ON CONSTRAINT "UQ_team_member_snapshot" DO NOTHING
```

- **Idempotency**: `ON CONFLICT DO NOTHING` ensures running the job multiple times creates no duplicates.
- **Soft-delete exclusion**: The `JOIN team` with `deletedAt IS NULL` filter excludes deleted teams.
- **No-snapshot handling**: If a team had no snapshots in the previous month, the `SELECT` naturally returns zero rows for that team — nothing is inserted.
- **Year boundary**: Previous-month calculation correctly rolls December (12) → January (1) of the next year.

### Trigger Mechanisms

1. **Automatic (scheduler)**: Added to the existing sync cycle in `instrumentation.ts`. On each cycle, the system checks whether a successful carry-forward exists for the current month. If not, it runs the carry-forward before proceeding with seat sync and usage collection.
2. **Manual (API)**: `POST /api/jobs/team-carry-forward` endpoint for on-demand execution.

### Data Flow

```
instrumentation.ts (scheduler cycle)
  └─> executeTeamCarryForward()          [new]
       ├─> Concurrency guard (pessimistic lock on job_execution)
       ├─> Calculate previous month/year
       ├─> INSERT ... SELECT ... ON CONFLICT DO NOTHING
       ├─> Create job_execution record (TEAM_CARRY_FORWARD)
       └─> Return result
  └─> executeSeatSync()                  [existing]
  └─> executeUsageCollection()           [existing]
```

## Current Implementation Analysis

### Already Implemented
- `Team` entity with soft delete (`deletedAt`) — `src/entities/team.entity.ts` — Full team CRUD with soft-delete support
- `TeamMemberSnapshot` entity — `src/entities/team-member-snapshot.entity.ts` — Has `UQ_team_member_snapshot` unique constraint on (`teamId`, `seatId`, `month`, `year`)
- `JobExecution` entity — `src/entities/job-execution.entity.ts` — Job tracking with status, timestamps, records processed
- `JobType` / `JobStatus` enums — `src/entities/enums.ts` — `SEAT_SYNC`, `USAGE_COLLECTION`, `MONTH_RECOLLECTION`
- Concurrency guard pattern (pessimistic locking) — `src/lib/seat-sync.ts`, `src/lib/month-recollection.ts` — Prevents duplicate concurrent jobs
- `ON CONFLICT DO NOTHING` snapshot insert pattern — `src/app/api/teams/[id]/members/route.ts` — Idempotent insert reusable approach
- Scheduler in `instrumentation.ts` — Runs seat sync → usage collection at configurable interval
- Job trigger API pattern — `src/app/api/jobs/seat-sync/route.ts`, `src/app/api/jobs/usage-collection/route.ts` — Auth-protected POST endpoints
- Job status monitoring — `src/app/api/job-status/route.ts` — Returns latest job per type
- Test infrastructure — `src/test/db-helpers.ts` — `getTestDataSource()`, `cleanDatabase()`, `destroyTestDataSource()`
- Migration pattern for new enum values — `migrations/1772300000000-AddMonthRecollectionJobType.ts` — `ALTER TYPE ... ADD VALUE IF NOT EXISTS`

### To Be Modified
- `src/entities/enums.ts` — Add `TEAM_CARRY_FORWARD = "team_carry_forward"` to `JobType` enum
- `instrumentation.ts` — Integrate carry-forward into the sync cycle (run before seat sync)
- `src/app/api/job-status/route.ts` — Include `TEAM_CARRY_FORWARD` in the status response
- `src/app/api/job-status/__tests__/route.test.ts` — Update test to cover the new job type

### To Be Created
- Migration `AddTeamCarryForwardJobType` — Adds `team_carry_forward` to the PostgreSQL enum
- `src/lib/team-carry-forward.ts` — Core carry-forward business logic
- `src/lib/__tests__/team-carry-forward.test.ts` — Unit tests for carry-forward logic
- `src/app/api/jobs/team-carry-forward/route.ts` — API endpoint for manual trigger
- `src/app/api/jobs/__tests__/team-carry-forward.route.test.ts` — Route-level tests

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should carry-forward run automatically on every scheduler cycle or only once per month? | On every cycle with an idempotency check — if the current month already has a successful carry-forward job execution, skip. This is simpler and self-healing. | ✅ Resolved |
| 2 | Should the scheduler sequence be carry-forward → seat sync → usage collection? | Yes. Carry-forward should run first so that the newly created month's snapshots are in place before usage data is collected. | ✅ Resolved |
| 3 | Does the carry-forward need its own concurrency guard? | Yes. Follows the established pattern from seat-sync and month-recollection to prevent duplicate concurrent executions. | ✅ Resolved |

## Implementation Plan

### Phase 1: Database & Enum Changes

#### Task 1.1 - [MODIFY] Add `TEAM_CARRY_FORWARD` to `JobType` enum
**Description**: Add the new `team_carry_forward` value to the `JobType` TypeScript enum in `src/entities/enums.ts`.

**Definition of Done**:
- [x] `JobType` enum in `src/entities/enums.ts` includes `TEAM_CARRY_FORWARD = "team_carry_forward"`
- [x] No other enum values are modified
- [x] TypeScript compiles without errors

#### Task 1.2 - [CREATE] Database migration for new enum value
**Description**: Create a TypeORM migration that adds `team_carry_forward` to the PostgreSQL `job_execution_jobtype_enum` type. Follow the exact pattern from `1772300000000-AddMonthRecollectionJobType.ts`.

**Definition of Done**:
- [x] Migration file created in `migrations/` with timestamp `1772900000000` and name `AddTeamCarryForwardJobType`
- [x] `up()` executes `ALTER TYPE "public"."job_execution_jobtype_enum" ADD VALUE IF NOT EXISTS 'team_carry_forward'`
- [x] `down()` logs a warning (PostgreSQL cannot remove enum values) — same pattern as existing migration
- [ ] Migration runs successfully against the database

---

### Phase 2: Core Carry-Forward Business Logic

#### Task 2.1 - [CREATE] `executeTeamCarryForward()` function
**Description**: Create `src/lib/team-carry-forward.ts` implementing the carry-forward logic. The function must:
1. Calculate the previous month/year (handling December → January rollover)
2. Check for a RUNNING carry-forward job using pessimistic locking (concurrency guard)
3. Check if a successful carry-forward already exists for the current month (idempotency — skip if found)
4. Create a `job_execution` record with type `TEAM_CARRY_FORWARD`
5. Execute the `INSERT ... SELECT ... ON CONFLICT DO NOTHING` query
6. Update the job record with success/failure status and `recordsProcessed` count
7. Return a result object following the same shape pattern as `SeatSyncResult` / `MonthRecollectionResult`

**Definition of Done**:
- [x] File `src/lib/team-carry-forward.ts` exists
- [x] Exports `executeTeamCarryForward()` function returning `TeamCarryForwardResult`
- [x] Skips with reason `"already_completed"` if a `SUCCESS` job exists for current month's carry-forward
- [x] Skips with reason `"already_running"` if a non-stale `RUNNING` job exists
- [x] Correctly calculates previous month (month 1 → month 12 of previous year)
- [x] SQL query joins `team` table with `deletedAt IS NULL` filter
- [x] SQL uses `ON CONFLICT ON CONSTRAINT "UQ_team_member_snapshot" DO NOTHING`
- [x] Job execution record created with `TEAM_CARRY_FORWARD` job type
- [x] `recordsProcessed` reflects the number of snapshot rows actually inserted
- [x] Error handling catches and records failures in the job execution record
- [x] Follows the same code structure and patterns as `src/lib/month-recollection.ts`

#### Task 2.2 - [CREATE] Unit tests for carry-forward logic
**Description**: Create `src/lib/__tests__/team-carry-forward.test.ts` with comprehensive tests. Follow the testing patterns established in `src/lib/__tests__/seat-sync.test.ts` and `src/lib/__tests__/month-recollection.test.ts`.

**Definition of Done**:
- [x] Test file exists at `src/lib/__tests__/team-carry-forward.test.ts`
- [x] Tests use real database via `getTestDataSource()` (not mocked)
- [x] Test: successfully carries forward snapshots from previous month to current month
- [x] Test: idempotent — running twice does not create duplicate snapshots
- [x] Test: soft-deleted teams are excluded from carry-forward
- [x] Test: teams with no snapshots in previous month get no snapshots in current month
- [x] Test: correctly handles year boundary (December → January)
- [x] Test: skips when a successful carry-forward job already exists for current month
- [x] Test: skips when another carry-forward job is already running (concurrency guard)
- [x] Test: records job execution with correct `recordsProcessed` count
- [x] Test: records failure in job execution when an error occurs
- [x] All tests pass with `vitest run`

---

### Phase 3: API Endpoint for Manual Trigger

#### Task 3.1 - [CREATE] `POST /api/jobs/team-carry-forward` route
**Description**: Create `src/app/api/jobs/team-carry-forward/route.ts` following the existing job endpoint patterns from `seat-sync/route.ts`. The endpoint requires authentication and triggers the carry-forward.

**Definition of Done**:
- [x] File `src/app/api/jobs/team-carry-forward/route.ts` exists
- [x] Exports `POST` handler
- [x] Requires authentication via `requireAuth()` (returns 401 if unauthenticated)
- [x] Calls `executeTeamCarryForward()` and returns the result
- [x] Returns appropriate status codes: 200 for success/skip, 500 for server errors
- [x] When skipped with reason `"already_completed"`, returns 200 with `skipped: true`
- [x] When skipped with reason `"already_running"`, returns 200 with `skipped: true`
- [x] Response shape matches conventions: `{ jobExecutionId, status, recordsProcessed, skipped, reason }`
- [x] Errors are logged to console

#### Task 3.2 - [CREATE] Route-level tests for carry-forward endpoint
**Description**: Create `src/app/api/jobs/__tests__/team-carry-forward.route.test.ts` following the pattern from `seat-sync.route.test.ts`.

**Definition of Done**:
- [x] Test file exists at `src/app/api/jobs/__tests__/team-carry-forward.route.test.ts`
- [x] Test: returns 401 when not authenticated
- [x] Test: successfully triggers carry-forward and returns job execution details
- [x] Test: returns skipped result when carry-forward already completed for current month
- [x] Test: creates a `job_execution` record with type `TEAM_CARRY_FORWARD`
- [x] All tests pass with `vitest run`

---

### Phase 4: Scheduler Integration

#### Task 4.1 - [MODIFY] Integrate carry-forward into the sync cycle
**Description**: Modify `instrumentation.ts` to run the carry-forward at the beginning of each sync cycle, before seat sync and usage collection. The carry-forward is self-guarding (skips if already completed for the month), so it's safe to call on every cycle.

**Definition of Done**:
- [x] `instrumentation.ts` imports and calls `executeTeamCarryForward()` at the start of `runSyncCycle()`
- [x] Carry-forward runs before seat sync (order: carry-forward → seat sync → usage collection)
- [x] Carry-forward failure does not block seat sync and usage collection (non-blocking, with error logging)
- [x] Console logging indicates carry-forward execution status
- [x] Existing seat sync and usage collection behavior is unchanged

---

### Phase 5: Job Status Monitoring

#### Task 5.1 - [MODIFY] Include `TEAM_CARRY_FORWARD` in job status endpoint
**Description**: Update `src/app/api/job-status/route.ts` to also query the latest `TEAM_CARRY_FORWARD` job and return it in the response.

**Definition of Done**:
- [x] `GET /api/job-status` response includes a `teamCarryForward` field alongside `seatSync` and `usageCollection`
- [x] `teamCarryForward` returns the latest job execution for `TEAM_CARRY_FORWARD` type or `null`
- [x] Response shape for `teamCarryForward` matches the other job types (id, jobType, status, startedAt, completedAt, errorMessage, recordsProcessed)

#### Task 5.2 - [MODIFY] Update job status route tests
**Description**: Update `src/app/api/job-status/__tests__/route.test.ts` to verify the new `teamCarryForward` field is returned.

**Definition of Done**:
- [x] Existing tests updated to expect the `teamCarryForward` field in responses
- [x] New test: returns `teamCarryForward: null` when no carry-forward jobs exist
- [x] New test: returns latest carry-forward job when one exists
- [x] All existing tests continue to pass

---

### Phase 6: Code Review

#### Task 6.1 - [REUSE] Automated code review
**Description**: Run `tsh-code-reviewer` agent to verify all changes meet project quality standards, follow established patterns, and have no security issues.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed
- [x] No critical or high severity issues remain

## Security Considerations

- **Authentication**: The manual trigger endpoint (`POST /api/jobs/team-carry-forward`) requires authentication via `requireAuth()`, consistent with all other job endpoints.
- **Concurrency**: Pessimistic locking on the `job_execution` table prevents race conditions if multiple requests or scheduler cycles attempt the carry-forward simultaneously.
- **SQL Injection**: All query parameters are parameterized (`$1`, `$2`, etc.) — no string concatenation of user input.
- **Data integrity**: The `UQ_team_member_snapshot` unique constraint at the database level guarantees no duplicate snapshots even under concurrent inserts.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] At the start of a new month, the system copies the previous month's team composition snapshot for every active team
- [x] The carry-forward is idempotent — running again does not create duplicates
- [x] Soft-deleted teams are excluded from carry-forward
- [x] Users can still add or remove members from the new month's snapshot after carry-forward
- [x] If the previous month had no snapshot for a team, no snapshot is created for the new month
- [x] The carry-forward operation is logged as a job execution for monitoring
- [x] Unit tests cover all core scenarios (happy path, idempotency, soft-delete exclusion, year boundary, concurrency guard)
- [x] Route tests verify authentication and endpoint behavior
- [x] Job status endpoint includes the new job type

## Improvements (Out of Scope)

- **UI indicator for carry-forward status**: A visual indicator on the team management page showing whether carry-forward has run for the current month. Could be useful for admin awareness but is not part of this story.
- **Configurable carry-forward toggle**: An environment variable to enable/disable automatic carry-forward (similar to `SEAT_SYNC_ENABLED`). Not required for initial implementation but could be added for flexibility.
- **Carry-forward for specific teams only**: API to selectively carry forward individual teams rather than all. Not in requirements.
- **Notification on carry-forward completion**: Alert admins when carry-forward completes, especially if it fails. Would require a notification system not yet in place.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-03-01 | Initial plan created |
| 2026-03-01 | Implementation completed. Code review findings: (MEDIUM-1) Added missing failure-path test, (MEDIUM-2) Switched from count-before/after to INSERT...RETURNING id for accurate recordsProcessed. All 502 tests pass. |
