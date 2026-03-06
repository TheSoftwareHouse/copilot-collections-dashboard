import { MoreThan, type DataSource, type EntityManager } from "typeorm";
import {
  JobExecutionEntity,
  type JobExecution,
} from "@/entities/job-execution.entity";
import { JobStatus, type JobType } from "@/entities/enums";
import { STALE_JOB_THRESHOLD_MS } from "@/lib/constants";

export type AcquireJobLockResult =
  | { acquired: true; jobExecution: JobExecution }
  | { acquired: false; reason: string };

/**
 * Atomically acquire a concurrency lock for a background job.
 *
 * Uses a transaction with pessimistic locking to prevent TOCTOU races.
 * Jobs running longer than {@link STALE_JOB_THRESHOLD_MS} are treated as
 * stale and ignored.
 *
 * @param preCheck - Optional callback executed inside the transaction before
 *   the running-job check. Return `{ skip: true, reason }` to abort early
 *   (used by team-carry-forward to skip if already completed this month).
 */
export async function acquireJobLock(
  dataSource: DataSource,
  jobType: JobType,
  options?: {
    preCheck?: (
      manager: EntityManager,
    ) => Promise<{ skip: true; reason: string } | { skip: false }>;
  },
): Promise<AcquireJobLockResult> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    // Run optional pre-check (e.g., already-completed check)
    if (options?.preCheck) {
      const result = await options.preCheck(queryRunner.manager);
      if (result.skip) {
        await queryRunner.rollbackTransaction();
        return { acquired: false, reason: result.reason };
      }
    }

    const runningJob = await queryRunner.manager
      .getRepository(JobExecutionEntity)
      .findOne({
        where: {
          jobType,
          status: JobStatus.RUNNING,
          startedAt: MoreThan(new Date(Date.now() - STALE_JOB_THRESHOLD_MS)),
        },
        lock: { mode: "pessimistic_write" },
      });

    if (runningJob) {
      await queryRunner.rollbackTransaction();
      return { acquired: false, reason: "already_running" };
    }

    const jobExecution = await queryRunner.manager
      .getRepository(JobExecutionEntity)
      .save({
        jobType,
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      } as Partial<JobExecution>);

    await queryRunner.commitTransaction();
    return { acquired: true, jobExecution };
  } catch (txError) {
    try {
      await queryRunner.rollbackTransaction();
    } catch {
      /* ignore rollback errors */
    }
    throw txError;
  } finally {
    await queryRunner.release();
  }
}
