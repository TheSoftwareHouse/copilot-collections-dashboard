import { getDb } from "@/lib/db";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import {
  CopilotSeatEntity,
} from "@/entities/copilot-seat.entity";
import {
  CopilotUsageEntity,
  type CopilotUsage,
} from "@/entities/copilot-usage.entity";
import { JobType, JobStatus, SeatStatus } from "@/entities/enums";
import { fetchPremiumRequestUsage } from "@/lib/github-api";
import { refreshDashboardMetrics } from "@/lib/dashboard-metrics";
import { ERROR_MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { acquireJobLock } from "@/lib/job-lock";

export interface UsageCollectionResult {
  skipped: boolean;
  reason?: string;
  jobExecutionId?: number;
  status?: string;
  recordsProcessed?: number;
  usersProcessed?: number;
  usersErrored?: number;
  errorMessage?: string;
}

interface DateTuple {
  day: number;
  month: number;
  year: number;
}

/**
 * Generate an inclusive list of dates from `start` to `end`.
 * Uses UTC to avoid timezone-related off-by-one issues.
 */
function generateDateRange(start: DateTuple, end: DateTuple): DateTuple[] {
  const dates: DateTuple[] = [];
  const current = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const last = new Date(Date.UTC(end.year, end.month - 1, end.day));

  while (current <= last) {
    dates.push({
      day: current.getUTCDate(),
      month: current.getUTCMonth() + 1,
      year: current.getUTCFullYear(),
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Get the next day after a given date (UTC).
 */
function nextDay(date: DateTuple): DateTuple {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

/**
 * Get today's date as a DateTuple (UTC).
 */
function getToday(): DateTuple {
  const now = new Date();
  return {
    day: now.getUTCDate(),
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
}

export async function executeUsageCollection(): Promise<UsageCollectionResult> {
  const dataSource = await getDb();
  const configRepository = dataSource.getRepository(ConfigurationEntity);
  const jobRepository = dataSource.getRepository(JobExecutionEntity);
  const seatRepository = dataSource.getRepository(CopilotSeatEntity);
  const usageRepository = dataSource.getRepository(CopilotUsageEntity);

  // Check if configuration exists
  const config = await configRepository.findOne({ where: {} });
  if (!config) {
    console.warn("Usage collection skipped: configuration not found");
    return { skipped: true, reason: "no_configuration" };
  }

  // Concurrency guard: atomically check for a running job and create one
  const lockResult = await acquireJobLock(dataSource, JobType.USAGE_COLLECTION);
  if (!lockResult.acquired) {
    console.warn(`Usage collection skipped: ${lockResult.reason}`);
    return { skipped: true, reason: lockResult.reason };
  }
  const jobExecution = lockResult.jobExecution;

  console.log(`Usage collection started (JobExecution #${jobExecution.id})`);

  try {
    // Fetch all ACTIVE seats
    const activeSeats = await seatRepository.find({
      where: { status: SeatStatus.ACTIVE },
    });

    if (activeSeats.length === 0) {
      console.log("No active seats found — completing with 0 records");
      await jobRepository.save({
        ...jobExecution,
        status: JobStatus.SUCCESS,
        completedAt: new Date(),
        recordsProcessed: 0,
      });

      return {
        skipped: false,
        jobExecutionId: jobExecution.id,
        status: JobStatus.SUCCESS,
        recordsProcessed: 0,
        usersProcessed: 0,
        usersErrored: 0,
      };
    }

    const today = getToday();
    let totalRecordsProcessed = 0;
    let usersProcessed = 0;
    let usersErrored = 0;
    const userErrors: string[] = [];

    for (const seat of activeSeats) {
      try {
        // Determine the start date for this seat
        const latestUsage = await usageRepository
          .createQueryBuilder("usage")
          .where("usage.seatId = :seatId", { seatId: seat.id })
          .orderBy("usage.year", "DESC")
          .addOrderBy("usage.month", "DESC")
          .addOrderBy("usage.day", "DESC")
          .getOne();

        let startDate: DateTuple;
        if (latestUsage) {
          const latestDate: DateTuple = {
            day: latestUsage.day,
            month: latestUsage.month,
            year: latestUsage.year,
          };
          const nextAfterLatest = nextDay(latestDate);
          // Always re-fetch today to capture potentially incomplete data.
          // If the latest stored date IS today, start from today (upsert).
          // Otherwise start from the day after the latest stored date.
          const latestIsToday =
            latestDate.day === today.day &&
            latestDate.month === today.month &&
            latestDate.year === today.year;
          startDate = latestIsToday ? today : nextAfterLatest;
        } else {
          // No existing data — start from today
          startDate = today;
        }

        // Clamp: if latest stored date is in the future (e.g. from backfill),
        // still re-fetch today so current-day data is never skipped.
        const startTimestamp = Date.UTC(startDate.year, startDate.month - 1, startDate.day);
        const todayTimestamp = Date.UTC(today.year, today.month - 1, today.day);
        if (startTimestamp > todayTimestamp) {
          startDate = today;
        }

        const dates = generateDateRange(startDate, today);
        for (const date of dates) {
          const response = await fetchPremiumRequestUsage({
            entityName: config.entityName,
            username: seat.githubUsername,
            day: date.day,
            month: date.month,
            year: date.year,
          });

          // Upsert: insert or update on conflict
          await usageRepository
            .createQueryBuilder()
            .insert()
            .into(CopilotUsageEntity)
            .values({
              seatId: seat.id,
              day: date.day,
              month: date.month,
              year: date.year,
              usageItems: response.usageItems,
            } as Partial<CopilotUsage>)
            .orUpdate(["usageItems", "updatedAt"], ["seatId", "day", "month", "year"])
            .execute();

          totalRecordsProcessed++;
        }

        usersProcessed++;
        console.log(
          `Collected ${dates.length} day(s) for ${seat.githubUsername}`
        );
      } catch (error) {
        usersErrored++;
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        userErrors.push(`${seat.githubUsername}: ${errorMsg}`);
        console.error(
          `Usage collection error for ${seat.githubUsername}: ${errorMsg}`
        );
      }
    }

    // Determine final status
    const allFailed =
      usersErrored > 0 && usersProcessed === 0;
    const finalStatus = allFailed ? JobStatus.FAILURE : JobStatus.SUCCESS;
    const errorMessage =
      userErrors.length > 0
        ? userErrors.join("; ").substring(0, ERROR_MESSAGE_MAX_LENGTH)
        : undefined;

    await jobRepository.save({
      ...jobExecution,
      status: finalStatus,
      completedAt: new Date(),
      recordsProcessed: totalRecordsProcessed,
      errorMessage: errorMessage ?? null,
    });

    console.log(
      `Usage collection completed: ${totalRecordsProcessed} records processed, ` +
        `${usersProcessed} users succeeded, ${usersErrored} users errored`
    );

    // Refresh dashboard metrics for the current month after successful collection
    if (finalStatus === JobStatus.SUCCESS) {
      try {
        await refreshDashboardMetrics(today.month, today.year);
      } catch (metricsError) {
        console.warn(
          "Failed to refresh dashboard metrics after usage collection:",
          metricsError instanceof Error ? metricsError.message : String(metricsError),
        );
      }
    }

    return {
      skipped: false,
      jobExecutionId: jobExecution.id,
      status: finalStatus,
      recordsProcessed: totalRecordsProcessed,
      usersProcessed,
      usersErrored,
      errorMessage,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const truncatedMessage = errorMessage.substring(
      0,
      ERROR_MESSAGE_MAX_LENGTH
    );

    await jobRepository.save({
      ...jobExecution,
      status: JobStatus.FAILURE,
      completedAt: new Date(),
      errorMessage: truncatedMessage,
    });

    console.error(`Usage collection failed: ${truncatedMessage}`);

    return {
      skipped: false,
      jobExecutionId: jobExecution.id,
      status: JobStatus.FAILURE,
      errorMessage: truncatedMessage,
    };
  }
}
