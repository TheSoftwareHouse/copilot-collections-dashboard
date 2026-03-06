---
name: creating-background-jobs
description: "Scaffold background jobs with node-cron scheduling, pessimistic locking via acquireJobLock, and instrumentation.ts registration. Use when creating scheduled jobs, adding cron tasks, or implementing background processing."
---

# Creating Background Jobs

Scaffolds scheduled background jobs using the project's node-cron + pessimistic locking pattern.

## Creation Process

Use the checklist below and track your progress:

```
Progress:
- [ ] Step 1: Add the job type
- [ ] Step 2: Create the job module
- [ ] Step 3: Register in instrumentation.ts
- [ ] Step 4: Create migration (if needed)
- [ ] Step 5: Verify the job
```

**Step 1: Add the job type**

Add the new job type to the `JobType` enum/constants. Check the existing job types in the codebase — typically in the job execution entity or a constants file. Each job type must have a unique string identifier.

**Step 2: Create the job module**

Create `src/lib/{job-name}.ts` following this pattern:

```ts
import { getDb } from "@/lib/db";
import { acquireJobLock } from "@/lib/job-lock";
import { JobType, JobStatus } from "@/entities/enums";

export async function runMyJob(): Promise<void> {
  // 1. Config check — skip if disabled
  const enabled = process.env.MY_JOB_ENABLED !== "false";
  if (!enabled) {
    console.log("[my-job] Disabled via MY_JOB_ENABLED");
    return;
  }

  // 2. Acquire lock
  const dataSource = await getDb();
  const lockResult = await acquireJobLock(dataSource, JobType.MY_JOB, {
    // Optional: idempotency check inside the lock transaction
    preCheck: async (manager) => {
      const existing = await manager.getRepository(JobExecutionEntity)
        .findOne({ where: { jobType: JobType.MY_JOB, status: JobStatus.SUCCESS, /* month check */ } });
      if (existing) return { skip: true, reason: "Already completed for this period" };
      return { skip: false };
    },
  });

  if (!lockResult.acquired) {
    console.log(`[my-job] Skipped: ${lockResult.reason}`);
    return;
  }

  const { jobExecution } = lockResult;

  // 3. Business logic
  try {
    // ... perform the job work ...

    // 4. Mark success
    jobExecution.status = JobStatus.SUCCESS;
    jobExecution.completedAt = new Date();
    const repo = dataSource.getRepository(JobExecutionEntity);
    await repo.save(jobExecution);
    console.log("[my-job] Completed successfully");
  } catch (error) {
    // 5. Mark failure
    jobExecution.status = JobStatus.FAILURE;
    jobExecution.completedAt = new Date();
    jobExecution.errorMessage = error instanceof Error ? error.message : String(error);
    const repo = dataSource.getRepository(JobExecutionEntity);
    await repo.save(jobExecution);
    console.error("[my-job] Failed:", error);
  }
}
```

Key patterns:
- Config check first — every job has an enable flag (default `true`)
- `acquireJobLock()` uses PostgreSQL `pessimistic_write` lock to prevent concurrent runs
- Lock result is a discriminated union: check `acquired` before accessing `jobExecution`
- `preCheck` runs inside the lock transaction for idempotency (optional but recommended)
- Always update job status to SUCCESS or FAILURE — never leave in RUNNING state
- Log with `[job-name]` prefix for easy filtering

**Step 3: Register in instrumentation.ts**

Add the job to the cron schedule in `instrumentation.ts`:

```ts
import { runMyJob } from "@/lib/my-job";

// Inside the register() function, within the cron callback:
// Execution order matters: carry-forward → seat sync → usage → new jobs
await runMyJob();
```

The cron job is configured via:
- `SYNC_CRON_SCHEDULE` env var (default: `"0 0 * * *"` — daily at midnight)
- All jobs run sequentially in one cron tick — order matters when jobs depend on each other

**Step 4: Create migration (if needed)**

If the new job type needs a database entry in the job type enum/table, create a migration:

```ts
export class AddMyJobType{timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Add new job type value if using a check constraint or enum
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- Reverse the change
    `);
  }
}
```

**Step 5: Verify the job**

1. Check types: `npx tsc --noEmit`
2. Run existing tests to ensure no regressions: `npx vitest run`
3. Test the job manually by calling the function directly or triggering the cron
4. Verify the lock prevents concurrent execution

## Quick Reference

| Component | Location | Purpose |
|---|---|---|
| `acquireJobLock()` | `@/lib/job-lock` | Pessimistic write lock on `job_execution` table |
| `JobType` enum | `@/entities/enums` | All valid job type identifiers |
| `JobStatus` enum | `@/entities/enums` | RUNNING, SUCCESS, FAILURE |
| `instrumentation.ts` | Project root | Cron registration via `register()` export |
| `STALE_JOB_THRESHOLD_MS` | Constants | Running jobs older than this are ignored by the lock |

## Connected Skills

- `creating-entities` — if the job needs new database tables
- `writing-integration-tests` — test the job module with real database
