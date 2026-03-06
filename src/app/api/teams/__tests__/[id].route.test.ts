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

const { PUT, DELETE } = await import("@/app/api/teams/[id]/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { TeamEntity } = await import("@/entities/team.entity");
const { TeamMemberSnapshotEntity } = await import(
  "@/entities/team-member-snapshot.entity"
);
const { CopilotSeatEntity } = await import("@/entities/copilot-seat.entity");

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

async function createTeam(name: string, deletedAt?: Date): Promise<Team> {
  const teamRepo = testDs.getRepository(TeamEntity);
  return teamRepo.save({ name, deletedAt: deletedAt ?? null } as Partial<Team>);
}

async function createSeat(githubUsername: string, githubUserId: number) {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    githubUsername,
    githubUserId,
    status: SeatStatus.ACTIVE,
  } as Partial<CopilotSeat>);
}

function makePutRequest(
  id: number | string,
  body?: unknown
): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/teams/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

function makeDeleteRequest(
  id: number | string
): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/teams/${id}`, {
    method: "DELETE",
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

describe("PUT /api/teams/[id]", () => {
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
    const [req, ctx] = makePutRequest(1, { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid ID", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest("abc", { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid team ID");
  });

  it("returns 404 for non-existent team", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(9999, { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Team not found");
  });

  it("returns 404 for soft-deleted team", async () => {
    await seedAuthSession();
    const team = await createTeam("Deleted Team", new Date());
    const [req, ctx] = makePutRequest(team.id, { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(404);
  });

  it("returns 400 for empty name", async () => {
    await seedAuthSession();
    const team = await createTeam("Original");
    const [req, ctx] = makePutRequest(team.id, { name: "" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    await seedAuthSession();
    const team = await createTeam("Original");
    const request = new Request(
      `http://localhost:3000/api/teams/${team.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json",
      }
    );
    const ctx = { params: Promise.resolve({ id: String(team.id) }) };
    const response = await PUT(request, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("updates team name successfully", async () => {
    await seedAuthSession();
    const team = await createTeam("Original");
    const [req, ctx] = makePutRequest(team.id, { name: "Renamed" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.name).toBe("Renamed");
    expect(json.id).toBe(team.id);
  });

  it("returns 409 for duplicate team name", async () => {
    await seedAuthSession();
    await createTeam("Existing");
    const team = await createTeam("ToRename");
    const [req, ctx] = makePutRequest(team.id, { name: "Existing" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Team name already exists");
  });
});

describe("DELETE /api/teams/[id]", () => {
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
    const [req, ctx] = makeDeleteRequest(1);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid ID", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest("abc");
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid team ID");
  });

  it("returns 404 for non-existent team", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest(9999);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(404);
  });

  it("returns 404 for already soft-deleted team", async () => {
    await seedAuthSession();
    const team = await createTeam("Already Deleted", new Date());
    const [req, ctx] = makeDeleteRequest(team.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(404);
  });

  it("soft-deletes the team (sets deletedAt)", async () => {
    await seedAuthSession();
    const team = await createTeam("To Delete");

    const [req, ctx] = makeDeleteRequest(team.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);

    // Verify team is soft-deleted
    const teamRepo = testDs.getRepository(TeamEntity);
    const deleted = await teamRepo.findOne({ where: { id: team.id } });
    expect(deleted).not.toBeNull();
    expect(deleted!.deletedAt).not.toBeNull();
  });

  it("removes current-month snapshots but preserves historical ones", async () => {
    await seedAuthSession();
    const team = await createTeam("Snapshot Team");
    const seat = await createSeat("user1", 1001);

    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Historical snapshot (previous month)
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const snapshotRepo = testDs.getRepository(TeamMemberSnapshotEntity);

    await snapshotRepo.save({
      teamId: team.id,
      seatId: seat.id,
      month: prevMonth,
      year: prevYear,
    });

    // Current-month snapshot
    await snapshotRepo.save({
      teamId: team.id,
      seatId: seat.id,
      month: currentMonth,
      year: currentYear,
    });

    const [req, ctx] = makeDeleteRequest(team.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(200);

    // Current-month snapshot should be gone
    const currentSnapshots = await snapshotRepo.find({
      where: {
        teamId: team.id,
        month: currentMonth,
        year: currentYear,
      },
    });
    expect(currentSnapshots).toHaveLength(0);

    // Historical snapshot should remain
    const historicalSnapshots = await snapshotRepo.find({
      where: {
        teamId: team.id,
        month: prevMonth,
        year: prevYear,
      },
    });
    expect(historicalSnapshots).toHaveLength(1);
  });
});
