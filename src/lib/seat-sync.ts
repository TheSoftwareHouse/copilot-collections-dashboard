import { getDb } from "@/lib/db";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import {
  type CopilotSeat,
  CopilotSeatEntity,
} from "@/entities/copilot-seat.entity";
import { JobType, JobStatus, SeatStatus } from "@/entities/enums";
import { fetchAllCopilotSeats } from "@/lib/github-api";
import { refreshDashboardMetrics } from "@/lib/dashboard-metrics";
import { ERROR_MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { acquireJobLock } from "@/lib/job-lock";

export interface SeatSyncResult {
  skipped: boolean;
  reason?: string;
  jobExecutionId?: number;
  status?: string;
  recordsProcessed?: number;
  recordsDeactivated?: number;
  errorMessage?: string;
}

export async function executeSeatSync(): Promise<SeatSyncResult> {
  const dataSource = await getDb();
  const configRepository = dataSource.getRepository(ConfigurationEntity);
  const jobRepository = dataSource.getRepository(JobExecutionEntity);

  // Check if configuration exists
  const config = await configRepository.findOne({ where: {} });
  if (!config) {
    console.warn("Seat sync skipped: configuration not found");
    return { skipped: true, reason: "no_configuration" };
  }

  // Concurrency guard: atomically check for a running job and create one
  const lockResult = await acquireJobLock(dataSource, JobType.SEAT_SYNC);
  if (!lockResult.acquired) {
    console.warn(`Seat sync skipped: ${lockResult.reason}`);
    return { skipped: true, reason: lockResult.reason };
  }
  const jobExecution = lockResult.jobExecution;

  console.log(`Seat sync started (JobExecution #${jobExecution.id})`);

  try {
    // Fetch all seats from GitHub API
    const seats = await fetchAllCopilotSeats({
      apiMode: config.apiMode,
      entityName: config.entityName,
    });

    console.log(`Fetched ${seats.length} seats from GitHub API`);

    // Upsert seats within a transaction
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let recordsDeactivated = 0;

    try {
      const seatRepository = queryRunner.manager.getRepository(CopilotSeatEntity);

      // Upsert each seat, preserving enrichment data (firstName, lastName, department)
      for (const seat of seats) {
        const existing = await seatRepository.findOne({
          where: { githubUsername: seat.assignee.login },
        });

        if (existing) {
          existing.githubUserId = seat.assignee.id;
          existing.status = SeatStatus.ACTIVE;
          existing.assignedAt = seat.created_at
            ? new Date(seat.created_at)
            : null;
          existing.lastActivityAt = seat.last_activity_at
            ? new Date(seat.last_activity_at)
            : null;
          existing.lastActivityEditor = seat.last_activity_editor;
          existing.planType = seat.plan_type;
          await seatRepository.save(existing);
        } else {
          await seatRepository.save({
            githubUsername: seat.assignee.login,
            githubUserId: seat.assignee.id,
            status: SeatStatus.ACTIVE,
            assignedAt: seat.created_at
              ? new Date(seat.created_at)
              : null,
            lastActivityAt: seat.last_activity_at
              ? new Date(seat.last_activity_at)
              : null,
            lastActivityEditor: seat.last_activity_editor,
            planType: seat.plan_type,
          } as CopilotSeat);
        }
      }

      // Mark seats not in API response as INACTIVE
      const apiUsernames = seats.map((s) => s.assignee.login);

      if (apiUsernames.length > 0) {
        const deactivateResult = await queryRunner.manager
          .createQueryBuilder()
          .update(CopilotSeatEntity)
          .set({ status: SeatStatus.INACTIVE })
          .where("status = :activeStatus", {
            activeStatus: SeatStatus.ACTIVE,
          })
          .andWhere("githubUsername NOT IN (:...usernames)", {
            usernames: apiUsernames,
          })
          .execute();
        recordsDeactivated = deactivateResult.affected ?? 0;
      } else {
        // Empty API response — mark all active seats as inactive
        const deactivateResult = await queryRunner.manager
          .createQueryBuilder()
          .update(CopilotSeatEntity)
          .set({ status: SeatStatus.INACTIVE })
          .where("status = :activeStatus", {
            activeStatus: SeatStatus.ACTIVE,
          })
          .execute();
        recordsDeactivated = deactivateResult.affected ?? 0;
      }

      if (recordsDeactivated > 0) {
        console.log(
          `Marked ${recordsDeactivated} seat(s) as inactive`
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Update job execution — SUCCESS
    await jobRepository.save({
      ...jobExecution,
      status: JobStatus.SUCCESS,
      completedAt: new Date(),
      recordsProcessed: seats.length,
    });

    console.log(
      `Seat sync completed successfully: ${seats.length} records processed`
    );

    // Refresh dashboard metrics for the current month after successful sync
    try {
      const now = new Date();
      const currentMonth = now.getUTCMonth() + 1;
      const currentYear = now.getUTCFullYear();
      await refreshDashboardMetrics(currentMonth, currentYear);
    } catch (metricsError) {
      console.warn(
        "Failed to refresh dashboard metrics after seat sync:",
        metricsError instanceof Error ? metricsError.message : String(metricsError),
      );
    }

    return {
      skipped: false,
      jobExecutionId: jobExecution.id,
      status: JobStatus.SUCCESS,
      recordsProcessed: seats.length,
      recordsDeactivated,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const truncatedMessage = errorMessage.substring(
      0,
      ERROR_MESSAGE_MAX_LENGTH
    );

    // Update job execution — FAILURE
    await jobRepository.save({
      ...jobExecution,
      status: JobStatus.FAILURE,
      completedAt: new Date(),
      errorMessage: truncatedMessage,
    });

    console.error(`Seat sync failed: ${truncatedMessage}`);

    return {
      skipped: false,
      jobExecutionId: jobExecution.id,
      status: JobStatus.FAILURE,
      errorMessage: truncatedMessage,
    };
  }
}
