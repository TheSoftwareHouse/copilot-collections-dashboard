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

const { executeUsageCollection } = await import("@/lib/usage-collection");
const { fetchPremiumRequestUsage } = await import("@/lib/github-api");
const mockedFetchUsage = vi.mocked(fetchPremiumRequestUsage);

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
  ]
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
  status: SeatStatus = SeatStatus.ACTIVE
): Promise<number> {
  const repo = ds.getRepository(CopilotSeatEntity);
  const seat = await repo.save({
    githubUsername: username,
    githubUserId: Math.floor(Math.random() * 100000),
    status,
  });
  return seat.id;
}

function todayTuple() {
  const now = new Date();
  return {
    day: now.getUTCDate(),
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
}

describe("executeUsageCollection", () => {
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

  it("skips collection when no configuration exists", async () => {
    const result = await executeUsageCollection();

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_configuration");

    // No JobExecution should be created
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(0);
  });

  it("returns SUCCESS with recordsProcessed 0 when no active seats exist", async () => {
    await seedConfiguration(testDs);

    const result = await executeUsageCollection();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(0);
    expect(result.usersProcessed).toBe(0);
    expect(result.usersErrored).toBe(0);

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].jobType).toBe(JobType.USAGE_COLLECTION);
    expect(jobs[0].status).toBe(JobStatus.SUCCESS);
  });

  it("collects usage for a single seat with no prior data — creates record for today", async () => {
    await seedConfiguration(testDs);
    const seatId = await seedSeat(testDs, "octocat");
    const today = todayTuple();

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const result = await executeUsageCollection();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(1);
    expect(result.usersProcessed).toBe(1);
    expect(result.usersErrored).toBe(0);

    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    const records = await usageRepo.find();
    expect(records).toHaveLength(1);
    expect(records[0].seatId).toBe(seatId);
    expect(records[0].day).toBe(today.day);
    expect(records[0].month).toBe(today.month);
    expect(records[0].year).toBe(today.year);
    expect(records[0].usageItems).toHaveLength(1);
    expect(records[0].usageItems[0].model).toBe("Claude Sonnet 4.5");
  });

  it("collects usage for multiple seats", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");
    await seedSeat(testDs, "hubot");
    const today = todayTuple();

    mockedFetchUsage
      .mockResolvedValueOnce(
        makeUsageResponse("octocat", today.day, today.month, today.year)
      )
      .mockResolvedValueOnce(
        makeUsageResponse("hubot", today.day, today.month, today.year)
      );

    const result = await executeUsageCollection();

    expect(result.recordsProcessed).toBe(2);
    expect(result.usersProcessed).toBe(2);
    expect(result.usersErrored).toBe(0);

    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    const records = await usageRepo.find();
    expect(records).toHaveLength(2);
  });

  it("determines correct date range — fetches only days after the latest stored date", async () => {
    await seedConfiguration(testDs);
    const seatId = await seedSeat(testDs, "octocat");
    const today = todayTuple();

    // Seed an existing usage record for yesterday (UTC)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    await usageRepo.save({
      seatId,
      day: yesterday.getUTCDate(),
      month: yesterday.getUTCMonth() + 1,
      year: yesterday.getUTCFullYear(),
      usageItems: [],
    } as Partial<CopilotUsage>);

    // Should only fetch today since yesterday already exists
    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const result = await executeUsageCollection();

    expect(result.recordsProcessed).toBe(1);
    expect(mockedFetchUsage).toHaveBeenCalledOnce();
    expect(mockedFetchUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        day: today.day,
        month: today.month,
        year: today.year,
      })
    );
  });

  it("upserts data when a record already exists for the same seat + date", async () => {
    await seedConfiguration(testDs);
    const seatId = await seedSeat(testDs, "octocat");
    const today = todayTuple();

    // Seed an existing usage record for today (with old data)
    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    await usageRepo.save({
      seatId,
      day: today.day,
      month: today.month,
      year: today.year,
      usageItems: [
        {
          product: "Copilot",
          sku: "Old SKU",
          model: "Old Model",
          unitType: "requests",
          pricePerUnit: 0.01,
          grossQuantity: 10,
          grossAmount: 0.1,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 10,
          netAmount: 0.1,
        },
      ],
    } as Partial<CopilotUsage>);

    const updatedItems = [
      {
        product: "Copilot",
        sku: "Copilot Premium Request",
        model: "Claude Sonnet 4.5",
        unitType: "requests",
        pricePerUnit: 0.04,
        grossQuantity: 99.0,
        grossAmount: 3.96,
        discountQuantity: 99.0,
        discountAmount: 3.96,
        netQuantity: 0.0,
        netAmount: 0.0,
      },
    ];

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse(
        "octocat",
        today.day,
        today.month,
        today.year,
        updatedItems
      )
    );

    const result = await executeUsageCollection();

    expect(result.recordsProcessed).toBe(1);

    // Verify the record was updated, not duplicated
    const allRecords = await usageRepo.find({
      where: { seatId, day: today.day, month: today.month, year: today.year },
    });
    expect(allRecords).toHaveLength(1);
    expect(allRecords[0].usageItems[0].grossQuantity).toBe(99.0);
    expect(allRecords[0].usageItems[0].model).toBe("Claude Sonnet 4.5");
  });

  it("continues collecting for remaining users when one user's API call fails", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "failing-user");
    await seedSeat(testDs, "good-user");
    const today = todayTuple();

    // Use mockImplementation to handle seats in any order
    mockedFetchUsage.mockImplementation(async (config) => {
      if (config.username === "failing-user") {
        throw new Error("API rate limit exceeded");
      }
      return makeUsageResponse(
        config.username,
        today.day,
        today.month,
        today.year
      );
    });

    const result = await executeUsageCollection();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.usersProcessed).toBe(1);
    expect(result.usersErrored).toBe(1);
    expect(result.recordsProcessed).toBe(1);
    expect(result.errorMessage).toContain("failing-user");

    // Verify JobExecution has error details
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe(JobStatus.SUCCESS);
    expect(jobs[0].errorMessage).toContain("failing-user");
  });

  it("marks JobExecution as FAILURE when ALL users fail", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "user1");
    await seedSeat(testDs, "user2");

    // All users fail regardless of order
    mockedFetchUsage.mockRejectedValue(new Error("API error"));

    const result = await executeUsageCollection();

    expect(result.status).toBe(JobStatus.FAILURE);
    expect(result.usersProcessed).toBe(0);
    expect(result.usersErrored).toBe(2);
    expect(result.recordsProcessed).toBe(0);

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe(JobStatus.FAILURE);
  });

  it("stores empty usageItems array when API returns no usage items", async () => {
    await seedConfiguration(testDs);
    const seatId = await seedSeat(testDs, "octocat");
    const today = todayTuple();

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year, [])
    );

    const result = await executeUsageCollection();

    expect(result.recordsProcessed).toBe(1);

    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    const records = await usageRepo.find();
    expect(records).toHaveLength(1);
    expect(records[0].seatId).toBe(seatId);
    expect(records[0].usageItems).toEqual([]);
  });

  it("creates correct JobExecution record with USAGE_COLLECTION type", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");
    const today = todayTuple();

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const result = await executeUsageCollection();

    expect(result.jobExecutionId).toBeDefined();

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOneBy({ id: result.jobExecutionId });
    expect(job).toBeDefined();
    expect(job!.jobType).toBe(JobType.USAGE_COLLECTION);
    expect(job!.status).toBe(JobStatus.SUCCESS);
    expect(job!.recordsProcessed).toBe(1);
    expect(job!.completedAt).toBeDefined();
    expect(job!.startedAt).toBeDefined();
  });

  it("does not collect for INACTIVE seats", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "inactive-user", SeatStatus.INACTIVE);

    const result = await executeUsageCollection();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(0);
    expect(result.usersProcessed).toBe(0);
    expect(mockedFetchUsage).not.toHaveBeenCalled();
  });
});

