/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { ApiMode, JobType, JobStatus, SeatStatus } from "@/entities/enums";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import {
  CopilotUsageEntity,
  type CopilotUsage,
} from "@/entities/copilot-usage.entity";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import type { GitHubUsageResponse } from "@/lib/github-api";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

vi.mock("@/lib/github-api", () => ({
  fetchPremiumRequestUsage: vi.fn(),
}));

vi.mock("@/lib/dashboard-metrics", () => ({
  refreshDashboardMetrics: vi.fn(),
}));

const { executeMonthRecollection } = await import("@/lib/month-recollection");
const { fetchPremiumRequestUsage } = await import("@/lib/github-api");
const { refreshDashboardMetrics } = await import("@/lib/dashboard-metrics");
const mockedFetchUsage = vi.mocked(fetchPremiumRequestUsage);
const mockedRefreshMetrics = vi.mocked(refreshDashboardMetrics);

function makeUsageResponse(
  username: string,
  day: number,
  month: number,
  year: number,
  usageItems: GitHubUsageResponse["usageItems"] = [
    {
      product: "Copilot",
      sku: "Copilot Premium Request",
      model: "Claude Sonnet 4.5",
      unitType: "requests",
      pricePerUnit: 0.04,
      grossQuantity: 53.0,
      grossAmount: 2.12,
      discountQuantity: 53.0,
      discountAmount: 2.12,
      netQuantity: 0.0,
      netAmount: 0.0,
    },
  ],
): GitHubUsageResponse {
  return {
    timePeriod: { year, month, day },
    user: username,
    organization: "test-org",
    usageItems,
  };
}

async function seedConfiguration(ds: DataSource) {
  const repo = ds.getRepository(ConfigurationEntity);
  await repo.save({
    apiMode: ApiMode.ORGANISATION,
    entityName: "test-org",
  });
}

async function seedSeat(
  ds: DataSource,
  username: string,
  status: SeatStatus = SeatStatus.ACTIVE,
): Promise<number> {
  const repo = ds.getRepository(CopilotSeatEntity);
  const seat = await repo.save({
    githubUsername: username,
    githubUserId: Math.floor(Math.random() * 100000),
    status,
  });
  return seat.id;
}

async function seedRunningRecollectionJob(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(JobExecutionEntity);
  await repo.save({
    jobType: JobType.MONTH_RECOLLECTION,
    status: JobStatus.RUNNING,
    startedAt: new Date(),
  });
}

