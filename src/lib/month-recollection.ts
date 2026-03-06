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
import { JobType, JobStatus } from "@/entities/enums";
import { fetchPremiumRequestUsage } from "@/lib/github-api";
import { getInstallationToken, NoOrgConnectedError } from "@/lib/github-app-token";
import { refreshDashboardMetrics } from "@/lib/dashboard-metrics";
import { ERROR_MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { acquireJobLock } from "@/lib/job-lock";

export interface MonthRecollectionResult {
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
 * Generate the full date range for a given month/year (day 1 through last day).
 * Uses UTC to avoid timezone-related off-by-one issues.
 */
function generateMonthDateRange(month: number, year: number): DateTuple[] {
  const dates: DateTuple[] = [];
  // Day 0 of the next month gives us the last day of the target month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let day = 1; day <= lastDay; day++) {
    dates.push({ day, month, year });
  }

  return dates;
}

/**
 * Execute a full recollection of usage data for every seat and every day
 * of the specified month/year. Fetches data from the GitHub API and upserts
 * into the copilot_usage table, then refreshes dashboard metrics.
 *
 * Concurrency guard: only one month recollection job can run at a time.
 */
export async function executeMonthRecollection(
  month: number,
  year: number,
): Promise<MonthRecollectionResult> {
  const dataSource = await getDb();
  const configRepository = dataSource.getRepository(ConfigurationEntity);
  const jobRepository = dataSource.getRepository(JobExecutionEntity);
  const seatRepository = dataSource.getRepository(CopilotSeatEntity);
  const usageRepository = dataSource.getRepository(CopilotUsageEntity);

  // Check if configuration exists
  const config = await configRepository.findOne({ where: {} });
  if (!config) {
    console.warn("Month recollection skipped: configuration not found");
    return { skipped: true, reason: "no_configuration" };
  }

  // Generate installation access token before acquiring lock
  let token: string;
  try {
    token = await getInstallationToken();
  } catch (error) {
    if (error instanceof NoOrgConnectedError) {
      console.warn(`Month recollection skipped: ${error.message}`);
      return { skipped: true, reason: "no_org_connected" };
    }
    throw error;
  }

  // Concurrency guard: atomically check for a running job and create one
  const lockResult = await acquireJobLock(dataSource, JobType.MONTH_RECOLLECTION);
  if (!lockResult.acquired) {
    console.warn(`Month recollection skipped: ${lockResult.reason}`);
    return { skipped: true, reason: lockResult.reason };
  }
  const jobExecution = lockResult.jobExecution;

  console.log(
    `Month recollection started for ${month}/${year} (JobExecution #${jobExecution.id})`,
  );

  try {
    // Fetch ALL seats (active + inactive) — historical data may exist for inactive seats
    const allSeats = await seatRepository.find();

    if (allSeats.length === 0) {
      console.log("No seats found — completing with 0 records");
      await jobRepository.save({
        ...jobExecution,
        status: JobStatus.SUCCESS,
        completedAt: new Date(),
        recordsProcessed: 0,
      });

      // Refresh metrics even with zero seats — clears stale summaries
      try {
        await refreshDashboardMetrics(month, year);
      } catch (metricsError) {
        console.warn(
          "Failed to refresh dashboard metrics (zero-seats path):",
          metricsError instanceof Error ? metricsError.message : String(metricsError),
        );
      }

      return {
        skipped: false,
        jobExecutionId: jobExecution.id,
        status: JobStatus.SUCCESS,
        recordsProcessed: 0,
        usersProcessed: 0,
        usersErrored: 0,
      };
    }

    const dates = generateMonthDateRange(month, year);
    let totalRecordsProcessed = 0;
    let usersProcessed = 0;
    let usersErrored = 0;
    const userErrors: string[] = [];

    for (const seat of allSeats) {
      try {
        for (const date of dates) {
          const response = await fetchPremiumRequestUsage({
            apiMode: config.apiMode,
            entityName: config.entityName,
            username: seat.githubUsername,
            day: date.day,
            month: date.month,
            year: date.year,
          }, token);

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
          `Recollected ${dates.length} day(s) for ${seat.githubUsername}`,
        );
      } catch (error) {
        usersErrored++;
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        userErrors.push(`${seat.githubUsername}: ${errorMsg}`);
        console.error(
          `Month recollection error for ${seat.githubUsername}: ${errorMsg}`,
        );
      }
    }

    // Determine final status
    const allFailed = usersErrored > 0 && usersProcessed === 0;
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
      `Month recollection completed for ${month}/${year}: ${totalRecordsProcessed} records processed, ` +
        `${usersProcessed} users succeeded, ${usersErrored} users errored`,
    );

    // Refresh dashboard metrics for the target month after successful recollection
    if (finalStatus === JobStatus.SUCCESS) {
      try {
        await refreshDashboardMetrics(month, year);
      } catch (metricsError) {
        console.warn(
          "Failed to refresh dashboard metrics after month recollection:",
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
      ERROR_MESSAGE_MAX_LENGTH,
    );

    await jobRepository.save({
      ...jobExecution,
      status: JobStatus.FAILURE,
      completedAt: new Date(),
      errorMessage: truncatedMessage,
    });

    console.error(`Month recollection failed: ${truncatedMessage}`);

    return {
      skipped: false,
      jobExecutionId: jobExecution.id,
      status: JobStatus.FAILURE,
      errorMessage: truncatedMessage,
    };
  }
}
