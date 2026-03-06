# Fix Sync Race Conditions: Ensure Seat Sync Completes Before Usage Collection

## Task Details

| Field | Value |
|---|---|
| Jira ID | N/A |
| Title | Fix Sync Race Conditions: Seats Must Sync Before Usage Collection |
| Description | The seat sync and usage collection schedulers in `instrumentation.ts` run as independent `setInterval` timers with no coordination. Usage collection depends on an up-to-date seat list (it queries `ACTIVE` seats), but there is no guarantee that seat sync has completed—or even started—before usage collection runs. This leads to stale seat data being used: new seats are missed, removed seats are still considered active, and usage data is collected for an incorrect set of users. |
| Priority | High (data correctness — usage is collected for wrong set of users) |
| Related Research | N/A |

## Proposed Solution

### Root Cause Analysis

The scheduling is implemented in [instrumentation.ts](instrumentation.ts) using two independent mechanisms:

```
setInterval(runSeatSync, seatSyncIntervalMs);    // e.g. every 24h
setInterval(runUsageCollection, usageIntervalMs); // e.g. every 24h
```

On startup:
- Seat sync fires after **10s** (`setTimeout(runSeatSync, 10_000)`)
- Usage collection fires after **15s** (`setTimeout(runUsageCollection, 15_000)`)

**Race conditions identified:**

1. **Timer drift**: Both intervals are independent. Over hours/days, `setInterval` drift means usage collection can fire before seat sync. Since seat sync involves API calls + DB transactions (potentially taking minutes), usage collection could start while seat sync is mid-flight or hasn't started.

2. **Startup race**: The 5-second gap (10s vs 15s) is not sufficient. If the GitHub API is slow or the DB transaction takes longer than 5 seconds, usage collection starts with stale seat data.

3. **No concurrency guards**: Unlike `executeMonthRecollection()` (which uses pessimistic locking to prevent concurrent runs), neither `executeSeatSync()` nor `executeUsageCollection()` has any concurrency guard. Multiple overlapping runs are possible if intervals are short or jobs run long.

4. **Concurrent `refreshDashboardMetrics()`**: Both jobs call `refreshDashboardMetrics()` on completion. Concurrent execution can cause conflicting upserts to `dashboard_monthly_summary`.

### What happens now vs what should happen

| Scenario | Current (Broken) | Expected (Fixed) |
|---|---|---|
| Daily sync cycle | Seat sync and usage collection fire independently; usage may run on stale seat list | Usage collection always runs after seat sync completes successfully |
| Startup | 10s/15s timeouts; usage can start before seat sync finishes | Usage collection waits for seat sync to finish |
| Seat sync failure | Usage collection runs anyway with potentially stale data | Usage collection is skipped or runs with knowledge that seats are stale |
| Overlapping intervals | Two seat syncs or two usage collections can run concurrently | Only one instance of each job runs at a time |

### Solution

Replace the two independent `setInterval` schedulers with a **single sequential scheduler** that orchestrates both jobs in the correct order: seat sync first, then usage collection. Add concurrency guards to both `executeSeatSync()` and `executeUsageCollection()` following the pattern already established by `executeMonthRecollection()`.

**Key design decisions:**

1. **Sequential orchestration in `instrumentation.ts`**: A single `setInterval` that runs `runSeatSync()` → awaits completion → runs `runUsageCollection()`. This guarantees ordering.

2. **Concurrency guards using pessimistic DB locking**: Both `executeSeatSync()` and `executeUsageCollection()` will check for an existing `RUNNING` job of the same type (with a stale-job threshold) before starting. This prevents overlapping executions even when triggered via the manual API endpoints.

3. **Usage collection checks seat sync freshness**: Before collecting usage, check that a successful seat sync has completed within a configurable window (default: same interval). If not, log a warning but proceed (users might have triggered usage collection manually).

### Data Flow

```
instrumentation.ts — single scheduler
│
├── runSyncCycle() — runs at configured interval
│   │
│   ├── 1. executeSeatSync()
│   │   ├── Concurrency guard: check RUNNING seat_sync job (pessimistic lock)
│   │   ├── If already running → skip
│   │   ├── Fetch seats from GitHub API
│   │   ├── Upsert seats in DB (transaction)
│   │   ├── Mark inactive seats
│   │   ├── refreshDashboardMetrics()
│   │   └── Return result (success/failure/skipped)
│   │
│   ├── 2. IF seat sync succeeded:
│   │   └── executeUsageCollection()
│   │       ├── Concurrency guard: check RUNNING usage_collection job (pessimistic lock)
│   │       ├── If already running → skip
│   │       ├── Fetch ACTIVE seats (now guaranteed fresh)
│   │       ├── For each seat: fetch usage from GitHub API, upsert
│   │       ├── refreshDashboardMetrics()
│   │       └── Return result
│   │
│   └── 3. IF seat sync failed or was skipped:
│       └── Log warning, skip usage collection
│
└── On startup (if enabled):
    └── setTimeout(runSyncCycle, 10_000)  — single timeout, sequential
```

