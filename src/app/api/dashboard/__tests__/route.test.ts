/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { DashboardMonthlySummaryEntity } from "@/entities/dashboard-monthly-summary.entity";
import type { DashboardMonthlySummary } from "@/entities/dashboard-monthly-summary.entity";
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

const { GET } = await import("@/app/api/dashboard/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);

async function seedAuthSession(): Promise<void> {
  const { UserEntity } = await import("@/entities/user.entity");
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testadmin",
    passwordHash: await hashPassword("testpass"),
  });
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/dashboard");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

async function seedSummary(
  overrides: Partial<DashboardMonthlySummary> & { month: number; year: number },
): Promise<DashboardMonthlySummary> {
  const repo = testDs.getRepository(DashboardMonthlySummaryEntity);
  return repo.save({
    totalSeats: 10,
    activeSeats: 8,
    totalSpending: 500.0,
    seatBaseCost: 152.0,
    totalPremiumRequests: 1200,
    includedPremiumRequestsUsed: 900,
    modelUsage: [
      { model: "GPT-4o", totalRequests: 100, totalAmount: 300 },
      { model: "Claude Sonnet 4.5", totalRequests: 50, totalAmount: 200 },
    ],
    mostActiveUsers: [
      { seatId: 1, githubUsername: "top-user", firstName: "Top", lastName: "User", totalRequests: 500, totalSpending: 250 },
    ],
    leastActiveUsers: [
      { seatId: 2, githubUsername: "low-user", firstName: "Low", lastName: "User", totalRequests: 10, totalSpending: 5 },
    ],
    ...overrides,
  } as Partial<DashboardMonthlySummary>);
}

