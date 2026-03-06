/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import type { Team } from "@/entities/team.entity";
import type { CopilotSeat } from "@/entities/copilot-seat.entity";
import { SeatStatus } from "@/entities/enums";

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

const { GET } = await import(
  "@/app/api/teams/[id]/members/purge-impact/route"
);
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { TeamEntity } = await import("@/entities/team.entity");
const { TeamMemberSnapshotEntity } = await import(
  "@/entities/team-member-snapshot.entity"
);
const { CopilotSeatEntity } = await import("@/entities/copilot-seat.entity");

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

async function createTeam(name: string, deletedAt?: Date): Promise<Team> {
  const teamRepo = testDs.getRepository(TeamEntity);
  return teamRepo.save({
    name,
    deletedAt: deletedAt ?? null,
  } as Partial<Team>);
}

async function createSeat(
  githubUsername: string,
  githubUserId: number,
  status: SeatStatus = SeatStatus.ACTIVE,
): Promise<CopilotSeat> {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    githubUsername,
    githubUserId,
    status,
  } as Partial<CopilotSeat>);
}

function makeGetRequest(
  id: number | string,
  seatId?: number | string,
): [Request, { params: Promise<{ id: string }> }] {
  const url = new URL(`http://localhost:3000/api/teams/${id}/members/purge-impact`);
  if (seatId !== undefined) {
    url.searchParams.set("seatId", String(seatId));
  }
  const request = new Request(url.toString(), { method: "GET" });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

const now = new Date();
const currentMonth = now.getUTCMonth() + 1;
const currentYear = now.getUTCFullYear();

describe("GET /api/teams/[id]/members/purge-impact", () => {
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
    const [req, ctx] = makeGetRequest(1, 1);
    const response = await GET(req, ctx);
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const [req, ctx] = makeGetRequest(1, 1);
    const response = await GET(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 400 for invalid team ID", async () => {
    await seedAuthSession();
    const [req, ctx] = makeGetRequest("abc", 1);
    const response = await GET(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid team ID");
  });

  it("returns 400 for missing seatId query parameter", async () => {
    await seedAuthSession();
    const team = await createTeam("Team");
    const [req, ctx] = makeGetRequest(team.id);
    const response = await GET(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid or missing seatId query parameter");
  });

  it("returns 400 for non-numeric seatId", async () => {
    await seedAuthSession();
    const team = await createTeam("Team");
    const [req, ctx] = makeGetRequest(team.id, "abc");
    const response = await GET(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid or missing seatId query parameter");
  });

  it("returns 404 for non-existent team", async () => {
    await seedAuthSession();
    const [req, ctx] = makeGetRequest(9999, 1);
    const response = await GET(req, ctx);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Team not found");
  });

  it("returns 404 for soft-deleted team", async () => {
    await seedAuthSession();
    const team = await createTeam("Deleted", new Date());
    const [req, ctx] = makeGetRequest(team.id, 1);
    const response = await GET(req, ctx);
    expect(response.status).toBe(404);
  });

  it("returns months: 0 when no snapshots exist", async () => {
    await seedAuthSession();
    const team = await createTeam("Team");
    const seat = await createSeat("user1", 5001);
    const [req, ctx] = makeGetRequest(team.id, seat.id);
    const response = await GET(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.months).toBe(0);
  });

  it("returns correct months count for multiple snapshots", async () => {
    await seedAuthSession();
    const team = await createTeam("Team");
    const seat = await createSeat("user1", 5001);

    const snapshotRepo = testDs.getRepository(TeamMemberSnapshotEntity);
    await snapshotRepo.save([
      { teamId: team.id, seatId: seat.id, month: currentMonth, year: currentYear },
      { teamId: team.id, seatId: seat.id, month: 1, year: 2024 },
      { teamId: team.id, seatId: seat.id, month: 2, year: 2024 },
    ]);

    const [req, ctx] = makeGetRequest(team.id, seat.id);
    const response = await GET(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.months).toBe(3);
  });

  it("counts only snapshots for the specified team", async () => {
    await seedAuthSession();
    const teamA = await createTeam("Team A");
    const teamB = await createTeam("Team B");
    const seat = await createSeat("user1", 5001);

    const snapshotRepo = testDs.getRepository(TeamMemberSnapshotEntity);
    await snapshotRepo.save([
      { teamId: teamA.id, seatId: seat.id, month: currentMonth, year: currentYear },
      { teamId: teamA.id, seatId: seat.id, month: 1, year: 2024 },
      { teamId: teamB.id, seatId: seat.id, month: currentMonth, year: currentYear },
      { teamId: teamB.id, seatId: seat.id, month: 2, year: 2024 },
      { teamId: teamB.id, seatId: seat.id, month: 3, year: 2024 },
    ]);

    const [reqA, ctxA] = makeGetRequest(teamA.id, seat.id);
    const responseA = await GET(reqA, ctxA);
    expect(responseA.status).toBe(200);
    const jsonA = await responseA.json();
    expect(jsonA.months).toBe(2);

    const [reqB, ctxB] = makeGetRequest(teamB.id, seat.id);
    const responseB = await GET(reqB, ctxB);
    expect(responseB.status).toBe(200);
    const jsonB = await responseB.json();
    expect(jsonB.months).toBe(3);
  });
});