## Current Implementation Analysis

### Already Implemented
- `src/lib/seat-sync.ts` — `executeSeatSync()` function with full seat upsert logic — **TO BE MODIFIED** (add concurrency guard)
- `src/lib/usage-collection.ts` — `executeUsageCollection()` function with per-user usage fetching — **TO BE MODIFIED** (add concurrency guard)
- `src/lib/month-recollection.ts` — `executeMonthRecollection()` with pessimistic locking concurrency guard — **REUSE as pattern reference**
- `instrumentation.ts` — Scheduler with independent `setInterval` calls — **TO BE MODIFIED** (replace with sequential orchestration)
- `src/entities/enums.ts` — `JobType`, `JobStatus`, `SeatStatus` enums — **REUSE as-is**
- `src/entities/job-execution.entity.ts` — Job execution entity with type, status, timestamps — **REUSE as-is**
- `src/app/api/jobs/seat-sync/route.ts` — Manual seat sync trigger endpoint — **REUSE as-is**
- `src/app/api/jobs/usage-collection/route.ts` — Manual usage collection trigger endpoint — **REUSE as-is**
- `src/lib/__tests__/seat-sync.test.ts` — Seat sync unit tests (466 lines) — **TO BE MODIFIED** (add concurrency guard tests)
- `src/lib/__tests__/usage-collection.test.ts` — Usage collection unit tests (716 lines) — **TO BE MODIFIED** (add concurrency guard tests)
- `src/lib/dashboard-metrics.ts` — `refreshDashboardMetrics()` — **REUSE as-is**
- `e2e/job-status.spec.ts` — E2E tests for job status display — **REUSE as-is**

### To Be Modified
- `instrumentation.ts` — Replace two independent schedulers with a single sequential orchestrator
- `src/lib/seat-sync.ts` — Add concurrency guard (pessimistic locking pattern from `month-recollection.ts`)
- `src/lib/usage-collection.ts` — Add concurrency guard (pessimistic locking pattern from `month-recollection.ts`)
- `src/lib/__tests__/seat-sync.test.ts` — Add tests for concurrency guard (skip when already running, stale job handling)
- `src/lib/__tests__/usage-collection.test.ts` — Add tests for concurrency guard (skip when already running, stale job handling)

### To Be Created
- None — all changes are modifications to existing files

## Open Questions

| # | Question | Answer | Status |
|---|----------|--------|--------|
| 1 | Should usage collection be skipped entirely if seat sync fails, or should it proceed with a warning? | Skip usage collection if seat sync fails. The whole point is that seats must be fresh. Log a warning. When triggered manually via API endpoints, usage collection still works independently. | ✅ Resolved |
| 2 | What should the stale job threshold be for seat sync and usage collection concurrency guards? | 2 hours, matching the existing `STALE_JOB_THRESHOLD_MS` in `month-recollection.ts`. A seat sync or usage collection running for more than 2 hours is almost certainly stuck. | ✅ Resolved |
| 3 | Should both env vars `SEAT_SYNC_INTERVAL_HOURS` and `USAGE_COLLECTION_INTERVAL_HOURS` be kept, or merged into one? | Merge into a single `SYNC_INTERVAL_HOURS` (default `24`) since both now run as one sequential cycle. Keep the old env vars as fallbacks for backward compatibility: the scheduler reads `SYNC_INTERVAL_HOURS` first, then falls back to `SEAT_SYNC_INTERVAL_HOURS`. `USAGE_COLLECTION_INTERVAL_HOURS` is no longer used by the scheduler (only for manual triggering context). | ✅ Resolved |
| 4 | Should the separate enable/disable env vars be kept? | Keep `SEAT_SYNC_ENABLED` and `USAGE_COLLECTION_ENABLED`. If seat sync is disabled but usage collection is enabled, usage collection still runs (using existing seat data). If usage collection is disabled, only seat sync runs. | ✅ Resolved |

## Implementation Plan

### Phase 1: Add Concurrency Guards to Seat Sync and Usage Collection

