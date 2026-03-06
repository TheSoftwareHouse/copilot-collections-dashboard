/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { NextRequest } from "next/server";
import { SeatStatus } from "@/entities/enums";
import {
  CopilotSeatEntity,
  type CopilotSeat,
} from "@/entities/copilot-seat.entity";
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

const { GET } = await import("@/app/api/seats/route");
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

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/seats");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

async function seedSeat(
  overrides: Partial<CopilotSeat> & { githubUsername: string; githubUserId: number }
): Promise<CopilotSeat> {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    status: SeatStatus.ACTIVE,
    ...overrides,
  } as Partial<CopilotSeat>);
}

describe("GET /api/seats", () => {
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

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 200 with empty seats array when no seats exist", async () => {
    await seedAuthSession();
    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.seats).toHaveLength(0);
    expect(json.total).toBe(0);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(100);
    expect(json.totalPages).toBe(1);
  });

  it("returns 200 with seeded seats including correct fields", async () => {
    await seedAuthSession();
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
      lastActivityAt: new Date("2024-06-15T12:00:00Z"),
    });

    const request = makeGetRequest();
    const response = await GET(request as never);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.seats).toHaveLength(1);

    const seat = json.seats[0];
    expect(seat).toHaveProperty("id");
    expect(seat.githubUsername).toBe("octocat");
    expect(seat.status).toBe("active");
    expect(seat.firstName).toBe("Octo");
    expect(seat.lastName).toBe("Cat");
    expect(seat.department).toBe("Engineering");
    expect(seat).toHaveProperty("lastActivityAt");
    expect(seat).toHaveProperty("createdAt");
  });

  it("does NOT return sensitive/internal fields", async () => {
    await seedAuthSession();
    await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      planType: "business",
      lastActivityEditor: "vscode/1.90.0",
      assignedAt: new Date("2024-01-01T00:00:00Z"),
    });

    const request = makeGetRequest();
    const response = await GET(request as never);
    const json = await response.json();
    const seat = json.seats[0];

    expect(seat).not.toHaveProperty("githubUserId");
    expect(seat).not.toHaveProperty("assignedAt");
    expect(seat).not.toHaveProperty("lastActivityEditor");
    expect(seat).not.toHaveProperty("planType");
    expect(seat).not.toHaveProperty("updatedAt");
  });

  it("uses pagination defaults — page 1, pageSize 100", async () => {
    await seedAuthSession();
    const request = makeGetRequest();
    const response = await GET(request as never);
    const json = await response.json();
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(100);
  });

  it("respects custom page and pageSize query parameters", async () => {
    await seedAuthSession();
    // Seed 5 seats
    for (let i = 1; i <= 5; i++) {
      await seedSeat({
        githubUsername: `user-${String(i).padStart(2, "0")}`,
        githubUserId: i,
      });
    }

    const request = makeGetRequest({ page: "2", pageSize: "2" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats).toHaveLength(2);
    expect(json.page).toBe(2);
    expect(json.pageSize).toBe(2);
    expect(json.total).toBe(5);
    expect(json.totalPages).toBe(3);
  });

  it("returns correct totalPages calculation", async () => {
    await seedAuthSession();
    for (let i = 1; i <= 5; i++) {
      await seedSeat({
        githubUsername: `user-${i}`,
        githubUserId: i,
      });
    }

    const request = makeGetRequest({ pageSize: "2" });
    const response = await GET(request as never);
    const json = await response.json();
    expect(json.totalPages).toBe(3); // ceil(5 / 2) = 3
  });

  it("filters by status=active", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "active-user", githubUserId: 1, status: SeatStatus.ACTIVE });
    await seedSeat({ githubUsername: "inactive-user", githubUserId: 2, status: SeatStatus.INACTIVE });

    const request = makeGetRequest({ status: "active" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats).toHaveLength(1);
    expect(json.seats[0].githubUsername).toBe("active-user");
    expect(json.total).toBe(1);
  });

  it("filters by status=inactive", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "active-user", githubUserId: 1, status: SeatStatus.ACTIVE });
    await seedSeat({ githubUsername: "inactive-user", githubUserId: 2, status: SeatStatus.INACTIVE });

    const request = makeGetRequest({ status: "inactive" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats).toHaveLength(1);
    expect(json.seats[0].githubUsername).toBe("inactive-user");
    expect(json.total).toBe(1);
  });

  it("returns all seats when no status filter is provided", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "active-user", githubUserId: 1, status: SeatStatus.ACTIVE });
    await seedSeat({ githubUsername: "inactive-user", githubUserId: 2, status: SeatStatus.INACTIVE });

    const request = makeGetRequest();
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats).toHaveLength(2);
    expect(json.total).toBe(2);
  });

  it("clamps page below 1 to page 1", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ page: "0" });
    const response = await GET(request as never);
    const json = await response.json();
    expect(json.page).toBe(1);
  });

  it("clamps pageSize above 300 to 300", async () => {
    await seedAuthSession();
    const request = makeGetRequest({ pageSize: "500" });
    const response = await GET(request as never);
    const json = await response.json();
    expect(json.pageSize).toBe(300);
  });

  it("orders results by githubUsername ASC", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "charlie", githubUserId: 3 });
    await seedSeat({ githubUsername: "alice", githubUserId: 1 });
    await seedSeat({ githubUsername: "bob", githubUserId: 2 });

    const request = makeGetRequest();
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats[0].githubUsername).toBe("alice");
    expect(json.seats[1].githubUsername).toBe("bob");
    expect(json.seats[2].githubUsername).toBe("charlie");
  });

  // --- Search tests ---

  it("search filters by partial githubUsername match (case-insensitive)", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "octocat", githubUserId: 1 });
    await seedSeat({ githubUsername: "alice", githubUserId: 2 });
    await seedSeat({ githubUsername: "OctoFox", githubUserId: 3 });

    const request = makeGetRequest({ search: "octo" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.total).toBe(2);
    const usernames = json.seats.map((s: { githubUsername: string }) => s.githubUsername);
    expect(usernames).toContain("octocat");
    expect(usernames).toContain("OctoFox");
  });

  it("search filters by partial firstName match", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "user1", githubUserId: 1, firstName: "Alexander" });
    await seedSeat({ githubUsername: "user2", githubUserId: 2, firstName: "Bob" });

    const request = makeGetRequest({ search: "alex" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.total).toBe(1);
    expect(json.seats[0].firstName).toBe("Alexander");
  });

  it("search filters by partial lastName match", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "user1", githubUserId: 1, lastName: "Kowalski" });
    await seedSeat({ githubUsername: "user2", githubUserId: 2, lastName: "Smith" });

    const request = makeGetRequest({ search: "kowal" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.total).toBe(1);
    expect(json.seats[0].lastName).toBe("Kowalski");
  });

  it("search filters by partial department match", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "user1", githubUserId: 1, department: "Engineering" });
    await seedSeat({ githubUsername: "user2", githubUserId: 2, department: "Marketing" });

    const request = makeGetRequest({ search: "eng" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.total).toBe(1);
    expect(json.seats[0].department).toBe("Engineering");
  });

  it("search combined with status filter applies both conditions", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "octocat", githubUserId: 1, status: SeatStatus.ACTIVE });
    await seedSeat({ githubUsername: "octofox", githubUserId: 2, status: SeatStatus.INACTIVE });
    await seedSeat({ githubUsername: "alice", githubUserId: 3, status: SeatStatus.ACTIVE });

    const request = makeGetRequest({ search: "octo", status: "active" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.total).toBe(1);
    expect(json.seats[0].githubUsername).toBe("octocat");
  });

  it("search with no matches returns empty seats array and total 0", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "octocat", githubUserId: 1 });

    const request = makeGetRequest({ search: "nonexistent" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats).toHaveLength(0);
    expect(json.total).toBe(0);
  });

  it("search with % and _ characters treats them as literals", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "user_one", githubUserId: 1 });
    await seedSeat({ githubUsername: "user%two", githubUserId: 2 });
    await seedSeat({ githubUsername: "userthree", githubUserId: 3 });

    // Searching for literal "_" should only match usernames containing "_"
    const reqUnderscore = makeGetRequest({ search: "_" });
    const resUnderscore = await GET(reqUnderscore as never);
    const jsonUnderscore = await resUnderscore.json();

    expect(jsonUnderscore.total).toBe(1);
    expect(jsonUnderscore.seats[0].githubUsername).toBe("user_one");

    // Searching for literal "%" should only match usernames containing "%"
    const reqPercent = makeGetRequest({ search: "%" });
    const resPercent = await GET(reqPercent as never);
    const jsonPercent = await resPercent.json();

    expect(jsonPercent.total).toBe(1);
    expect(jsonPercent.seats[0].githubUsername).toBe("user%two");
  });

  // --- Sort tests ---

  it("sortBy=firstName&sortOrder=asc returns seats sorted by firstName ascending", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "u1", githubUserId: 1, firstName: "Charlie" });
    await seedSeat({ githubUsername: "u2", githubUserId: 2, firstName: "Alice" });
    await seedSeat({ githubUsername: "u3", githubUserId: 3, firstName: "Bob" });

    const request = makeGetRequest({ sortBy: "firstName", sortOrder: "asc" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats[0].firstName).toBe("Alice");
    expect(json.seats[1].firstName).toBe("Bob");
    expect(json.seats[2].firstName).toBe("Charlie");
  });

  it("sortBy=lastActivityAt&sortOrder=desc returns most recent first", async () => {
    await seedAuthSession();
    await seedSeat({
      githubUsername: "old",
      githubUserId: 1,
      lastActivityAt: new Date("2024-01-01T00:00:00Z"),
    });
    await seedSeat({
      githubUsername: "recent",
      githubUserId: 2,
      lastActivityAt: new Date("2024-06-15T00:00:00Z"),
    });
    await seedSeat({
      githubUsername: "mid",
      githubUserId: 3,
      lastActivityAt: new Date("2024-03-10T00:00:00Z"),
    });

    const request = makeGetRequest({ sortBy: "lastActivityAt", sortOrder: "desc" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats[0].githubUsername).toBe("recent");
    expect(json.seats[1].githubUsername).toBe("mid");
    expect(json.seats[2].githubUsername).toBe("old");
  });

  it("sortBy=status sorts seats by status", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "inactive1", githubUserId: 1, status: SeatStatus.INACTIVE });
    await seedSeat({ githubUsername: "active1", githubUserId: 2, status: SeatStatus.ACTIVE });

    const request = makeGetRequest({ sortBy: "status", sortOrder: "asc" });
    const response = await GET(request as never);
    const json = await response.json();

    // "active" < "inactive" alphabetically
    expect(json.seats[0].status).toBe("active");
    expect(json.seats[1].status).toBe("inactive");
  });

  it("invalid sortBy value falls back to githubUsername sort", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "charlie", githubUserId: 3 });
    await seedSeat({ githubUsername: "alice", githubUserId: 1 });

    const request = makeGetRequest({ sortBy: "invalidField" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats[0].githubUsername).toBe("alice");
    expect(json.seats[1].githubUsername).toBe("charlie");
  });

  it("invalid sortOrder value falls back to asc", async () => {
    await seedAuthSession();
    await seedSeat({ githubUsername: "charlie", githubUserId: 3 });
    await seedSeat({ githubUsername: "alice", githubUserId: 1 });

    const request = makeGetRequest({ sortOrder: "invalid" });
    const response = await GET(request as never);
    const json = await response.json();

    expect(json.seats[0].githubUsername).toBe("alice");
    expect(json.seats[1].githubUsername).toBe("charlie");
  });

  it("combined search + sort + status filter + pagination works correctly", async () => {
    await seedAuthSession();
    // Seed 4 seats in Engineering, 2 active, 2 inactive
    await seedSeat({ githubUsername: "eng-charlie", githubUserId: 1, department: "Engineering", status: SeatStatus.ACTIVE, firstName: "Charlie" });
    await seedSeat({ githubUsername: "eng-alice", githubUserId: 2, department: "Engineering", status: SeatStatus.ACTIVE, firstName: "Alice" });
    await seedSeat({ githubUsername: "eng-inactive", githubUserId: 3, department: "Engineering", status: SeatStatus.INACTIVE, firstName: "Dave" });
    await seedSeat({ githubUsername: "mkt-bob", githubUserId: 4, department: "Marketing", status: SeatStatus.ACTIVE, firstName: "Bob" });

    // Search "eng" + status "active" + sort by firstName ASC + pageSize 1
    const request = makeGetRequest({
      search: "eng",
      status: "active",
      sortBy: "firstName",
      sortOrder: "asc",
      pageSize: "1",
      page: "1",
    });
    const response = await GET(request as never);
    const json = await response.json();

    // 2 active Engineering seats, page 1 of 2
    expect(json.total).toBe(2);
    expect(json.totalPages).toBe(2);
    expect(json.seats).toHaveLength(1);
    expect(json.seats[0].firstName).toBe("Alice");
  });
});
