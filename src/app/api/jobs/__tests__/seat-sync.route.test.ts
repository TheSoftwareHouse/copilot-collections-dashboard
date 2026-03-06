/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { ApiMode, JobType, SeatStatus } from "@/entities/enums";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import type { CopilotSeat } from "@/entities/copilot-seat.entity";
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

let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

const { POST } = await import("@/app/api/jobs/seat-sync/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { fetchAllCopilotSeats } = await import("@/lib/github-api");
const { getInstallationToken } = await import("@/lib/github-app-token");
const mockedFetchSeats = vi.mocked(fetchAllCopilotSeats);
const mockedGetToken = vi.mocked(getInstallationToken);

function makeSeatAssignment(
  login: string,
  id: number
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
  };
}

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

async function seedConfiguration(): Promise<void> {
  const repo = testDs.getRepository(ConfigurationEntity);
  await repo.save({
    apiMode: ApiMode.ORGANISATION,
    entityName: "test-org",
  });
}

describe("POST /api/jobs/seat-sync", () => {
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
    mockedGetToken.mockResolvedValue("test-installation-token");
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

  it("returns 409 when no configuration exists", async () => {
    await seedAuthSession();

    const response = await POST();
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error).toContain("Configuration not found");
  });

  it("returns 200 with success result when sync completes", async () => {
    await seedAuthSession();
    await seedConfiguration();

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("octocat", 1),
      makeSeatAssignment("hubot", 2),
    ]);

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.recordsProcessed).toBe(2);
    expect(body.jobExecutionId).toBeDefined();
  });

  it("returns 200 with failure result when GitHub API throws", async () => {
    await seedAuthSession();
    await seedConfiguration();

    mockedFetchSeats.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("failure");
    expect(body.errorMessage).toContain("rate limit");
    expect(body.jobExecutionId).toBeDefined();
  });

  it("creates CopilotSeat records in the database after successful sync", async () => {
    await seedAuthSession();
    await seedConfiguration();

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("dev-user", 42),
    ]);

    await POST();

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const seats = await seatRepo.find();
    expect(seats).toHaveLength(1);
    expect(seats[0].githubUsername).toBe("dev-user");
    expect(seats[0].status).toBe(SeatStatus.ACTIVE);
  });

  it("creates JobExecution records with correct jobType", async () => {
    await seedAuthSession();
    await seedConfiguration();

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("user-1", 1),
    ]);

    const response = await POST();
    const body = await response.json();

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: body.jobExecutionId },
    });
    expect(job).not.toBeNull();
    expect(job!.jobType).toBe(JobType.SEAT_SYNC);
  });

  it("includes recordsDeactivated in successful sync response", async () => {
    await seedAuthSession();
    await seedConfiguration();

    // Pre-seed 3 seats, API returns only 2
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save([
      {
        githubUsername: "kept-1",
        githubUserId: 1,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "kept-2",
        githubUserId: 2,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "removed-user",
        githubUserId: 3,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
    ]);

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("kept-1", 1),
      makeSeatAssignment("kept-2", 2),
    ]);

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.recordsProcessed).toBe(2);
    expect(body.recordsDeactivated).toBe(1);
  });

  it("verifies seat status in database after sync through API", async () => {
    await seedAuthSession();
    await seedConfiguration();

    // Pre-seed 2 seats, API returns only 1
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    await seatRepo.save([
      {
        githubUsername: "active-seat",
        githubUserId: 10,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
      {
        githubUsername: "will-be-inactive",
        githubUserId: 11,
        status: SeatStatus.ACTIVE,
      } as Partial<CopilotSeat>,
    ]);

    mockedFetchSeats.mockResolvedValueOnce([
      makeSeatAssignment("active-seat", 10),
    ]);

    await POST();

    // Verify database state
    const activeSeat = await seatRepo.findOne({
      where: { githubUsername: "active-seat" },
    });
    expect(activeSeat!.status).toBe(SeatStatus.ACTIVE);

    const inactiveSeat = await seatRepo.findOne({
      where: { githubUsername: "will-be-inactive" },
    });
    expect(inactiveSeat!.status).toBe(SeatStatus.INACTIVE);
  });
});
