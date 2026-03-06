/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { JobType, JobStatus } from "@/entities/enums";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

// Mock next/headers cookies for auth
let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

const { GET } = await import("@/app/api/job-status/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);

async function seedAuthSession(options?: { role?: string }): Promise<void> {
  const { UserEntity } = await import("@/entities/user.entity");
  const { UserRole } = await import("@/entities/enums");
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testadmin",
    passwordHash: await hashPassword("testpass"),
    role: options?.role ?? UserRole.ADMIN,
  });
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}

describe("GET /api/job-status", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    await seedAuthSession();
  });

  it("returns 401 when no session is provided", async () => {
    mockCookieStore = {};
    const response = await GET();
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await cleanDatabase(testDs);
    mockCookieStore = {};
    await seedAuthSession({ role: UserRole.USER });
    const response = await GET();
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 200 with all null when no job executions exist", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.seatSync).toBeNull();
    expect(json.usageCollection).toBeNull();
    expect(json.teamCarryForward).toBeNull();
    expect(json.monthRecollection).toBeNull();
  });

  it("returns latest seat sync execution when multiple exist", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    // Older execution
    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-02-25T10:00:00Z"),
      completedAt: new Date("2026-02-25T10:01:00Z"),
      recordsProcessed: 10,
    });

    // Newer execution
    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.FAILURE,
      startedAt: new Date("2026-02-26T10:00:00Z"),
      completedAt: new Date("2026-02-26T10:01:00Z"),
      errorMessage: "API rate limit exceeded",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.seatSync).not.toBeNull();
    expect(json.seatSync.status).toBe("failure");
    expect(json.seatSync.errorMessage).toBe("API rate limit exceeded");
  });

  it("returns latest usage collection execution when multiple exist", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.FAILURE,
      startedAt: new Date("2026-02-24T08:00:00Z"),
      completedAt: new Date("2026-02-24T08:05:00Z"),
      errorMessage: "Connection timeout",
    });

    await repo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-02-25T08:00:00Z"),
      completedAt: new Date("2026-02-25T08:03:00Z"),
      recordsProcessed: 42,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.usageCollection).not.toBeNull();
    expect(json.usageCollection.status).toBe("success");
    expect(json.usageCollection.recordsProcessed).toBe(42);
  });

  it("returns both job types populated when executions exist for both", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-02-26T10:00:00Z"),
      completedAt: new Date("2026-02-26T10:01:00Z"),
      recordsProcessed: 50,
    });

    await repo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-02-26T12:00:00Z"),
      completedAt: new Date("2026-02-26T12:02:00Z"),
      recordsProcessed: 200,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.seatSync).not.toBeNull();
    expect(json.seatSync.jobType).toBe("seat_sync");
    expect(json.usageCollection).not.toBeNull();
    expect(json.usageCollection.jobType).toBe("usage_collection");
    expect(json.teamCarryForward).toBeNull();
    expect(json.monthRecollection).toBeNull();
  });

  it("includes errorMessage in response when status is FAILURE", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.FAILURE,
      startedAt: new Date("2026-02-26T10:00:00Z"),
      completedAt: new Date("2026-02-26T10:00:30Z"),
      errorMessage: "GitHub API returned 503",
    });

    const response = await GET();
    const json = await response.json();

    expect(json.seatSync.status).toBe("failure");
    expect(json.seatSync.errorMessage).toBe("GitHub API returned 503");
  });

  it("returns null for completedAt and recordsProcessed when not set", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.RUNNING,
      startedAt: new Date("2026-02-26T10:00:00Z"),
    });

    const response = await GET();
    const json = await response.json();

    expect(json.seatSync).not.toBeNull();
    expect(json.seatSync.status).toBe("running");
    expect(json.seatSync.completedAt).toBeNull();
    expect(json.seatSync.recordsProcessed).toBeNull();
  });

  it("returns only the latest execution per type, not older ones", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    // Create 3 seat sync executions
    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-02-24T10:00:00Z"),
      completedAt: new Date("2026-02-24T10:01:00Z"),
      recordsProcessed: 5,
    });
    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.FAILURE,
      startedAt: new Date("2026-02-25T10:00:00Z"),
      completedAt: new Date("2026-02-25T10:01:00Z"),
      errorMessage: "error",
    });
    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-02-26T10:00:00Z"),
      completedAt: new Date("2026-02-26T10:01:00Z"),
      recordsProcessed: 15,
    });

    const response = await GET();
    const json = await response.json();

    // Should return only the latest (Feb 26)
    expect(json.seatSync.status).toBe("success");
    expect(json.seatSync.recordsProcessed).toBe(15);
    expect(json.seatSync.errorMessage).toBeNull();
  });

  it("returns latest team carry-forward execution when it exists", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.TEAM_CARRY_FORWARD,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T00:00:00Z"),
      completedAt: new Date("2026-03-01T00:00:05Z"),
      recordsProcessed: 12,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.teamCarryForward).not.toBeNull();
    expect(json.teamCarryForward.jobType).toBe("team_carry_forward");
    expect(json.teamCarryForward.status).toBe("success");
    expect(json.teamCarryForward.recordsProcessed).toBe(12);
  });

  it("returns all three job types when executions exist for all", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T10:00:00Z"),
      completedAt: new Date("2026-03-01T10:01:00Z"),
      recordsProcessed: 50,
    });
    await repo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T12:00:00Z"),
      completedAt: new Date("2026-03-01T12:02:00Z"),
      recordsProcessed: 200,
    });
    await repo.save({
      jobType: JobType.TEAM_CARRY_FORWARD,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T00:00:00Z"),
      completedAt: new Date("2026-03-01T00:00:05Z"),
      recordsProcessed: 8,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.seatSync).not.toBeNull();
    expect(json.usageCollection).not.toBeNull();
    expect(json.teamCarryForward).not.toBeNull();
    expect(json.teamCarryForward.jobType).toBe("team_carry_forward");
    expect(json.teamCarryForward.recordsProcessed).toBe(8);
  });

  it("returns latest month recollection execution when it exists", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.MONTH_RECOLLECTION,
      status: JobStatus.FAILURE,
      startedAt: new Date("2026-02-28T14:00:00Z"),
      completedAt: new Date("2026-02-28T14:05:00Z"),
      errorMessage: "GitHub API timeout",
    });

    await repo.save({
      jobType: JobType.MONTH_RECOLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T14:00:00Z"),
      completedAt: new Date("2026-03-01T14:10:00Z"),
      recordsProcessed: 310,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.monthRecollection).not.toBeNull();
    expect(json.monthRecollection.jobType).toBe("month_recollection");
    expect(json.monthRecollection.status).toBe("success");
    expect(json.monthRecollection.recordsProcessed).toBe(310);
    expect(json.monthRecollection.errorMessage).toBeNull();
  });

  it("returns all four job types when executions exist for all", async () => {
    const { JobExecutionEntity } = await import(
      "@/entities/job-execution.entity"
    );
    const repo = testDs.getRepository(JobExecutionEntity);

    await repo.save({
      jobType: JobType.SEAT_SYNC,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T10:00:00Z"),
      completedAt: new Date("2026-03-01T10:01:00Z"),
      recordsProcessed: 50,
    });
    await repo.save({
      jobType: JobType.USAGE_COLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T12:00:00Z"),
      completedAt: new Date("2026-03-01T12:02:00Z"),
      recordsProcessed: 200,
    });
    await repo.save({
      jobType: JobType.TEAM_CARRY_FORWARD,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T00:00:00Z"),
      completedAt: new Date("2026-03-01T00:00:05Z"),
      recordsProcessed: 8,
    });
    await repo.save({
      jobType: JobType.MONTH_RECOLLECTION,
      status: JobStatus.SUCCESS,
      startedAt: new Date("2026-03-01T15:00:00Z"),
      completedAt: new Date("2026-03-01T15:10:00Z"),
      recordsProcessed: 620,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.seatSync).not.toBeNull();
    expect(json.usageCollection).not.toBeNull();
    expect(json.teamCarryForward).not.toBeNull();
    expect(json.monthRecollection).not.toBeNull();
    expect(json.monthRecollection.jobType).toBe("month_recollection");
    expect(json.monthRecollection.recordsProcessed).toBe(620);
  });
});
