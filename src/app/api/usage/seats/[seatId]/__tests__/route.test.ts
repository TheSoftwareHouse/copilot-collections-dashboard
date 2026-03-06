/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { CopilotSeatEntity, type CopilotSeat } from "@/entities/copilot-seat.entity";
import { CopilotUsageEntity, type CopilotUsage } from "@/entities/copilot-usage.entity";
import { SeatStatus } from "@/entities/enums";
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

const { GET } = await import("@/app/api/usage/seats/[seatId]/route");
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

function makeGetRequest(seatId: string, params?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost:3000/api/usage/seats/${seatId}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function makeContext(seatId: string) {
  return { params: Promise.resolve({ seatId }) };
}

async function seedSeat(
  overrides: Partial<CopilotSeat> & { githubUsername: string; githubUserId: number },
): Promise<CopilotSeat> {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    status: SeatStatus.ACTIVE,
    ...overrides,
  } as Partial<CopilotSeat>);
}

async function seedUsage(
  overrides: Partial<CopilotUsage> & { seatId: number; day: number; month: number; year: number; usageItems: unknown[] },
): Promise<CopilotUsage> {
  const usageRepo = testDs.getRepository(CopilotUsageEntity);
  return usageRepo.save(overrides as Partial<CopilotUsage>);
}

