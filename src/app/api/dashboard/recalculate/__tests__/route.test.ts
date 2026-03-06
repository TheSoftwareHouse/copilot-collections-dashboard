/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { SeatStatus } from "@/entities/enums";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { CopilotUsageEntity, type CopilotUsage } from "@/entities/copilot-usage.entity";
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

const { POST } = await import("@/app/api/dashboard/recalculate/route");
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

function makePostRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/dashboard/recalculate");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), { method: "POST" });
}

async function seedSeat(
  username: string,
  status: SeatStatus = SeatStatus.ACTIVE,
): Promise<number> {
  const repo = testDs.getRepository(CopilotSeatEntity);
  const seat = await repo.save({
    githubUsername: username,
    githubUserId: Math.floor(Math.random() * 100000),
    status,
  });
  return seat.id;
}

function makeUsageItem(
  model: string,
  grossQuantity: number,
  grossAmount: number,
  discountQuantity: number = 0,
  discountAmount: number = 0,
) {
  return {
    product: "Copilot",
    sku: "Copilot Premium Request",
    model,
    unitType: "requests",
    pricePerUnit: grossQuantity > 0 ? grossAmount / grossQuantity : 0,
    grossQuantity,
    grossAmount,
    discountQuantity,
    discountAmount,
    netQuantity: grossQuantity - discountQuantity,
    netAmount: grossAmount - discountAmount,
  };
}

async function seedUsage(
  seatId: number,
  day: number,
  month: number,
  year: number,
  usageItems: CopilotUsage["usageItems"],
): Promise<void> {
  const repo = testDs.getRepository(CopilotUsageEntity);
  await repo.save({
    seatId,
    day,
    month,
    year,
    usageItems,
  } as Partial<CopilotUsage>);
}

async function seedStaleSummary(
  overrides: Partial<DashboardMonthlySummary> & { month: number; year: number },
): Promise<void> {
  const repo = testDs.getRepository(DashboardMonthlySummaryEntity);
  await repo.save({
    totalSeats: 2,
    activeSeats: 2,
    totalSpending: 999.0,
    seatBaseCost: 0,
    totalPremiumRequests: 100,
    includedPremiumRequestsUsed: 0,
    modelUsage: [],
    mostActiveUsers: [],
    leastActiveUsers: [],
    ...overrides,
  } as Partial<DashboardMonthlySummary>);
}