describe("Story 4.2: Data uniqueness and integrity", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
  });

  it("DB constraint rejects duplicate insert for the same seat + day + month + year", async () => {
    const seatId = await seedSeat(testDs, "octocat");
    const usageRepo = testDs.getRepository(CopilotUsageEntity);

    // Insert first record via repository
    await usageRepo.save({
      seatId,
      day: 15,
      month: 2,
      year: 2026,
      usageItems: [],
    } as Partial<CopilotUsage>);

    // Attempt a raw duplicate INSERT (bypassing application upsert logic)
    await expect(
      testDs.query(
        `INSERT INTO copilot_usage ("seatId", "day", "month", "year", "usageItems", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [seatId, 15, 2, 2026, JSON.stringify([])]
      )
    ).rejects.toThrow(/UQ_copilot_usage_seat_day/);
  });

  it("upsert updates existing record instead of duplicating", async () => {
    const seatId = await seedSeat(testDs, "octocat");
    const usageRepo = testDs.getRepository(CopilotUsageEntity);

    const initialItems = [
      {
        product: "Copilot",
        sku: "Copilot Premium Request",
        model: "Claude Haiku 4.5",
        unitType: "requests",
        pricePerUnit: 0.04,
        grossQuantity: 10.0,
        grossAmount: 0.4,
        discountQuantity: 10.0,
        discountAmount: 0.4,
        netQuantity: 0.0,
        netAmount: 0.0,
      },
    ];

    // Insert initial record
    await usageRepo.save({
      seatId,
      day: 10,
      month: 2,
      year: 2026,
      usageItems: initialItems,
    } as Partial<CopilotUsage>);

    const updatedItems = [
      {
        product: "Copilot",
        sku: "Copilot Premium Request",
        model: "Claude Sonnet 4.5",
        unitType: "requests",
        pricePerUnit: 0.04,
        grossQuantity: 99.0,
        grossAmount: 3.96,
        discountQuantity: 99.0,
        discountAmount: 3.96,
        netQuantity: 0.0,
        netAmount: 0.0,
      },
    ];

    // Run upsert using the same orUpdate pattern as usage-collection.ts
    await usageRepo
      .createQueryBuilder()
      .insert()
      .into(CopilotUsageEntity)
      .values({
        seatId,
        day: 10,
        month: 2,
        year: 2026,
        usageItems: updatedItems,
      } as Partial<CopilotUsage>)
      .orUpdate(["usageItems", "updatedAt"], ["seatId", "day", "month", "year"])
      .execute();

    // Verify single record with updated values
    const allRecords = await usageRepo.find({
      where: { seatId, day: 10, month: 2, year: 2026 },
    });
    expect(allRecords).toHaveLength(1);
    expect(allRecords[0].usageItems).toHaveLength(1);
    expect(allRecords[0].usageItems[0].model).toBe("Claude Sonnet 4.5");
    expect(allRecords[0].usageItems[0].grossQuantity).toBe(99.0);
  });

  it("multiple model breakdowns are preserved in usageItems JSONB", async () => {
    const seatId = await seedSeat(testDs, "octocat");
    const usageRepo = testDs.getRepository(CopilotUsageEntity);

    const multiModelItems = [
      {
        product: "Copilot",
        sku: "Copilot Premium Request",
        model: "Claude Haiku 4.5",
        unitType: "requests",
        pricePerUnit: 0.04,
        grossQuantity: 2.97,
        grossAmount: 0.1188,
        discountQuantity: 2.97,
        discountAmount: 0.1188,
        netQuantity: 0.0,
        netAmount: 0.0,
      },
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
    ];

    await usageRepo.save({
      seatId,
      day: 1,
      month: 2,
      year: 2026,
      usageItems: multiModelItems,
    } as Partial<CopilotUsage>);

    // Retrieve and verify all model breakdowns with full field assertions
    const record = await usageRepo.findOneBy({
      seatId,
      day: 1,
      month: 2,
      year: 2026,
    });

    expect(record).toBeDefined();
    expect(record!.usageItems).toHaveLength(2);

    const haiku = record!.usageItems.find((i) => i.model === "Claude Haiku 4.5");
    expect(haiku).toBeDefined();
    expect(haiku!.product).toBe("Copilot");
    expect(haiku!.sku).toBe("Copilot Premium Request");
    expect(haiku!.unitType).toBe("requests");
    expect(haiku!.pricePerUnit).toBe(0.04);
    expect(haiku!.grossQuantity).toBe(2.97);
    expect(haiku!.grossAmount).toBe(0.1188);
    expect(haiku!.discountQuantity).toBe(2.97);
    expect(haiku!.discountAmount).toBe(0.1188);
    expect(haiku!.netQuantity).toBe(0.0);
    expect(haiku!.netAmount).toBe(0.0);

    const sonnet = record!.usageItems.find((i) => i.model === "Claude Sonnet 4.5");
    expect(sonnet).toBeDefined();
    expect(sonnet!.product).toBe("Copilot");
    expect(sonnet!.sku).toBe("Copilot Premium Request");
    expect(sonnet!.unitType).toBe("requests");
    expect(sonnet!.pricePerUnit).toBe(0.04);
    expect(sonnet!.grossQuantity).toBe(53.0);
    expect(sonnet!.grossAmount).toBe(2.12);
    expect(sonnet!.discountQuantity).toBe(53.0);
    expect(sonnet!.discountAmount).toBe(2.12);
    expect(sonnet!.netQuantity).toBe(0.0);
    expect(sonnet!.netAmount).toBe(0.0);
  });

  it("historical data is retained across multiple dates and queryable", async () => {
    const seatId = await seedSeat(testDs, "octocat");
    const usageRepo = testDs.getRepository(CopilotUsageEntity);

    // Insert records for three different dates in the same month
    const dates = [
      { day: 1, month: 2, year: 2026 },
      { day: 15, month: 2, year: 2026 },
      { day: 28, month: 2, year: 2026 },
    ];

    for (const date of dates) {
      await usageRepo.save({
        seatId,
        day: date.day,
        month: date.month,
        year: date.year,
        usageItems: [
          {
            product: "Copilot",
            sku: "Copilot Premium Request",
            model: "Claude Sonnet 4.5",
            unitType: "requests",
            pricePerUnit: 0.04,
            grossQuantity: date.day * 10, // unique per date for verification
            grossAmount: date.day * 0.4,
            discountQuantity: 0,
            discountAmount: 0,
            netQuantity: date.day * 10,
            netAmount: date.day * 0.4,
          },
        ],
      } as Partial<CopilotUsage>);
    }

    // Query all records for this seat — all three should be present
    const allForSeat = await usageRepo.find({ where: { seatId } });
    expect(allForSeat).toHaveLength(3);

    // Query by (year, month) — all three should be returned
    const byMonth = await usageRepo.find({
      where: { year: 2026, month: 2 },
    });
    expect(byMonth).toHaveLength(3);

    // Query each individual date — exactly one record each
    for (const date of dates) {
      const record = await usageRepo.findOneBy({
        seatId,
        day: date.day,
        month: date.month,
        year: date.year,
      });
      expect(record).toBeDefined();
      expect(record!.usageItems[0].grossQuantity).toBe(date.day * 10);
    }
  });

  it("different seats can have usage for the same date without conflict", async () => {
    const seatId1 = await seedSeat(testDs, "octocat");
    const seatId2 = await seedSeat(testDs, "hubot");
    const usageRepo = testDs.getRepository(CopilotUsageEntity);

    // Insert records for the same date but different seats
    await usageRepo.save({
      seatId: seatId1,
      day: 15,
      month: 2,
      year: 2026,
      usageItems: [
        {
          product: "Copilot",
          sku: "Copilot Premium Request",
          model: "Claude Sonnet 4.5",
          unitType: "requests",
          pricePerUnit: 0.04,
          grossQuantity: 50.0,
          grossAmount: 2.0,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 50.0,
          netAmount: 2.0,
        },
      ],
    } as Partial<CopilotUsage>);

    await usageRepo.save({
      seatId: seatId2,
      day: 15,
      month: 2,
      year: 2026,
      usageItems: [
        {
          product: "Copilot",
          sku: "Copilot Premium Request",
          model: "Claude Haiku 4.5",
          unitType: "requests",
          pricePerUnit: 0.04,
          grossQuantity: 30.0,
          grossAmount: 1.2,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 30.0,
          netAmount: 1.2,
        },
      ],
    } as Partial<CopilotUsage>);

    // Both records should exist
    const allRecords = await usageRepo.find({
      where: { day: 15, month: 2, year: 2026 },
    });
    expect(allRecords).toHaveLength(2);

    const seat1Record = allRecords.find((r) => r.seatId === seatId1);
    const seat2Record = allRecords.find((r) => r.seatId === seatId2);
    expect(seat1Record).toBeDefined();
    expect(seat2Record).toBeDefined();
    expect(seat1Record!.usageItems[0].grossQuantity).toBe(50.0);
    expect(seat2Record!.usageItems[0].grossQuantity).toBe(30.0);
  });
});

describe("executeUsageCollection — concurrency guard", () => {
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

  it("skips collection when a recent RUNNING usage_collection job exists", async () => {
    await seedConfiguration(testDs);

    // Seed a RUNNING usage_collection job that started 30 minutes ago
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.RUNNING,
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    });

    const result = await executeUsageCollection();

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("already_running");
    expect(mockedFetchUsage).not.toHaveBeenCalled();
  });

  it("proceeds when a RUNNING usage_collection job is stale (older than 2 hours)", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");
    const today = todayTuple();

    // Seed a RUNNING usage_collection job that started 3 hours ago (stale)
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.RUNNING,
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    });

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const result = await executeUsageCollection();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(1);
    expect(mockedFetchUsage).toHaveBeenCalledOnce();
  });

  it("proceeds when only a COMPLETED usage_collection job exists", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");
    const today = todayTuple();

    // Seed a completed usage_collection job
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const result = await executeUsageCollection();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(mockedFetchUsage).toHaveBeenCalledOnce();
  });

  it("proceeds when a RUNNING job of a different type exists", async () => {
    await seedConfiguration(testDs);
    await seedSeat(testDs, "octocat");
    const today = todayTuple();

    // Seed a RUNNING seat_sync job (different type)
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.RUNNING,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const result = await executeUsageCollection();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(mockedFetchUsage).toHaveBeenCalledOnce();
  });
});