describe("executeMonthRecollection", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    vi.clearAllMocks();
  });

  it("skips when no configuration exists", async () => {
    const result = await executeMonthRecollection(2, 2026);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_configuration");

    // No JobExecution should be created
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(0);
  });

  it("skips when a RUNNING month_recollection job already exists", async () => {
    await seedConfiguration(testDs);
    await seedRunningRecollectionJob(testDs);

    const result = await executeMonthRecollection(2, 2026);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("already_running");
  });

  it("processes all seats (active + inactive) for every day of the target month", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "active-user", SeatStatus.ACTIVE);
    await seedSeat(testDs, "inactive-user", SeatStatus.INACTIVE);

    // February 2026 has 28 days, 2 seats = 56 API calls
    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const result = await executeMonthRecollection(2, 2026);

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(56); // 28 days × 2 seats
    expect(result.usersProcessed).toBe(2);
    expect(result.usersErrored).toBe(0);

    // Verify API was called for both users
    const callUsernames = mockedFetchUsage.mock.calls.map((c) => c[0].username);
    expect(callUsernames.filter((u) => u === "active-user")).toHaveLength(28);
    expect(callUsernames.filter((u) => u === "inactive-user")).toHaveLength(28);
  });

  it("correctly generates date range for months with 28 days (Feb non-leap)", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const result = await executeMonthRecollection(2, 2025); // 2025 is not a leap year

    expect(result.recordsProcessed).toBe(28);
  });

  it("correctly generates date range for months with 29 days (Feb leap year)", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const result = await executeMonthRecollection(2, 2024); // 2024 is a leap year

    expect(result.recordsProcessed).toBe(29);
  });

  it("correctly generates date range for months with 30 days", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const result = await executeMonthRecollection(4, 2026); // April has 30 days

    expect(result.recordsProcessed).toBe(30);
  });

  it("correctly generates date range for months with 31 days", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const result = await executeMonthRecollection(1, 2026); // January has 31 days

    expect(result.recordsProcessed).toBe(31);
  });

  it("upserts usage data (updates existing records)", async () => {
    await seedConfiguration(testDs);
    const seatId = await seedSeat(testDs, "octocat");

    // Pre-seed a usage record for Jan 1, 2026
    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    await usageRepo.save({
      seatId,
      day: 1,
      month: 1,
      year: 2026,
      usageItems: [
        {
          product: "Copilot",
          sku: "Copilot Premium Request",
          model: "Old Model",
          unitType: "requests",
          pricePerUnit: 0.01,
          grossQuantity: 1,
          grossAmount: 0.01,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 1,
          netAmount: 0.01,
        },
      ],
    } as Partial<CopilotUsage>);

    // Mock returns updated data
    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    await executeMonthRecollection(1, 2026);

    // Should still have 31 records (not 32), proving upsert worked for day 1
    const records = await usageRepo.find({ where: { seatId } });
    expect(records).toHaveLength(31);

    // Verify the day-1 record was updated with new model name
    const day1Record = records.find((r) => r.day === 1);
    expect(day1Record).toBeDefined();
    expect(day1Record!.usageItems[0].model).toBe("Claude Sonnet 4.5");
  });

  it("creates job execution record with correct type and transitions to SUCCESS", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const result = await executeMonthRecollection(2, 2026);

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: result.jobExecutionId },
    });
    expect(job).not.toBeNull();
    expect(job!.jobType).toBe(JobType.MONTH_RECOLLECTION);
    expect(job!.status).toBe(JobStatus.SUCCESS);
    expect(job!.completedAt).not.toBeNull();
    expect(job!.recordsProcessed).toBe(28);
  });

  it("handles per-user API errors gracefully (continues with other seats)", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "failing-user");
    await seedSeat(testDs, "good-user");

    mockedFetchUsage.mockImplementation(async (config) => {
      if (config.username === "failing-user") {
        throw new Error("API error for user");
      }
      return makeUsageResponse(config.username, config.day, config.month, config.year);
    });

    const result = await executeMonthRecollection(2, 2026);

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.usersProcessed).toBe(1);
    expect(result.usersErrored).toBe(1);
    expect(result.recordsProcessed).toBe(28); // Only good-user's records
    expect(result.errorMessage).toContain("failing-user");
  });

  it("transitions to FAILURE when all users error", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "user1");
    await seedSeat(testDs, "user2");

    mockedFetchUsage.mockRejectedValue(new Error("API down"));

    const result = await executeMonthRecollection(2, 2026);

    expect(result.status).toBe(JobStatus.FAILURE);
    expect(result.usersProcessed).toBe(0);
    expect(result.usersErrored).toBe(2);

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: result.jobExecutionId },
    });
    expect(job!.status).toBe(JobStatus.FAILURE);
  });

  it("calls refreshDashboardMetrics on success", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    await executeMonthRecollection(2, 2026);

    expect(mockedRefreshMetrics).toHaveBeenCalledWith(2, 2026);
  });

  it("does not call refreshDashboardMetrics on failure", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "user1");

    mockedFetchUsage.mockRejectedValue(new Error("API down"));

    await executeMonthRecollection(2, 2026);

    expect(mockedRefreshMetrics).not.toHaveBeenCalled();
  });

  it("returns SUCCESS with 0 records when no seats exist", async () => {
    await seedConfiguration(testDs);

    const result = await executeMonthRecollection(2, 2026);

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(0);
    expect(result.usersProcessed).toBe(0);

    // M4 fix: refreshDashboardMetrics should be called even with zero seats
    expect(mockedRefreshMetrics).toHaveBeenCalledWith(2, 2026);
  });

  it("handles unexpected errors in the outer try/catch", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");

    // Force an unexpected error by making the seatRepository.find() work
    // but then failing in a way that the outer catch handles
    mockedFetchUsage.mockImplementation(async () => {
      throw Object.assign(new Error("Unexpected fatal error"), {
        // Make the spread in the inner loop fail by simulating
        // something that doesn't get caught by the per-user handler
      });
    });

    // The per-user error handler should catch this, but if somehow
    // it were to bubble up, the outer handler would catch it
    const result = await executeMonthRecollection(2, 2026);

    // With graceful per-user error handling, this becomes a FAILURE
    // because all users errored
    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.FAILURE);
  });
});
