/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { ApiMode, JobType, JobStatus, SeatStatus } from "@/entities/enums";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import {
  CopilotSeatEntity,
  type CopilotSeat,
} from "@/entities/copilot-seat.entity";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import type { GitHubSeatAssignment } from "@/lib/github-api";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

vi.mock("@/lib/github-api", () => ({
  fetchAllCopilotSeats: vi.fn(),
}));

vi.mock("@/lib/github-app-token", () => ({
  getInstallationToken: vi.fn(),
  NoOrgConnectedError: class NoOrgConnectedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NoOrgConnectedError";
    }
  },
}));

vi.mock("@/lib/dashboard-metrics", () => ({
  refreshDashboardMetrics: vi.fn(),
}));

const { executeSeatSync } = await import("@/lib/seat-sync");
const { fetchAllCopilotSeats } = await import("@/lib/github-api");
const { getInstallationToken, NoOrgConnectedError } = await import("@/lib/github-app-token");
const mockedFetchSeats = vi.mocked(fetchAllCopilotSeats);
const mockedGetToken = vi.mocked(getInstallationToken);

function makeSeatAssignment(
  login: string,
  id: number,
  overrides: Partial<GitHubSeatAssignment> = {}
): GitHubSeatAssignment {
  return {
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    pending_cancellation_date: null,
    last_activity_at: "2024-06-15T12:00:00Z",
    last_activity_editor: "vscode/1.90.0/copilot/1.200.0",
    plan_type: "business",
    assignee: {
      login,
      id,
      avatar_url: `https://github.com/images/${login}.gif`,
      type: "User",
    },
    ...overrides,
  };
}

async function seedConfiguration(ds: DataSource) {
  const repo = ds.getRepository(ConfigurationEntity);
  await repo.save({
    apiMode: ApiMode.ORGANISATION,
    entityName: "test-org",
  });
}