#### Task 1.1 - [MODIFY] Add concurrency guard to `executeSeatSync()`
**Description**: Add a pessimistic-locking concurrency guard to `executeSeatSync()` following the exact pattern used in `executeMonthRecollection()` in `src/lib/month-recollection.ts`. Before creating a new `RUNNING` job record, check within a transaction (using `pessimistic_write` lock) if there is already a `RUNNING` `seat_sync` job that started within the last 2 hours. If found, return `{ skipped: true, reason: "already_running" }`.

**File**: `src/lib/seat-sync.ts`

**Implementation details**:
```typescript
const STALE_JOB_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

// Inside executeSeatSync(), replace the direct jobRepository.save() with:
const queryRunner = dataSource.createQueryRunner();
let jobExecution: JobExecution;

try {
  await queryRunner.startTransaction();

  const runningJob = await queryRunner.manager
    .getRepository(JobExecutionEntity)
    .findOne({
      where: {
        jobType: JobType.SEAT_SYNC,
        status: JobStatus.RUNNING,
        startedAt: MoreThan(new Date(Date.now() - STALE_JOB_THRESHOLD_MS)),
      },
      lock: { mode: "pessimistic_write" },
    });

  if (runningJob) {
    await queryRunner.rollbackTransaction();
    console.warn("Seat sync skipped: another sync is already running");
    return { skipped: true, reason: "already_running" };
  }

  jobExecution = await queryRunner.manager
    .getRepository(JobExecutionEntity)
    .save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.RUNNING,
      startedAt: new Date(),
    } as Partial<JobExecution>);

  await queryRunner.commitTransaction();
} catch (txError) {
  try { await queryRunner.rollbackTransaction(); } catch { /* ignore */ }
  throw txError;
} finally {
  await queryRunner.release();
}
```

**Patterns to follow**:
- Identical concurrency guard pattern from `src/lib/month-recollection.ts` lines 85-117
- Same `STALE_JOB_THRESHOLD_MS` constant (2 hours)
- Same error handling pattern (rollback on error, release in finally)

**Definition of Done**:
- [x] `MoreThan` imported from `typeorm`
- [x] `STALE_JOB_THRESHOLD_MS` constant added (2 hours)
- [x] Concurrency guard wraps job creation in a transaction with `pessimistic_write` lock
- [x] Returns `{ skipped: true, reason: "already_running" }` when a recent RUNNING job exists
- [x] Stale jobs (older than 2 hours) are ignored by the guard
- [x] Existing seat sync logic (API fetch, upsert, deactivation) is unchanged
- [x] TypeScript compiles without errors

#### Task 1.2 - [MODIFY] Add concurrency guard to `executeUsageCollection()`
**Description**: Add the same pessimistic-locking concurrency guard to `executeUsageCollection()` to prevent overlapping usage collection runs.

**File**: `src/lib/usage-collection.ts`

**Implementation details**: Same pattern as Task 1.1 but checking for `JobType.USAGE_COLLECTION` running jobs.

**Patterns to follow**:
- Same as Task 1.1

**Definition of Done**:
- [x] `MoreThan` imported from `typeorm`
- [x] `STALE_JOB_THRESHOLD_MS` constant added (2 hours)
- [x] Concurrency guard wraps job creation in a transaction with `pessimistic_write` lock
- [x] Returns `{ skipped: true, reason: "already_running" }` when a recent RUNNING job exists
- [x] Stale jobs (older than 2 hours) are ignored by the guard
- [x] Existing usage collection logic is unchanged
- [x] TypeScript compiles without errors

### Phase 2: Sequential Scheduler Orchestration

#### Task 2.1 - [MODIFY] Replace independent schedulers with sequential sync cycle
**Description**: Refactor `instrumentation.ts` to use a single scheduler function (`runSyncCycle`) that runs seat sync first, waits for completion, then runs usage collection only if seat sync succeeded. Replace the two `setInterval` calls with one. On startup, use a single `setTimeout` instead of two separate timeouts.

**File**: `instrumentation.ts`

