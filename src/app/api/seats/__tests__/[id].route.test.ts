/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { SeatStatus } from "@/entities/enums";
import {
  CopilotSeatEntity,
  type CopilotSeat,
} from "@/entities/copilot-seat.entity";
import {
  DepartmentEntity,
  type Department,
} from "@/entities/department.entity";
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

const { PUT } = await import("@/app/api/seats/[id]/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { UserEntity } = await import("@/entities/user.entity");

async function seedAuthSession(): Promise<void> {
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testadmin",
    passwordHash: await hashPassword("testpass"),
  });
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}

async function seedSeat(
  overrides: Partial<CopilotSeat> & {
    githubUsername: string;
    githubUserId: number;
  }
): Promise<CopilotSeat> {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    status: SeatStatus.ACTIVE,
    ...overrides,
  } as Partial<CopilotSeat>);
}

async function seedDepartment(name: string): Promise<Department> {
  const deptRepo = testDs.getRepository(DepartmentEntity);
  return deptRepo.save({ name });
}

function makePutRequest(
  id: number | string,
  body?: unknown
): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/seats/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

describe("PUT /api/seats/[id]", () => {
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
    const [req, ctx] = makePutRequest(1, { firstName: "Test" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(401);
  });

  it("returns 400 for non-numeric id", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest("abc", { firstName: "Test" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid seat ID");
  });

  it("returns 400 for malformed JSON body", async () => {
    await seedAuthSession();
    const request = new Request("http://localhost:3000/api/seats/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const ctx = { params: Promise.resolve({ id: "1" }) };
    const response = await PUT(request, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 400 for empty update object (no fields)", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(1, {});
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 with validation details for oversized field values", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(1, {
      firstName: "a".repeat(256),
    });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details).toBeDefined();
  });

  it("returns 404 for non-existent seat ID", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(99999, { firstName: "Test" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Seat not found");
  });

  it("updates firstName successfully", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: null,
    });
    const [req, ctx] = makePutRequest(seat.id, { firstName: "Octo" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.firstName).toBe("Octo");

    // Verify database state
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.firstName).toBe("Octo");
  });

  it("updates lastName successfully", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      lastName: null,
    });
    const [req, ctx] = makePutRequest(seat.id, { lastName: "Cat" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.lastName).toBe("Cat");

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.lastName).toBe("Cat");
  });

  it("updates department successfully", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      department: null,
    });
    const [req, ctx] = makePutRequest(seat.id, {
      department: "Engineering",
    });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.department).toBe("Engineering");

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.department).toBe("Engineering");
  });

  it("updates all three fields simultaneously", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
    });
    const [req, ctx] = makePutRequest(seat.id, {
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
    });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.firstName).toBe("Octo");
    expect(json.lastName).toBe("Cat");
    expect(json.department).toBe("Engineering");
  });

  it("clears a field by sending null", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
    });
    const [req, ctx] = makePutRequest(seat.id, { firstName: null });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.firstName).toBeNull();

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.firstName).toBeNull();
  });

  it("coerces empty string to null", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
    });
    const [req, ctx] = makePutRequest(seat.id, { firstName: "" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.firstName).toBeNull();

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.firstName).toBeNull();
  });

  it("does NOT modify githubUsername or status when updating enrichment fields", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      status: SeatStatus.ACTIVE,
    });
    const [req, ctx] = makePutRequest(seat.id, {
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
    });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.githubUsername).toBe("octocat");
    expect(json.status).toBe("active");

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.githubUsername).toBe("octocat");
    expect(updated!.status).toBe(SeatStatus.ACTIVE);
  });

  it("response shape matches expected format", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
      lastActivityAt: new Date("2024-06-15T12:00:00Z"),
    });
    const [req, ctx] = makePutRequest(seat.id, { firstName: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toHaveProperty("id");
    expect(json).toHaveProperty("githubUsername");
    expect(json).toHaveProperty("status");
    expect(json).toHaveProperty("firstName");
    expect(json).toHaveProperty("lastName");
    expect(json).toHaveProperty("department");
    expect(json).toHaveProperty("departmentId");
    expect(json).toHaveProperty("lastActivityAt");
    expect(json).toHaveProperty("createdAt");
  });

  it("response does NOT include sensitive/internal fields", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      planType: "business",
      lastActivityEditor: "vscode/1.90.0",
      assignedAt: new Date("2024-01-01T00:00:00Z"),
    });
    const [req, ctx] = makePutRequest(seat.id, { firstName: "Test" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).not.toHaveProperty("githubUserId");
    expect(json).not.toHaveProperty("assignedAt");
    expect(json).not.toHaveProperty("lastActivityEditor");
    expect(json).not.toHaveProperty("planType");
    expect(json).not.toHaveProperty("updatedAt");
  });

  // --- departmentId tests ---

  it("sets departmentId and syncs department name when valid department ID is provided", async () => {
    await seedAuthSession();
    const dept = await seedDepartment("Engineering");
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
    });
    const [req, ctx] = makePutRequest(seat.id, { departmentId: dept.id });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.departmentId).toBe(dept.id);
    expect(json.department).toBe("Engineering");

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.departmentId).toBe(dept.id);
    expect(updated!.department).toBe("Engineering");
  });

  it("clears both departmentId and department when departmentId is null", async () => {
    await seedAuthSession();
    const dept = await seedDepartment("Engineering");
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      departmentId: dept.id,
      department: "Engineering",
    });
    const [req, ctx] = makePutRequest(seat.id, { departmentId: null });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.departmentId).toBeNull();
    expect(json.department).toBeNull();

    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const updated = await seatRepo.findOne({ where: { id: seat.id } });
    expect(updated!.departmentId).toBeNull();
    expect(updated!.department).toBeNull();
  });

  it("returns 400 when departmentId references a non-existent department", async () => {
    await seedAuthSession();
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
    });
    const [req, ctx] = makePutRequest(seat.id, { departmentId: 99999 });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Department not found");
  });

  it("returns 400 for invalid departmentId types (string, negative, float)", async () => {
    await seedAuthSession();
    for (const invalid of ["abc", -1, 1.5]) {
      const [req, ctx] = makePutRequest(1, { departmentId: invalid });
      const response = await PUT(req, ctx);
      expect(response.status).toBe(400);
    }
  });

  it("response shape includes departmentId", async () => {
    await seedAuthSession();
    const dept = await seedDepartment("Marketing");
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      departmentId: dept.id,
      department: "Marketing",
    });
    const [req, ctx] = makePutRequest(seat.id, { firstName: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty("departmentId");
    expect(json.departmentId).toBe(dept.id);
  });

  it("updating departmentId does not affect firstName, lastName, githubUsername, or status", async () => {
    await seedAuthSession();
    const dept = await seedDepartment("Sales");
    const seat = await seedSeat({
      githubUsername: "octocat",
      githubUserId: 1,
      firstName: "Octo",
      lastName: "Cat",
      status: SeatStatus.ACTIVE,
    });
    const [req, ctx] = makePutRequest(seat.id, { departmentId: dept.id });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.firstName).toBe("Octo");
    expect(json.lastName).toBe("Cat");
    expect(json.githubUsername).toBe("octocat");
    expect(json.status).toBe("active");
  });
});