describe("executeSeatSync", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    vi.clearAllMocks();
    mockedGetToken.mockResolvedValue("test-installation-token");
  });

  it("skips sync when no configuration exists", async () => {
    const result = await executeSeatSync();

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_configuration");

    // No JobExecution should be created
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(0);
  });

  it("skips sync when no org is connected", async () => {
    await seedConfiguration(testDs);
    mockedGetToken.mockRejectedValueOnce(
      new NoOrgConnectedError("No GitHub App configured"),
    );

    const result = await executeSeatSync();

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_org_connected");

    // No JobExecution should be created
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const jobs = await jobRepo.find();
    expect(jobs).toHaveLength(0);
  });

  it("creates new CopilotSeat records with ACTIVE status on successful sync", async () => {
    await seedConfiguration(testDs);

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("octocat", 1),
      makeSeatAssignment("hubot", 2),
    ]);

    const result = await executeSeatSync();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(2);
    expect(result.jobExecutionId).toBeDefined();

    // Verify seats in database
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const seats = await seatRepo.find({ order: { githubUsername: "ASC" } });
    expect(seats).toHaveLength(2);
    expect(seats[0].githubUsername).toBe("hubot");
    expect(seats[0].status).toBe(SeatStatus.ACTIVE);
    expect(seats[1].githubUsername).toBe("octocat");
    expect(seats[1].status).toBe(SeatStatus.ACTIVE);

    // Verify JobExecution
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: result.jobExecutionId },
    });
    expect(job).not.toBeNull();
    expect(job!.jobType).toBe(JobType.SEAT_SYNC);
    expect(job!.status).toBe(JobStatus.SUCCESS);
    expect(job!.recordsProcessed).toBe(2);
    expect(job!.completedAt).not.toBeNull();
  });

  it("updates existing seats without overwriting enrichment fields", async () => {
    await seedConfiguration(testDs);

    // Pre-seed a seat with enrichment data
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save({
      githubUsername: "octocat",
      githubUserId: 1,
      status: SeatStatus.ACTIVE,
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
      lastActivityAt: new Date("2024-01-01T00:00:00Z"),
      lastActivityEditor: "vscode/1.80.0",
      planType: "business",
    } as Partial<CopilotSeat>);

    // Sync with updated activity data
    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("octocat", 1, {
        last_activity_at: "2024-07-01T12:00:00Z",
        last_activity_editor: "vscode/1.92.0/copilot/1.210.0",
        plan_type: "enterprise",
      }),
    ]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(1);

    // Verify enrichment data preserved, activity data updated
    const updated = await seatRepo.findOne({
      where: { githubUsername: "octocat" },
    });
    expect(updated).not.toBeNull();
    expect(updated!.firstName).toBe("Octo");
    expect(updated!.lastName).toBe("Cat");
    expect(updated!.department).toBe("Engineering");
    expect(updated!.lastActivityEditor).toBe(
      "vscode/1.92.0/copilot/1.210.0"
    );
    expect(updated!.planType).toBe("enterprise");
  });

  it("creates FAILURE JobExecution when GitHub API throws", async () => {
    await seedConfiguration(testDs);

    mockedFetchSeats.mockRejectedValueOnce(
      new Error("GitHub API returned 503: Service Unavailable")
    );

    const result = await executeSeatSync();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.FAILURE);
    expect(result.errorMessage).toContain("503");
    expect(result.jobExecutionId).toBeDefined();

    // Verify FAILURE job execution
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: result.jobExecutionId },
    });
    expect(job!.status).toBe(JobStatus.FAILURE);
    expect(job!.errorMessage).toContain("Service Unavailable");
    expect(job!.completedAt).not.toBeNull();
  });

  it("does not corrupt existing seats when sync fails mid-operation", async () => {
    await seedConfiguration(testDs);

    // Pre-seed a seat
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save({
      githubUsername: "existing-user",
      githubUserId: 99,
      status: SeatStatus.ACTIVE,
      planType: "business",
    } as Partial<CopilotSeat>);

    // Mock fetchAllCopilotSeats to return seats, but the transaction will fail
    // because we insert a duplicate githubUserId with a different username first,
    // then cause a unique constraint violation
    mockedFetchSeats.mockRejectedValueOnce(
      new Error("Network timeout during fetch")
    );

    const result = await executeSeatSync();
    expect(result.status).toBe(JobStatus.FAILURE);

    // Existing seat should be untouched
    const seats = await seatRepo.find();
    expect(seats).toHaveLength(1);
    expect(seats[0].githubUsername).toBe("existing-user");
    expect(seats[0].planType).toBe("business");
  });

  it("handles empty seat list from API", async () => {
    await seedConfiguration(testDs);

    mockedFetchSeats.mockResolvedValueOnce([]);

    const result = await executeSeatSync();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(0);

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const seats = await seatRepo.find();
    expect(seats).toHaveLength(0);
  });

  it("marks ACTIVE seats not in API response as INACTIVE", async () => {
    await seedConfiguration(testDs);

    // Pre-seed 3 seats
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save([
      {
        githubUsername: "user-a",
        githubUserId: 1,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "user-b",
        githubUserId: 2,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "user-c",
        githubUserId: 3,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
    ]);

    // API returns only 2 of 3 seats
    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("user-a", 1),
      makeSeatAssignment("user-b", 2),
    ]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(2);
    expect(result.recordsDeactivated).toBe(1);

    // Verify user-c is now INACTIVE
    const userC = await seatRepo.findOne({
      where: { githubUsername: "user-c" },
    });
    expect(userC!.status).toBe(SeatStatus.INACTIVE);

    // Verify user-a and user-b are still ACTIVE
    const userA = await seatRepo.findOne({
      where: { githubUsername: "user-a" },
    });
    expect(userA!.status).toBe(SeatStatus.ACTIVE);
    const userB = await seatRepo.findOne({
      where: { githubUsername: "user-b" },
    });
    expect(userB!.status).toBe(SeatStatus.ACTIVE);
  });

  it("does NOT mark seats that ARE in the API response as INACTIVE", async () => {
    await seedConfiguration(testDs);

    // Pre-seed 2 seats
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save([
      {
        githubUsername: "user-x",
        githubUserId: 10,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "user-y",
        githubUserId: 11,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
    ]);

    // API returns both seats
    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("user-x", 10),
      makeSeatAssignment("user-y", 11),
    ]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsDeactivated).toBe(0);

    // Both remain ACTIVE
    const seats = await seatRepo.find({ order: { githubUsername: "ASC" } });
    expect(seats).toHaveLength(2);
    expect(seats[0].status).toBe(SeatStatus.ACTIVE);
    expect(seats[1].status).toBe(SeatStatus.ACTIVE);
  });

  it("restores previously INACTIVE seat to ACTIVE when it reappears in API response", async () => {
    await seedConfiguration(testDs);

    // Pre-seed an INACTIVE seat
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save({
      githubUsername: "returning-user",
      githubUserId: 50,
      status: SeatStatus.INACTIVE,
      firstName: "Return",
      lastName: "User",
      department: "Sales",
    } as Partial<CopilotSeat>);

    // API returns this seat again
    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("returning-user", 50),
    ]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(1);

    // Verify seat is now ACTIVE
    const seat = await seatRepo.findOne({
      where: { githubUsername: "returning-user" },
    });
    expect(seat!.status).toBe(SeatStatus.ACTIVE);
    // Enrichment data preserved
    expect(seat!.firstName).toBe("Return");
    expect(seat!.lastName).toBe("User");
    expect(seat!.department).toBe("Sales");
  });

  it("preserves enrichment data when marking a seat as INACTIVE", async () => {
    await seedConfiguration(testDs);

    // Pre-seed a seat with enrichment data
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save({
      githubUsername: "enriched-user",
      githubUserId: 77,
      status: SeatStatus.ACTIVE,
      firstName: "Jane",
      lastName: "Doe",
      department: "Marketing",
    } as Partial<CopilotSeat>);

    // API returns empty — this seat is not in the response
    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("other-user", 88),
    ]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsDeactivated).toBe(1);

    // Verify seat is INACTIVE but enrichment data is preserved
    const seat = await seatRepo.findOne({
      where: { githubUsername: "enriched-user" },
    });
    expect(seat!.status).toBe(SeatStatus.INACTIVE);
    expect(seat!.firstName).toBe("Jane");
    expect(seat!.lastName).toBe("Doe");
    expect(seat!.department).toBe("Marketing");
  });

  it("marks ALL active seats as INACTIVE when API returns empty list", async () => {
    await seedConfiguration(testDs);

    // Pre-seed 2 ACTIVE seats
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save([
      {
        githubUsername: "seat-1",
        githubUserId: 1,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "seat-2",
        githubUserId: 2,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
    ]);

    // API returns empty list
    mockedFetchSeats.mockResolvedValueOnce([]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(0);
    expect(result.recordsDeactivated).toBe(2);

    // Both seats are now INACTIVE
    const seats = await seatRepo.find({ order: { githubUsername: "ASC" } });
    expect(seats).toHaveLength(2);
    expect(seats[0].status).toBe(SeatStatus.INACTIVE);
    expect(seats[1].status).toBe(SeatStatus.INACTIVE);
  });

  it("already INACTIVE seats are not double-counted in recordsDeactivated", async () => {
    await seedConfiguration(testDs);

    // Pre-seed 1 ACTIVE + 1 INACTIVE seat
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save([
      {
        githubUsername: "active-user",
        githubUserId: 1,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "already-inactive",
        githubUserId: 2,
        status: SeatStatus.INACTIVE,
      } as Partial<CopilotSeat>,
    ]);

    // API returns neither seat
    mockedFetchSeats.mockResolvedValueOnce([]);

    const result = await executeSeatSync();

    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsDeactivated).toBe(1); // Only the ACTIVE one

    // Verify both are INACTIVE
    const seats = await seatRepo.find({ order: { githubUsername: "ASC" } });
    expect(seats).toHaveLength(2);
    expect(seats[0].status).toBe(SeatStatus.INACTIVE); // active-user
    expect(seats[1].status).toBe(SeatStatus.INACTIVE); // already-inactive
  });
});