describe("GET /api/usage/seats/[seatId]", () => {
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
    const request = makeGetRequest("1");
    const response = await GET(request as never, makeContext("1") as never);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 400 for non-numeric seatId", async () => {
    await seedAuthSession();

    const request = makeGetRequest("abc");
    const response = await GET(request as never, makeContext("abc") as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid seat ID");
  });

  it("returns 400 for negative seatId", async () => {
    await seedAuthSession();

    const request = makeGetRequest("-5");
    const response = await GET(request as never, makeContext("-5") as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid seat ID");
  });

  it("returns 404 for non-existent seatId", async () => {
    await seedAuthSession();

    const request = makeGetRequest("99999", { month: "2", year: "2026" });
    const response = await GET(request as never, makeContext("99999") as never);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Seat not found");
  });

  it("returns seat info with empty usage data when no usage exists for the month", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "empty-user",
      githubUserId: 5001,
      firstName: "Empty",
      lastName: "User",
      department: "QA",
    });

    const request = makeGetRequest(String(seat.id), { month: "2", year: "2026" });
    const response = await GET(request as never, makeContext(String(seat.id)) as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.seat.seatId).toBe(seat.id);
    expect(json.seat.githubUsername).toBe("empty-user");
    expect(json.seat.firstName).toBe("Empty");
    expect(json.seat.lastName).toBe("User");
    expect(json.seat.department).toBe("QA");

    expect(json.summary.totalRequests).toBe(0);
    expect(json.summary.grossSpending).toBe(0);
    expect(json.summary.netSpending).toBe(0);

    expect(json.dailyUsage).toEqual([]);
    expect(json.modelBreakdown).toEqual([]);

    expect(json.month).toBe(2);
    expect(json.year).toBe(2026);
  });

  it("returns correct daily usage aggregation", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "daily-user",
      githubUserId: 5002,
    });

    // Day 1: two models
    await seedUsage({
      seatId: seat.id,
      day: 1,
      month: 2,
      year: 2026,
      usageItems: [
        { product: "Copilot", sku: "Premium", model: "Claude Sonnet 4.5", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 50, grossAmount: 2.0, discountQuantity: 50, discountAmount: 2.0, netQuantity: 0, netAmount: 0 },
        { product: "Copilot", sku: "Premium", model: "GPT-4o", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 10, grossAmount: 0.4, discountQuantity: 0, discountAmount: 0, netQuantity: 10, netAmount: 0.4 },
      ],
    });

    // Day 3: one model
    await seedUsage({
      seatId: seat.id,
      day: 3,
      month: 2,
      year: 2026,
      usageItems: [
        { product: "Copilot", sku: "Premium", model: "Claude Sonnet 4.5", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 30, grossAmount: 1.2, discountQuantity: 30, discountAmount: 1.2, netQuantity: 0, netAmount: 0 },
      ],
    });

    const request = makeGetRequest(String(seat.id), { month: "2", year: "2026" });
    const response = await GET(request as never, makeContext(String(seat.id)) as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.dailyUsage).toHaveLength(2);

    // Day 1: 50 + 10 = 60 requests, 2.0 + 0.4 = 2.4 gross
    expect(json.dailyUsage[0].day).toBe(1);
    expect(json.dailyUsage[0].totalRequests).toBe(60);
    expect(json.dailyUsage[0].grossAmount).toBeCloseTo(2.4, 2);

    // Day 3: 30 requests, 1.2 gross
    expect(json.dailyUsage[1].day).toBe(3);
    expect(json.dailyUsage[1].totalRequests).toBe(30);
    expect(json.dailyUsage[1].grossAmount).toBeCloseTo(1.2, 2);
  });

  it("returns correct model breakdown", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "model-user",
      githubUserId: 5003,
    });

    // Day 1
    await seedUsage({
      seatId: seat.id,
      day: 1,
      month: 2,
      year: 2026,
      usageItems: [
        { product: "Copilot", sku: "Premium", model: "Claude Sonnet 4.5", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 50, grossAmount: 2.0, discountQuantity: 50, discountAmount: 2.0, netQuantity: 0, netAmount: 0 },
        { product: "Copilot", sku: "Premium", model: "GPT-4o", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 20, grossAmount: 0.8, discountQuantity: 0, discountAmount: 0, netQuantity: 20, netAmount: 0.8 },
      ],
    });

    // Day 2: more Sonnet usage
    await seedUsage({
      seatId: seat.id,
      day: 2,
      month: 2,
      year: 2026,
      usageItems: [
        { product: "Copilot", sku: "Premium", model: "Claude Sonnet 4.5", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 30, grossAmount: 1.2, discountQuantity: 30, discountAmount: 1.2, netQuantity: 0, netAmount: 0 },
      ],
    });

    const request = makeGetRequest(String(seat.id), { month: "2", year: "2026" });
    const response = await GET(request as never, makeContext(String(seat.id)) as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.modelBreakdown).toHaveLength(2);

    // Ordered by totalRequests DESC — Sonnet first (80), GPT-4o second (20)
    expect(json.modelBreakdown[0].model).toBe("Claude Sonnet 4.5");
    expect(json.modelBreakdown[0].totalRequests).toBe(80);
    expect(json.modelBreakdown[0].grossAmount).toBeCloseTo(3.2, 2);
    expect(json.modelBreakdown[0].netAmount).toBe(0);

    expect(json.modelBreakdown[1].model).toBe("GPT-4o");
    expect(json.modelBreakdown[1].totalRequests).toBe(20);
    expect(json.modelBreakdown[1].grossAmount).toBeCloseTo(0.8, 2);
    expect(json.modelBreakdown[1].netAmount).toBeCloseTo(0.8, 2);
  });

  it("returns correct summary totals", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "summary-user",
      githubUserId: 5004,
    });

    await seedUsage({
      seatId: seat.id,
      day: 1,
      month: 2,
      year: 2026,
      usageItems: [
        { product: "Copilot", sku: "Premium", model: "Claude Sonnet 4.5", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 50, grossAmount: 2.0, discountQuantity: 50, discountAmount: 2.0, netQuantity: 0, netAmount: 0 },
        { product: "Copilot", sku: "Premium", model: "GPT-4o", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 20, grossAmount: 0.8, discountQuantity: 0, discountAmount: 0, netQuantity: 20, netAmount: 0.8 },
      ],
    });

    await seedUsage({
      seatId: seat.id,
      day: 2,
      month: 2,
      year: 2026,
      usageItems: [
        { product: "Copilot", sku: "Premium", model: "Claude Sonnet 4.5", unitType: "requests", pricePerUnit: 0.04, grossQuantity: 30, grossAmount: 1.2, discountQuantity: 10, discountAmount: 0.4, netQuantity: 20, netAmount: 0.8 },
      ],
    });

    const request = makeGetRequest(String(seat.id), { month: "2", year: "2026" });
    const response = await GET(request as never, makeContext(String(seat.id)) as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    // totalRequests: 50 + 20 + 30 = 100
    expect(json.summary.totalRequests).toBe(100);
    // grossSpending: 2.0 + 0.8 + 1.2 = 4.0
    expect(json.summary.grossSpending).toBeCloseTo(4.0, 2);
    // netSpending: 0 + 0.8 + 0.8 = 1.6
    expect(json.summary.netSpending).toBeCloseTo(1.6, 2);
  });

  it("defaults to current month/year when query params are missing", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "defaults-user",
      githubUserId: 5005,
    });

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const request = makeGetRequest(String(seat.id));
    const response = await GET(request as never, makeContext(String(seat.id)) as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.month).toBe(currentMonth);
    expect(json.year).toBe(currentYear);
  });

  it("returns premiumRequestsPerSeat as a positive number", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "premium-user",
      githubUserId: 5006,
    });

    const request = makeGetRequest(String(seat.id), { month: "2", year: "2026" });
    const response = await GET(request as never, makeContext(String(seat.id)) as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.premiumRequestsPerSeat).toBeDefined();
    expect(typeof json.premiumRequestsPerSeat).toBe("number");
    expect(json.premiumRequestsPerSeat).toBeGreaterThan(0);
  });
});
