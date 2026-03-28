/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import type { CopilotSeat } from "@/entities/copilot-seat.entity";
import { CopilotUsageEntity } from "@/entities/copilot-usage.entity";
import type { CopilotUsage } from "@/entities/copilot-usage.entity";
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

const { GET } = await import("@/app/api/dashboard/daily-detail/route");
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
  const url = new URL("http://localhost:3000/api/dashboard/daily-detail");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

async function seedSeat(
  overrides: Partial<CopilotSeat> & { githubUsername: string },
): Promise<CopilotSeat> {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    githubUserId: Math.floor(Math.random() * 1000000),
    status: SeatStatus.ACTIVE,
    assignedAt: new Date(),
    ...overrides,
  } as Partial<CopilotSeat>);
}

async function seedUsage(
  overrides: Partial<CopilotUsage> & {
    seatId: number;
    day: number;
    month: number;
    year: number;
    usageItems: unknown[];
  },
): Promise<CopilotUsage> {
  const usageRepo = testDs.getRepository(CopilotUsageEntity);
  return usageRepo.save(overrides as Partial<CopilotUsage>);
}

describe("GET /api/dashboard/daily-detail", () => {
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
    const request = makeGetRequest({ day: "5" });
    const response = await GET(request as never);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 400 when day param is missing", async () => {
    await seedAuthSession();
    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toHaveProperty("day");
  });

  it("returns 400 when day param is invalid", async () => {
    await seedAuthSession();

    // day = 0
    const req0 = makeGetRequest({ day: "0" });
    const res0 = await GET(req0 as never);
    expect(res0.status).toBe(400);

    // day = 32
    const req32 = makeGetRequest({ day: "32" });
    const res32 = await GET(req32 as never);
    expect(res32.status).toBe(400);

    // day = abc
    const reqAbc = makeGetRequest({ day: "abc" });
    const resAbc = await GET(reqAbc as never);
    expect(resAbc.status).toBe(400);
  });

  it("returns 400 when month param is invalid", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ day: "1", month: "13" });
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toHaveProperty("month");
  });

  it("returns empty response when no usage for the day", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ day: "15", month: "1", year: "2025" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toEqual([]);
    expect(json.models).toEqual([]);
    expect(json.summary).toEqual({
      totalRequests: 0,
      totalSpending: 0,
      activeUsers: 0,
      modelsUsed: 0,
    });
    expect(json.day).toBe(15);
    expect(json.month).toBe(1);
    expect(json.year).toBe(2025);
  });

  it("returns correct per-user aggregation", async () => {
    await seedAuthSession();

    const seatA = await seedSeat({
      githubUsername: "user-a",
      firstName: "Alice",
      lastName: "Smith",
      department: "Engineering",
    });
    const seatB = await seedSeat({
      githubUsername: "user-b",
      firstName: "Bob",
      lastName: "Jones",
      department: "Design",
    });

    await seedUsage({
      seatId: seatA.id,
      day: 10,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 100,
          grossAmount: 10,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 100,
          netAmount: 10,
        },
        {
          product: "completions",
          sku: "sku2",
          model: "Claude Sonnet 4",
          unitType: "request",
          pricePerUnit: 0.2,
          grossQuantity: 50,
          grossAmount: 10,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 50,
          netAmount: 10,
        },
      ],
    });

    await seedUsage({
      seatId: seatB.id,
      day: 10,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 200,
          grossAmount: 20,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 200,
          netAmount: 20,
        },
      ],
    });

    const request = makeGetRequest({ day: "10", month: "3", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toHaveLength(2);

    // Ordered by totalRequests DESC: user-b (200) > user-a (150)
    const userB = json.users.find(
      (u: { githubUsername: string }) => u.githubUsername === "user-b",
    );
    expect(userB.totalRequests).toBe(200);
    expect(userB.totalSpending).toBe(20);

    const userA = json.users.find(
      (u: { githubUsername: string }) => u.githubUsername === "user-a",
    );
    expect(userA.totalRequests).toBe(150);
    expect(userA.totalSpending).toBe(20);
  });

  it("returns correct per-model aggregation", async () => {
    await seedAuthSession();

    const seat = await seedSeat({ githubUsername: "model-user" });

    await seedUsage({
      seatId: seat.id,
      day: 10,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 100,
          grossAmount: 10,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 100,
          netAmount: 10,
        },
        {
          product: "completions",
          sku: "sku2",
          model: "Claude Sonnet 4",
          unitType: "request",
          pricePerUnit: 0.2,
          grossQuantity: 50,
          grossAmount: 15,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 50,
          netAmount: 15,
        },
      ],
    });

    const request = makeGetRequest({ day: "10", month: "3", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.models).toHaveLength(2);

    const gpt = json.models.find(
      (m: { model: string }) => m.model === "GPT-4o",
    );
    expect(gpt.totalRequests).toBe(100);
    expect(gpt.totalSpending).toBe(10);

    const claude = json.models.find(
      (m: { model: string }) => m.model === "Claude Sonnet 4",
    );
    expect(claude.totalRequests).toBe(50);
    expect(claude.totalSpending).toBe(15);
  });

  it("summary totals match sum of users data", async () => {
    await seedAuthSession();

    const seatA = await seedSeat({ githubUsername: "sum-user-a" });
    const seatB = await seedSeat({ githubUsername: "sum-user-b" });

    await seedUsage({
      seatId: seatA.id,
      day: 5,
      month: 2,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 80,
          grossAmount: 8,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 80,
          netAmount: 8,
        },
      ],
    });

    await seedUsage({
      seatId: seatB.id,
      day: 5,
      month: 2,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "Claude Sonnet 4",
          unitType: "request",
          pricePerUnit: 0.2,
          grossQuantity: 120,
          grossAmount: 24,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 120,
          netAmount: 24,
        },
      ],
    });

    const request = makeGetRequest({ day: "5", month: "2", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    const userTotalRequests = json.users.reduce(
      (sum: number, u: { totalRequests: number }) => sum + u.totalRequests,
      0,
    );
    const userTotalSpending = json.users.reduce(
      (sum: number, u: { totalSpending: number }) => sum + u.totalSpending,
      0,
    );

    expect(json.summary.totalRequests).toBe(userTotalRequests);
    expect(json.summary.totalSpending).toBe(userTotalSpending);
    expect(json.summary.activeUsers).toBe(json.users.length);
    expect(json.summary.modelsUsed).toBe(json.models.length);
  });

  it("includes both active and inactive seats with usage", async () => {
    await seedAuthSession();

    const activeSeat = await seedSeat({
      githubUsername: "active-user",
      status: SeatStatus.ACTIVE,
    });
    const inactiveSeat = await seedSeat({
      githubUsername: "inactive-user",
      status: SeatStatus.INACTIVE,
    });

    await seedUsage({
      seatId: activeSeat.id,
      day: 7,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 50,
          grossAmount: 5,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 50,
          netAmount: 5,
        },
      ],
    });

    await seedUsage({
      seatId: inactiveSeat.id,
      day: 7,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 30,
          grossAmount: 3,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 30,
          netAmount: 3,
        },
      ],
    });

    const request = makeGetRequest({ day: "7", month: "3", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.users).toHaveLength(2);
    const usernames = json.users.map(
      (u: { githubUsername: string }) => u.githubUsername,
    );
    expect(usernames).toContain("active-user");
    expect(usernames).toContain("inactive-user");
  });

  it("user entry includes all expected fields", async () => {
    await seedAuthSession();

    const seat = await seedSeat({
      githubUsername: "field-check-user",
      firstName: "Jane",
      lastName: "Doe",
      department: "Product",
    });

    await seedUsage({
      seatId: seat.id,
      day: 12,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 75,
          grossAmount: 7.5,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 75,
          netAmount: 7.5,
        },
      ],
    });

    const request = makeGetRequest({ day: "12", month: "3", year: "2026" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.users).toHaveLength(1);
    const user = json.users[0];
    expect(user).toHaveProperty("seatId", seat.id);
    expect(user).toHaveProperty("githubUsername", "field-check-user");
    expect(user).toHaveProperty("firstName", "Jane");
    expect(user).toHaveProperty("lastName", "Doe");
    expect(user).toHaveProperty("department", "Product");
    expect(user).toHaveProperty("totalRequests", 75);
    expect(user).toHaveProperty("totalSpending", 7.5);
  });

  it("defaults to current month/year when omitted", async () => {
    await seedAuthSession();

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const request = makeGetRequest({ day: "1" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.month).toBe(currentMonth);
    expect(json.year).toBe(currentYear);
  });
});