describe("POST /api/dashboard/recalculate", () => {
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
    const request = makePostRequest();
    const response = await POST(request as never);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("recalculates all months when no params provided", async () => {
    await seedAuthSession();

    const seat1 = await seedSeat("user-1");
    const seat2 = await seedSeat("user-2");

    // January usage: gross=10, discount=5, net=5
    await seedUsage(seat1, 1, 1, 2026, [
      makeUsageItem("GPT-4o", 100, 10.0, 50, 5.0),
    ]);
    // February usage: gross=20, discount=10, net=10
    await seedUsage(seat2, 1, 2, 2026, [
      makeUsageItem("GPT-4o", 200, 20.0, 100, 10.0),
    ]);

    const request = makePostRequest();
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.total).toBe(2);
    expect(json.recalculatedMonths).toEqual(
      expect.arrayContaining([
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
      ]),
    );

    // Verify the summary rows are correct
    const summaryRepo = testDs.getRepository(DashboardMonthlySummaryEntity);

    const jan = await summaryRepo.findOne({ where: { month: 1, year: 2026 } });
    expect(jan).not.toBeNull();
    // netAmount=5, seatBaseCost=2×19=38, totalSpending=43
    expect(Number(jan!.seatBaseCost)).toBe(38);
    expect(Number(jan!.totalSpending)).toBe(43);

    const feb = await summaryRepo.findOne({ where: { month: 2, year: 2026 } });
    expect(feb).not.toBeNull();
    // netAmount=10, seatBaseCost=2×19=38, totalSpending=48
    expect(Number(feb!.seatBaseCost)).toBe(38);
    expect(Number(feb!.totalSpending)).toBe(48);
  });

  it("recalculates a single month when month and year params provided", async () => {
    await seedAuthSession();

    const seat1 = await seedSeat("user-1");

    await seedUsage(seat1, 1, 1, 2026, [
      makeUsageItem("GPT-4o", 100, 10.0, 50, 5.0),
    ]);
    await seedUsage(seat1, 1, 2, 2026, [
      makeUsageItem("GPT-4o", 200, 20.0, 100, 10.0),
    ]);

    const request = makePostRequest({ month: "1", year: "2026" });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.total).toBe(1);
    expect(json.recalculatedMonths).toEqual([{ month: 1, year: 2026 }]);

    // Only January should have a summary row
    const summaryRepo = testDs.getRepository(DashboardMonthlySummaryEntity);
    const jan = await summaryRepo.findOne({ where: { month: 1, year: 2026 } });
    expect(jan).not.toBeNull();
    expect(Number(jan!.seatBaseCost)).toBe(19); // 1 active seat × $19

    // February should not have been recalculated
    const feb = await summaryRepo.findOne({ where: { month: 2, year: 2026 } });
    expect(feb).toBeNull();
  });

  it("returns 400 for invalid month parameter", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "13", year: "2026" });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Invalid month");
  });

  it("returns 400 for invalid year parameter", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "1", year: "abc" });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Invalid year");
  });

  it("returns 400 when only month is provided without year", async () => {
    await seedAuthSession();

    const request = makePostRequest({ month: "1" });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Both month and year");
  });

  it("returns 400 when only year is provided without month", async () => {
    await seedAuthSession();

    const request = makePostRequest({ year: "2026" });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("Both month and year");
  });

  it("returns empty recalculatedMonths when no data exists", async () => {
    await seedAuthSession();

    const request = makePostRequest();
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.total).toBe(0);
    expect(json.recalculatedMonths).toEqual([]);
  });

  it("correctly updates stale summary data with netAmount-based values", async () => {
    await seedAuthSession();

    const seat1 = await seedSeat("user-1");
    const seat2 = await seedSeat("user-2");

    // Seed usage: gross=50, discount=50, net=0 (fully discounted)
    await seedUsage(seat1, 1, 2, 2026, [
      makeUsageItem("GPT-4o", 300, 50.0, 300, 50.0),
    ]);
    await seedUsage(seat2, 1, 2, 2026, [
      makeUsageItem("GPT-4o", 200, 30.0, 200, 30.0),
    ]);

    // Seed stale summary with old grossAmount-based values
    await seedStaleSummary({
      month: 2,
      year: 2026,
      totalSpending: 80.0, // was SUM(grossAmount)=50+30
      seatBaseCost: 0,     // was not computed
    });

    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const summaryRepo = testDs.getRepository(DashboardMonthlySummaryEntity);
    const summary = await summaryRepo.findOne({ where: { month: 2, year: 2026 } });

    // All usage is fully discounted → netAmount = 0
    // seatBaseCost = 2 active × $19 = 38
    // totalSpending = 0 + 38 = 38
    expect(Number(summary!.seatBaseCost)).toBe(38);
    expect(Number(summary!.totalSpending)).toBe(38);
  });

  it("seatBaseCost reflects current active seat count × 19", async () => {
    await seedAuthSession();

    // 3 active, 1 inactive
    const seat1 = await seedSeat("user-1", SeatStatus.ACTIVE);
    await seedSeat("user-2", SeatStatus.ACTIVE);
    await seedSeat("user-3", SeatStatus.ACTIVE);
    await seedSeat("user-4", SeatStatus.INACTIVE);

    await seedUsage(seat1, 1, 2, 2026, [
      makeUsageItem("GPT-4o", 10, 1.0, 5, 0.5),
    ]);

    const request = makePostRequest({ month: "2", year: "2026" });
    const response = await POST(request as never);
    expect(response.status).toBe(200);

    const summaryRepo = testDs.getRepository(DashboardMonthlySummaryEntity);
    const summary = await summaryRepo.findOne({ where: { month: 2, year: 2026 } });

    // 3 active seats × $19 = $57
    expect(Number(summary!.seatBaseCost)).toBe(57);
    // netAmount = 1.0 - 0.5 = 0.5, totalSpending = 0.5 + 57 = 57.5
    expect(Number(summary!.totalSpending)).toBe(57.5);
  });
});
