/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { ApiMode, JobType, SeatStatus } from "@/entities/enums";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { CopilotUsageEntity } from "@/entities/copilot-usage.entity";
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

const { POST } = await import("@/app/api/jobs/usage-collection/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { fetchPremiumRequestUsage } = await import("@/lib/github-api");
const { getInstallationToken } = await import("@/lib/github-app-token");
const mockedFetchUsage = vi.mocked(fetchPremiumRequestUsage);
const mockedGetToken = vi.mocked(getInstallationToken);

function makeUsageResponse(
  username: string,
  day: number,
  month: number,
  year: number
): GitHubUsageResponse {
  return {
    timePeriod: { year, month, day },
    user: username,
    organization: "test-org",
    usageItems: [
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

async function seedSeat(username: string): Promise<number> {
  const repo = testDs.getRepository(CopilotSeatEntity);
  const seat = await repo.save({
    githubUsername: username,
    githubUserId: Math.floor(Math.random() * 100000),
    status: SeatStatus.ACTIVE,
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

describe("POST /api/jobs/usage-collection", () => {
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

  it("returns 200 with success result when collection completes", async () => {
    await seedAuthSession();
    await seedConfiguration();
    await seedSeat("octocat");
    const today = todayTuple();

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.recordsProcessed).toBe(1);
    expect(body.usersProcessed).toBe(1);
    expect(body.usersErrored).toBe(0);
    expect(body.jobExecutionId).toBeDefined();
  });

  it("returns 200 with error details when some users fail", async () => {
    await seedAuthSession();
    await seedConfiguration();
    await seedSeat("failing-user");
    await seedSeat("good-user");
    const today = todayTuple();

    mockedFetchUsage.mockImplementation(async (config) => {
      if (config.username === "failing-user") {
        throw new Error("API error for user");
      }
      return makeUsageResponse(
        config.username,
        today.day,
        today.month,
        today.year
      );
    });

    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.usersErrored).toBe(1);
    expect(body.usersProcessed).toBe(1);
    expect(body.errorMessage).toContain("failing-user");
  });

  it("creates CopilotUsage records in the database after successful collection", async () => {
    await seedAuthSession();
    await seedConfiguration();
    const seatId = await seedSeat("octocat");
    const today = todayTuple();

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    await POST();

    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    const records = await usageRepo.find();
    expect(records).toHaveLength(1);
    expect(records[0].seatId).toBe(seatId);
    expect(records[0].usageItems).toHaveLength(1);
  });

  it("creates JobExecution records with jobType USAGE_COLLECTION", async () => {
    await seedAuthSession();
    await seedConfiguration();
    await seedSeat("octocat");
    const today = todayTuple();

    mockedFetchUsage.mockResolvedValueOnce(
      makeUsageResponse("octocat", today.day, today.month, today.year)
    );

    const response = await POST();
    const body = await response.json();

    const jobRepo = testDs.getRepository(JobExecutionEntity);
    const job = await jobRepo.findOne({
      where: { id: body.jobExecutionId },
    });
    expect(job).not.toBeNull();
    expect(job!.jobType).toBe(JobType.USAGE_COLLECTION);
  });
});