describe("GET /api/dashboard", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
  });

  it("returns 401 without session", async () => {
    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns current month/year when no query params provided", async () => {
    await seedAuthSession();

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.month).toBe(currentMonth);
    expect(json.year).toBe(currentYear);
  });

  it("returns stored summary data when row exists", async () => {
    await seedAuthSession();
    await seedSummary({ month: 2, year: 2026 });

    const request = makeGetRequest({ month: "2", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.totalSeats).toBe(10);
    expect(json.activeSeats).toBe(8);
    expect(json.totalSpending).toBe(500);
    expect(json.seatBaseCost).toBe(152);
    expect(json.includedPremiumRequests).toBe(2400);
    expect(json.includedPremiumRequestsUsed).toBe(900);
    expect(json.includedPremiumRequestsRemaining).toBe(1500);
    expect(json.totalPremiumRequests).toBe(1200);
    expect(json.paidPremiumRequests).toBe(300);
    expect(json.modelUsage).toHaveLength(2);
    expect(json.modelUsage[0].model).toBe("GPT-4o");
    expect(json.mostActiveUsers).toHaveLength(1);
    expect(json.mostActiveUsers[0].githubUsername).toBe("top-user");
    expect(json.mostActiveUsers[0].totalSpending).toBe(250);
    expect(json.mostActiveUsers[0].seatId).toBe(1);
    expect(json.leastActiveUsers).toHaveLength(1);
    expect(json.leastActiveUsers[0].githubUsername).toBe("low-user");
    expect(json.leastActiveUsers[0].totalSpending).toBe(5);
    expect(json.leastActiveUsers[0].seatId).toBe(2);
    expect(json.premiumRequestsPerSeat).toBe(300);
    expect(json.month).toBe(2);
    expect(json.year).toBe(2026);
  });

  it("returns empty-state response when no row exists", async () => {
    await seedAuthSession();

    const request = makeGetRequest({ month: "6", year: "2025" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.totalSeats).toBe(0);
    expect(json.activeSeats).toBe(0);
    expect(json.totalSpending).toBe(0);
    expect(json.seatBaseCost).toBe(0);
    expect(json.includedPremiumRequests).toBe(0);
    expect(json.includedPremiumRequestsUsed).toBe(0);
    expect(json.includedPremiumRequestsRemaining).toBe(0);
    expect(json.totalPremiumRequests).toBe(0);
    expect(json.paidPremiumRequests).toBe(0);
    expect(json.premiumRequestsPerSeat).toBe(300);
    expect(json.modelUsage).toEqual([]);
    expect(json.mostActiveUsers).toEqual([]);
    expect(json.leastActiveUsers).toEqual([]);
    expect(json.month).toBe(6);
    expect(json.year).toBe(2025);
  });

  it("handles explicit month and year query parameters", async () => {
    await seedAuthSession();
    await seedSummary({ month: 1, year: 2026, totalSeats: 5, activeSeats: 3, totalSpending: 100 });
    await seedSummary({ month: 3, year: 2026, totalSeats: 15, activeSeats: 12, totalSpending: 900 });

    const request1 = makeGetRequest({ month: "1", year: "2026" });
    const response1 = await GET(request1 as never);
    const json1 = await response1.json();
    expect(json1.totalSeats).toBe(5);
    expect(json1.month).toBe(1);

    const request3 = makeGetRequest({ month: "3", year: "2026" });
    const response3 = await GET(request3 as never);
    const json3 = await response3.json();
    expect(json3.totalSeats).toBe(15);
    expect(json3.month).toBe(3);
  });

  it("returns valid response structure with all expected fields", async () => {
    await seedAuthSession();
    await seedSummary({ month: 2, year: 2026 });

    const request = makeGetRequest({ month: "2", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json).toHaveProperty("totalSeats");
    expect(json).toHaveProperty("activeSeats");
    expect(json).toHaveProperty("totalSpending");
    expect(json).toHaveProperty("seatBaseCost");
    expect(json).toHaveProperty("includedPremiumRequests");
    expect(json).toHaveProperty("includedPremiumRequestsUsed");
    expect(json).toHaveProperty("includedPremiumRequestsRemaining");
    expect(json).toHaveProperty("totalPremiumRequests");
    expect(json).toHaveProperty("paidPremiumRequests");
    expect(json).toHaveProperty("premiumRequestsPerSeat");
    expect(json).toHaveProperty("previousIncludedPremiumRequests");
    expect(json).toHaveProperty("previousIncludedPremiumRequestsUsed");
    expect(json).toHaveProperty("modelUsage");
    expect(json).toHaveProperty("mostActiveUsers");
    expect(json).toHaveProperty("leastActiveUsers");
    expect(json).toHaveProperty("month");
    expect(json).toHaveProperty("year");
  });

  it("falls back to current month/year for invalid query params", async () => {
    await seedAuthSession();

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Invalid month (13) and year (abc)
    const request = makeGetRequest({ month: "13", year: "abc" });
    const response = await GET(request as never);
    const json = await response.json();
    expect(json.month).toBe(currentMonth);
    expect(json.year).toBe(currentYear);
  });

  it("returns previous month data when previous summary exists", async () => {
    await seedAuthSession();
    await seedSummary({ month: 2, year: 2026 });
    await seedSummary({ month: 1, year: 2026, activeSeats: 5, includedPremiumRequestsUsed: 400 });

    const request = makeGetRequest({ month: "2", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    // Previous month: 5 active seats × 300 = 1500
    expect(json.previousIncludedPremiumRequests).toBe(1500);
    expect(json.previousIncludedPremiumRequestsUsed).toBe(400);
  });

  it("returns null for previous month data when no previous summary exists", async () => {
    await seedAuthSession();
    await seedSummary({ month: 2, year: 2026 });

    const request = makeGetRequest({ month: "2", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.previousIncludedPremiumRequests).toBeNull();
    expect(json.previousIncludedPremiumRequestsUsed).toBeNull();
  });

  it("handles year boundary — January fetches December of previous year", async () => {
    await seedAuthSession();
    await seedSummary({ month: 1, year: 2026 });
    await seedSummary({ month: 12, year: 2025, activeSeats: 6, includedPremiumRequestsUsed: 500 });

    const request = makeGetRequest({ month: "1", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    // Previous month (Dec 2025): 6 active seats × 300 = 1800
    expect(json.previousIncludedPremiumRequests).toBe(1800);
    expect(json.previousIncludedPremiumRequestsUsed).toBe(500);
  });

  it("returns null previous month data in empty-state response", async () => {
    await seedAuthSession();

    const request = makeGetRequest({ month: "6", year: "2025" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.previousIncludedPremiumRequests).toBeNull();
    expect(json.previousIncludedPremiumRequestsUsed).toBeNull();
  });
});
