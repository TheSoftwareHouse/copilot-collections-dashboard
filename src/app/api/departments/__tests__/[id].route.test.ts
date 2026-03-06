/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import type { Department } from "@/entities/department.entity";
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

const { PUT, DELETE } = await import("@/app/api/departments/[id]/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { DepartmentEntity } = await import("@/entities/department.entity");
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

async function createDepartment(name: string): Promise<Department> {
  const deptRepo = testDs.getRepository(DepartmentEntity);
  return deptRepo.save({ name } as Partial<Department>);
}

async function createSeat(
  githubUsername: string,
  githubUserId: number,
  departmentId?: number
) {
  const seatRepo = testDs.getRepository(CopilotSeatEntity);
  return seatRepo.save({
    githubUsername,
    githubUserId,
    status: SeatStatus.ACTIVE,
    departmentId: departmentId ?? null,
  } as Partial<CopilotSeat>);
}

function makePutRequest(
  id: number | string,
  body?: unknown
): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/departments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

function makeDeleteRequest(
  id: number | string
): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/departments/${id}`, {
    method: "DELETE",
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

describe("PUT /api/departments/[id]", () => {
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

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const [req, ctx] = makePutRequest(1, { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 400 for invalid ID", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest("abc", { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid department ID");
  });

  it("returns 404 for non-existent department", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(9999, { name: "Updated" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Department not found");
  });

  it("returns 400 for empty name", async () => {
    await seedAuthSession();
    const dept = await createDepartment("Original");
    const [req, ctx] = makePutRequest(dept.id, { name: "" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    await seedAuthSession();
    const dept = await createDepartment("Original");
    const request = new Request(
      `http://localhost:3000/api/departments/${dept.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json",
      }
    );
    const ctx = { params: Promise.resolve({ id: String(dept.id) }) };
    const response = await PUT(request, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("updates department name successfully", async () => {
    await seedAuthSession();
    const dept = await createDepartment("Original");
    const [req, ctx] = makePutRequest(dept.id, { name: "Renamed" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.name).toBe("Renamed");
    expect(json.id).toBe(dept.id);
  });

  it("returns 409 for duplicate department name", async () => {
    await seedAuthSession();
    await createDepartment("Existing");
    const dept = await createDepartment("ToRename");
    const [req, ctx] = makePutRequest(dept.id, { name: "Existing" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Department name already exists");
  });
});

describe("DELETE /api/departments/[id]", () => {
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

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const [req, ctx] = makeDeleteRequest(1);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 400 for invalid ID", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest("abc");
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid department ID");
  });

  it("returns 404 for non-existent department", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest(9999);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(404);
  });

  it("deletes the department successfully", async () => {
    await seedAuthSession();
    const dept = await createDepartment("To Delete");

    const [req, ctx] = makeDeleteRequest(dept.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);

    // Verify department is actually gone
    const deptRepo = testDs.getRepository(DepartmentEntity);
    const deleted = await deptRepo.findOne({ where: { id: dept.id } });
    expect(deleted).toBeNull();
  });

  it("sets departmentId to NULL on associated seats after delete", async () => {
    await seedAuthSession();
    const dept = await createDepartment("With Seats");
    const seat = await createSeat("user1", 1001, dept.id);

    // Verify seat is assigned
    const seatRepo = testDs.getRepository(CopilotSeatEntity);
    const before = await seatRepo.findOne({ where: { id: seat.id } });
    expect(before!.departmentId).toBe(dept.id);

    const [req, ctx] = makeDeleteRequest(dept.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(200);

    // Verify seat's departmentId is now NULL
    const after = await seatRepo.findOne({ where: { id: seat.id } });
    expect(after).not.toBeNull();
    expect(after!.departmentId).toBeNull();
  });
});
