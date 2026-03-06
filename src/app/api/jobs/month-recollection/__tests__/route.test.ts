/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { ApiMode, JobType, JobStatus, SeatStatus } from "@/entities/enums";
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

vi.mock("@/lib/dashboard-metrics", () => ({
  refreshDashboardMetrics: vi.fn(),
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

const { POST } = await import("@/app/api/jobs/month-recollection/route");
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
  year: number,
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

function makePostRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/jobs/month-recollection");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), { method: "POST" });
}

describe("POST /api/jobs/month-recollection", () => {
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
    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 400 when month is missing", async () => {
    await seedAuthSession();

    const request = makePostRequest({ year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Both month and year");
  });

  it("returns 400 when year is missing", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "2" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Both month and year");
  });

  it("returns 400 when month is invalid (0)", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "0", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Invalid month");
  });

  it("returns 400 when month is invalid (13)", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "13", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Invalid month");
  });

  it("returns 400 when year is invalid (2019)", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "2", year: "2019" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Invalid year");
  });

  it("returns 400 when month is not a number", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "abc", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("Invalid month");
  });

  it("returns 400 when requesting a future month", async () => {
    await seedAuthSession();

    // Use a date far in the future to ensure this test is stable
    const request = makePostRequest({ month: "12", year: "2099" });
    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("future months");
  });

  it("returns 409 when configuration is missing", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error).toContain("Configuration not found");
  });

  it("returns 409 when already running", async () => {
    await seedAuthSession();
    await seedConfiguration();

    // Seed a running job
    const jobRepo = testDs.getRepository(JobExecutionEntity);
    await jobRepo.save({
      jobType: JobType.MONTH_RECOLLECTION,
      status: JobStatus.RUNNING,
      startedAt: new Date(),
    });

    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error).toContain("already running");
  });

  it("returns 200 with job result on success", async () => {
    await seedAuthSession();
    await seedConfiguration();
    await seedSeat("octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.recordsProcessed).toBe(28); // February 2026 has 28 days
    expect(body.usersProcessed).toBe(1);
    expect(body.usersErrored).toBe(0);
    expect(body.jobExecutionId).toBeDefined();
  });

  it("creates CopilotUsage records in the database", async () => {
    await seedAuthSession();
    await seedConfiguration();
    const seatId = await seedSeat("octocat");

    mockedFetchUsage.mockImplementation(async (config) =>
      makeUsageResponse(config.username, config.day, config.month, config.year),
    );

    const request = makePostRequest({ month: "2", year: "2026" });
    await POST(request);

    const usageRepo = testDs.getRepository(CopilotUsageEntity);
    const records = await usageRepo.find({ where: { seatId } });
    expect(records).toHaveLength(28);
  });
});
