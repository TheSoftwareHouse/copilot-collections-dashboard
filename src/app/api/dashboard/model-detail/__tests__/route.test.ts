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

const { GET } = await import("@/app/api/dashboard/model-detail/route");
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
  const url = new URL("http://localhost:3000/api/dashboard/model-detail");
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

describe("GET /api/dashboard/model-detail", () => {
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
    const request = makeGetRequest({ model: "GPT-4o" });
    const response = await GET(request as never);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 400 when model param is missing", async () => {
    await seedAuthSession();
    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toHaveProperty("model");
  });

  it("returns 400 when model param is empty string", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ model: "" });
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toHaveProperty("model");
  });

  it("returns 400 when day param is invalid", async () => {
    await seedAuthSession();

    const req0 = makeGetRequest({ model: "GPT-4o", day: "0" });
    const res0 = await GET(req0 as never);
    expect(res0.status).toBe(400);

    const req32 = makeGetRequest({ model: "GPT-4o", day: "32" });
    const res32 = await GET(req32 as never);
    expect(res32.status).toBe(400);
  });

  it("returns 400 when month param is invalid", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ model: "GPT-4o", month: "13" });
    const response = await GET(request as never);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toHaveProperty("month");
  });

  it("returns empty users array and zeroed summary when no usage exists for the model", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ model: "GPT-4o", month: "1", year: "2025" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toEqual([]);
    expect(json.summary).toEqual({
      totalRequests: 0,
      totalSpending: 0,
      activeUsers: 0,
    });
    expect(json.model).toBe("GPT-4o");
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

    const request = makeGetRequest({ model: "GPT-4o", month: "3", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toHaveLength(2);

    const userB = json.users.find(
      (u: { githubUsername: string }) => u.githubUsername === "user-b",
    );
    expect(userB.totalRequests).toBe(200);
    expect(userB.totalSpending).toBe(20);

    const userA = json.users.find(
      (u: { githubUsername: string }) => u.githubUsername === "user-a",
    );
    expect(userA.totalRequests).toBe(100);
    expect(userA.totalSpending).toBe(10);
  });

  it("aggregates across all days in the month when day is omitted", async () => {
    await seedAuthSession();

    const seat = await seedSeat({ githubUsername: "monthly-user" });

    await seedUsage({
      seatId: seat.id,
      day: 5,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 40,
          grossAmount: 4,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 40,
          netAmount: 4,
        },
      ],
    });

    await seedUsage({
      seatId: seat.id,
      day: 15,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 60,
          grossAmount: 6,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 60,
          netAmount: 6,
        },
      ],
    });

    const request = makeGetRequest({ model: "GPT-4o", month: "3", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toHaveLength(1);
    expect(json.users[0].totalRequests).toBe(100);
    expect(json.users[0].totalSpending).toBe(10);
    expect(json.day).toBeUndefined();
  });

  it("returns usage for the specified day only when day is provided", async () => {
    await seedAuthSession();

    const seat = await seedSeat({ githubUsername: "daily-user" });

    await seedUsage({
      seatId: seat.id,
      day: 5,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 40,
          grossAmount: 4,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 40,
          netAmount: 4,
        },
      ],
    });

    await seedUsage({
      seatId: seat.id,
      day: 15,
      month: 3,
      year: 2026,
      usageItems: [
        {
          product: "chat",
          sku: "sku1",
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 60,
          grossAmount: 6,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 60,
          netAmount: 6,
        },
      ],
    });

    const request = makeGetRequest({ model: "GPT-4o", day: "5", month: "3", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toHaveLength(1);
    expect(json.users[0].totalRequests).toBe(40);
    expect(json.users[0].totalSpending).toBe(4);
    expect(json.day).toBe(5);
  });

  it("only returns usage for the requested model", async () => {
    await seedAuthSession();

    const seat = await seedSeat({ githubUsername: "model-filter-user" });

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

    const request = makeGetRequest({ model: "Claude Sonnet 4", month: "3", year: "2026" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.users).toHaveLength(1);
    expect(json.users[0].totalRequests).toBe(50);
    expect(json.users[0].totalSpending).toBe(15);
    expect(json.model).toBe("Claude Sonnet 4");
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

    const request = makeGetRequest({ model: "GPT-4o", month: "3", year: "2026" });
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

  it("summary totals match sum of user data", async () => {
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
          model: "GPT-4o",
          unitType: "request",
          pricePerUnit: 0.1,
          grossQuantity: 120,
          grossAmount: 24,
          discountQuantity: 0,
          discountAmount: 0,
          netQuantity: 120,
          netAmount: 24,
        },
      ],
    });

    const request = makeGetRequest({ model: "GPT-4o", month: "2", year: "2026" });
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
  });

  it("defaults to current month/year when omitted", async () => {
    await seedAuthSession();

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    const request = makeGetRequest({ model: "GPT-4o" });
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.month).toBe(currentMonth);
    expect(json.year).toBe(currentYear);
  });
});