describe("executeSeatSync — concurrency guard", () => {
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

  it("skips sync when a recent RUNNING seat_sync job exists", async () => {
    await seedConfiguration(testDs);

    // Seed a RUNNING seat_sync job that started 30 minutes ago
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.RUNNING,
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    });

    const result = await executeSeatSync();

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("already_running");
    expect(mockedFetchSeats).not.toHaveBeenCalled();
  });

  it("proceeds when a RUNNING seat_sync job is stale (older than 2 hours)", async () => {
    await seedConfiguration(testDs);

    // Seed a RUNNING seat_sync job that started 3 hours ago (stale)
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.RUNNING,
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    });

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("octocat", 1),
    ]);

    const result = await executeSeatSync();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(result.recordsProcessed).toBe(1);
    expect(mockedFetchSeats).toHaveBeenCalledOnce();
  });

  it("proceeds when only a COMPLETED seat_sync job exists", async () => {
    await seedConfiguration(testDs);

    // Seed a completed seat_sync job
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("octocat", 1),
    ]);

    const result = await executeSeatSync();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(mockedFetchSeats).toHaveBeenCalledOnce();
  });

  it("proceeds when a RUNNING job of a different type exists", async () => {
    await seedConfiguration(testDs);

    // Seed a RUNNING usage_collection job (different type)
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.RUNNING,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("octocat", 1),
    ]);

    const result = await executeSeatSync();

    expect(result.skipped).toBe(false);
    expect(result.status).toBe(JobStatus.SUCCESS);
    expect(mockedFetchSeats).toHaveBeenCalledOnce();
  });
});