**Implementation details**:
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const seatSyncEnabled = process.env.SEAT_SYNC_ENABLED !== "false";
  const usageCollectionEnabled = process.env.USAGE_COLLECTION_ENABLED !== "false";

  if (!seatSyncEnabled && !usageCollectionEnabled) {
    console.log("All sync schedulers disabled");
    return;
  }

  // Read interval: prefer SYNC_INTERVAL_HOURS, fall back to SEAT_SYNC_INTERVAL_HOURS
  const intervalHours = parseFloat(
    process.env.SYNC_INTERVAL_HOURS ||
    process.env.SEAT_SYNC_INTERVAL_HOURS ||
    "24"
  );

  if (isNaN(intervalHours) || intervalHours <= 0) {
    console.error("Invalid sync interval. Scheduler not started.");
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  const runSyncCycle = async () => {
    // Step 1: Seat sync (if enabled)
    let seatSyncSucceeded = false;
    if (seatSyncEnabled) {
      try {
        const { executeSeatSync } = await import("@/lib/seat-sync");
        const result = await executeSeatSync();
        seatSyncSucceeded = !result.skipped && result.status === "success";
      } catch (error) {
        console.error("Scheduled seat sync failed:", error);
      }
    } else {
      // If seat sync is disabled, don't block usage collection
      seatSyncSucceeded = true;
    }

    // Step 2: Usage collection (if enabled, and only after successful seat sync)
    if (usageCollectionEnabled) {
      if (seatSyncSucceeded) {
        try {
          const { executeUsageCollection } = await import("@/lib/usage-collection");
          await executeUsageCollection();
        } catch (error) {
          console.error("Scheduled usage collection failed:", error);
        }
      } else {
        console.warn(
          "Usage collection skipped: seat sync did not complete successfully"
        );
      }
    }
  };

  console.log(`Sync scheduler starting (interval: ${intervalHours}h)`);
  setInterval(runSyncCycle, intervalMs);

  // Startup run
  const runOnStartup =
    process.env.SEAT_SYNC_RUN_ON_STARTUP === "true" ||
    process.env.USAGE_COLLECTION_RUN_ON_STARTUP === "true";

  if (runOnStartup) {
    console.log("Sync on startup enabled — scheduling initial cycle in 10s");
    setTimeout(runSyncCycle, 10_000);
  }
}
```

**Patterns to follow**:
- Keep the existing `process.env.NEXT_RUNTIME` guard
- Keep dynamic imports (`await import(...)`) to match existing pattern
- Maintain backward compatibility with existing env vars

**Definition of Done**:
- [x] Two independent `setInterval` calls replaced with single `runSyncCycle` function
- [x] `runSyncCycle` runs seat sync first, awaits result, then runs usage collection
- [x] Usage collection is skipped if seat sync fails or is skipped (with console warning)
- [x] If seat sync is disabled (`SEAT_SYNC_ENABLED=false`), usage collection runs without waiting
- [x] If usage collection is disabled (`USAGE_COLLECTION_ENABLED=false`), only seat sync runs
- [x] `SYNC_INTERVAL_HOURS` env var supported, falling back to `SEAT_SYNC_INTERVAL_HOURS`
- [x] Startup uses a single `setTimeout` (10s) instead of two separate timeouts
- [x] `USAGE_COLLECTION_INTERVAL_HOURS` is no longer used by the scheduler (no breaking change — env var is simply ignored)
- [x] TypeScript compiles without errors

### Phase 3: Unit Tests for Concurrency Guards

#### Task 3.1 - [MODIFY] Add concurrency guard tests to seat sync tests
**Description**: Add test cases to `src/lib/__tests__/seat-sync.test.ts` verifying the concurrency guard behavior: skips when a RUNNING job exists, ignores stale RUNNING jobs, and proceeds when no RUNNING job exists.

**File**: `src/lib/__tests__/seat-sync.test.ts`

**Test cases**:
1. Skips sync and returns `{ skipped: true, reason: "already_running" }` when a recent RUNNING seat_sync job exists
2. Proceeds normally when a RUNNING seat_sync job exists but is older than 2 hours (stale)
3. Proceeds normally when a COMPLETED seat_sync job exists (not running)
4. Proceeds normally when a RUNNING job of a different type exists (e.g., `usage_collection`)

**Patterns to follow**:
- Same test setup as existing tests in the file (mock `@/lib/db`, `@/lib/github-api`, seed configuration)
- Seed `job_execution` rows directly to simulate running jobs

**Definition of Done**:
- [x] Test for skip when recent RUNNING `seat_sync` job exists
- [x] Test for proceed when RUNNING `seat_sync` job is stale (> 2 hours)
- [x] Test for proceed when only COMPLETED `seat_sync` job exists
- [x] Test for proceed when RUNNING job is a different type
- [x] All tests pass (`npm run test`)

#### Task 3.2 - [MODIFY] Add concurrency guard tests to usage collection tests
**Description**: Add equivalent concurrency guard tests to `src/lib/__tests__/usage-collection.test.ts`.

**File**: `src/lib/__tests__/usage-collection.test.ts`

**Test cases**:
1. Skips collection and returns `{ skipped: true, reason: "already_running" }` when a recent RUNNING usage_collection job exists
2. Proceeds normally when a RUNNING usage_collection job is older than 2 hours (stale)
3. Proceeds normally when a COMPLETED usage_collection job exists
4. Proceeds normally when a RUNNING job of a different type exists

**Patterns to follow**:
- Same test setup as existing tests in the file

**Definition of Done**:
- [x] Test for skip when recent RUNNING `usage_collection` job exists
- [x] Test for proceed when RUNNING `usage_collection` job is stale (> 2 hours)
- [x] Test for proceed when only COMPLETED `usage_collection` job exists
- [x] Test for proceed when RUNNING job is a different type
- [x] All tests pass (`npm run test`)

### Phase 4: Code Review

#### Task 4.1 - [REUSE] Automated Code Review
**Description**: Run the `tsh-code-reviewer` agent to review all changes for correctness, consistency, and adherence to project standards.

**Definition of Done**:
- [x] Code review completed by `tsh-code-reviewer` agent
- [x] All review findings addressed

## Security Considerations

- **No new attack surfaces**: No new endpoints are created. The changes are internal scheduling logic.
- **Pessimistic locking**: The concurrency guards use `FOR UPDATE` (pessimistic_write) locks, which are safe and standard for preventing TOCTOU races. The lock is held only for the duration of the check-and-insert transaction (milliseconds).
- **No user input changes**: The API route handlers are unchanged. Manual trigger endpoints continue to work independently (concurrency guards protect against overlapping runs regardless of trigger source).
- **Environment variable backward compatibility**: Existing env vars continue to work. No secrets or credentials are affected.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [x] Seat sync always completes before usage collection starts in the scheduled sync cycle
- [x] If seat sync fails, usage collection is skipped with a logged warning
- [x] If seat sync is disabled, usage collection can run independently
- [x] Concurrent overlapping runs of `executeSeatSync()` are prevented (returns `skipped: true, reason: "already_running"`)
- [x] Concurrent overlapping runs of `executeUsageCollection()` are prevented (returns `skipped: true, reason: "already_running"`)
- [x] Stale RUNNING jobs (older than 2 hours) are ignored by concurrency guards
- [x] Manual API triggers (`POST /api/jobs/seat-sync`, `POST /api/jobs/usage-collection`) continue to work independently
- [x] `SYNC_INTERVAL_HOURS` env var is respected, with fallback to `SEAT_SYNC_INTERVAL_HOURS`
- [x] Startup sync uses a single sequential cycle (not two independent timeouts)
- [x] All unit tests pass (`npm run test`)
- [x] All E2E tests pass (`npm run test:e2e`)
- [x] No TypeScript compilation errors (`npm run build`)
- [x] No lint errors (`npm run lint`)

## Improvements (Out of Scope)

Potential improvements identified during planning that are not part of the current task:

- **Job queue system**: Replace `setInterval` with a proper job queue (e.g., BullMQ with Redis) that supports job dependencies, retries, and backpressure. This would be more robust for production deployments with multiple instances.
- **Distributed locking**: The current pessimistic DB locking works for a single-instance deployment. For horizontal scaling (multiple Next.js instances), a distributed lock (e.g., Redis-based) would be needed to prevent cross-instance race conditions.
- **Job dependency DAG**: A formal job dependency graph where `usage_collection` declares `seat_sync` as a dependency, allowing the scheduler to resolve execution order automatically.
- **Retry with backoff**: If seat sync fails due to a transient error (e.g., GitHub API rate limit), retry with exponential backoff before giving up and skipping usage collection.
- **Stale job cleanup**: A background task that marks RUNNING jobs older than the threshold as FAILURE, providing better visibility into stuck jobs.

## Changelog

| Date | Change Description |
|------|-------------------|
| 2026-02-28 | Initial plan created |
| 2026-02-28 | Implementation completed: Phase 1 (concurrency guards), Phase 2 (sequential scheduler), Phase 3 (8 new unit tests). All 281 unit tests pass, build clean, 0 lint errors. |
| 2026-02-28 | Code review by `tsh-code-reviewer`: **Approved**. 6 findings total — 0 Critical, 0 Major, 2 Minor, 4 Suggestions. Addressed F1 (added comment clarifying string literal vs enum import), F6 (added comment about startup env var behavior). F2 (setTimeout loop instead of setInterval) noted as acceptable given 24h default + concurrency guards. F3 (guardRunner naming) accepted as improvement over reference. F4 (guard transaction failure test) and F5 (orchestration unit test) noted as low-priority follow-ups. |
