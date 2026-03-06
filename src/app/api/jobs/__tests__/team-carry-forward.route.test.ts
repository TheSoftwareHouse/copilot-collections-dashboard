/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { JobType, JobStatus, SeatStatus } from "@/entities/enums";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { TeamEntity, type Team } from "@/entities/team.entity";
import {
  TeamMemberSnapshotEntity,
  type TeamMemberSnapshot,
} from "@/entities/team-member-snapshot.entity";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

const { POST } = await import("@/app/api/jobs/team-carry-forward/route");
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

function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

function getPreviousMonthYear(month: number, year: number): { month: number; year: number } {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

describe("POST /api/jobs/team-carry-forward", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const response = await POST();
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const response = await POST();
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("successfully triggers carry-forward and returns job execution details", async () => {
    await seedAuthSession();

    const { month, year } = getCurrentMonthYear();
    const prev = getPreviousMonthYear(month, year);

    // Seed a team and snapshot for previous month
    const teamRepo = testDs.getRepository(TeamEntity);
    const team = await teamRepo.save({ name: "Test Team" } as Partial<Team>);

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const seat = await seatRepo.save({
      githubUsername: "api-user",
      githubUserId: 42,
      status: SeatStatus.ACTIVE,
    });

    const snapshotRepo = testDs.getRepository(TeamMemberSnapshotEntity);
    await snapshotRepo.save({
      teamId: team.id,
      seatId: seat.id,
      month: prev.month,
      year: prev.year,
    } as Partial<TeamMemberSnapshot>);

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.skipped).toBe(false);
    expect(body.status).toBe("success");
    expect(body.recordsProcessed).toBe(1);
    expect(body.jobExecutionId).toBeDefined();
  });

  it("returns skipped result when carry-forward already completed for current month", async () => {
    await seedAuthSession();

    // Seed a successful carry-forward job for this month
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.TEAM_CARRY_FORWARD,
      status: JobStatus.SUCCESS,
      startedAt: new Date(),
      completedAt: new Date(),
      recordsProcessed: 3,
    });

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("already_completed");
  });

  it("creates a job_execution record with type TEAM_CARRY_FORWARD", async () => {
    await seedAuthSession();

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.skipped).toBe(false);

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: body.jobExecutionId },
    });
    expect(job).not.toBeNull();
    expect(job!.jobType).toBe(JobType.TEAM_CARRY_FORWARD);
  });
});
