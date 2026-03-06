/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
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

let mockAuthMethod: "credentials" | "azure" = "credentials";
vi.mock("@/lib/auth-config", () => ({
  getAuthMethod: () => mockAuthMethod,
}));

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api-auth")>();
  return {
    ...mod,
    requireAdmin: vi.fn().mockImplementation(() => mod.requireAdmin()),
  };
});

const { PUT, DELETE } = await import("@/app/api/users/[id]/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);
const { UserEntity } = await import("@/entities/user.entity");
const { UserRole } = await import("@/entities/enums");
const apiAuth = await import("@/lib/api-auth");

let authUserId: number;

async function seedAuthSession(options?: { role?: string }): Promise<void> {
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testadmin",
    passwordHash: await hashPassword("testpass"),
    role: options?.role ?? UserRole.ADMIN,
  });
  authUserId = user.id;
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}

async function createOtherUser(
  username = "otheruser",
  password = "otherpass",
  role?: string
): Promise<{ id: number; username: string }> {
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username,
    passwordHash: await hashPassword(password),
    ...(role !== undefined && { role }),
  });
  return { id: user.id, username: user.username };
}

function makePutRequest(id: number | string, body?: unknown): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

function makeDeleteRequest(id: number | string): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`http://localhost:3000/api/users/${id}`, {
    method: "DELETE",
  });
  return [request, { params: Promise.resolve({ id: String(id) }) }];
}

describe("PUT /api/users/[id]", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    mockAuthMethod = "credentials";
  });

  it("returns 401 without session", async () => {
    const [req, ctx] = makePutRequest(1, { username: "x" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(401);
  });

  it("returns 400 for non-numeric id", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest("abc", { username: "x" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid user ID");
  });

  it("returns 400 for malformed JSON", async () => {
    await seedAuthSession();
    const request = new Request("http://localhost:3000/api/users/1", {
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

  it("returns 400 for empty update object", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(1, {});
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 404 for non-existent user", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(99999, { username: "newname" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("User not found");
  });

  it("updates username successfully", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { username: "renamed" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.username).toBe("renamed");
    expect(json).not.toHaveProperty("passwordHash");
  });

  it("updates password successfully", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { password: "newpassword" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);

    const userRepo = testDs.getRepository(UserEntity);
    const updated = await userRepo.findOne({ where: { id: other.id } });
    expect(updated!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(updated!.passwordHash).not.toBe(
      await hashPassword("otherpass")
    );
  });

  it("updates both username and password", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, {
      username: "both",
      password: "newpass",
    });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.username).toBe("both");
  });

  it("returns 409 for duplicate username", async () => {
    await seedAuthSession();
    await createOtherUser("existing", "pass");
    const target = await createOtherUser("target", "pass");
    const [req, ctx] = makePutRequest(target.id, { username: "existing" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Username already exists");
  });

  it("returns 403 for non-admin user", async () => {
    await seedAuthSession({ role: UserRole.USER });
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { username: "renamed" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 403 when changing own role", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(authUserId, { role: UserRole.USER });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Cannot change your own role");
  });

  it("allows changing own username without role field", async () => {
    await seedAuthSession();
    const [req, ctx] = makePutRequest(authUserId, { username: "newname" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.username).toBe("newname");
  });

  it("returns 409 when demoting the last remaining admin", async () => {
    // Mock requireAdmin to return a synthetic admin session (not backed by a DB admin user)
    // so the target is the ONLY admin in the database, making adminCount = 1
    vi.mocked(apiAuth.requireAdmin).mockResolvedValueOnce({
      user: { id: 999, username: "fakeadmin", role: UserRole.ADMIN },
    });
    const target = await createOtherUser("onlyadmin", "pass", UserRole.ADMIN);
    const [req, ctx] = makePutRequest(target.id, { role: UserRole.USER });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Cannot demote the last remaining admin");
  });

  it("returns 400 for invalid role value", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { role: "superadmin" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(400);
  });

  it("updates role from user to admin", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { role: UserRole.ADMIN });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.role).toBe(UserRole.ADMIN);

    const userRepo = testDs.getRepository(UserEntity);
    const updated = await userRepo.findOne({ where: { id: other.id } });
    expect(updated!.role).toBe(UserRole.ADMIN);
  });

  it("updates role from admin to user when multiple admins exist", async () => {
    await seedAuthSession();
    const other = await createOtherUser("otheradmin", "pass", UserRole.ADMIN);
    const [req, ctx] = makePutRequest(other.id, { role: UserRole.USER });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.role).toBe(UserRole.USER);

    const userRepo = testDs.getRepository(UserEntity);
    const updated = await userRepo.findOne({ where: { id: other.id } });
    expect(updated!.role).toBe(UserRole.USER);
  });

  it("updates only role without username or password", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { role: UserRole.ADMIN });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.role).toBe(UserRole.ADMIN);
    expect(json.username).toBe("otheruser");
  });

  it("response includes role field", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { username: "renamed" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty("role");
    expect(json).not.toHaveProperty("passwordHash");
  });
});

describe("DELETE /api/users/[id]", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    mockAuthMethod = "credentials";
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

  it("returns 400 for non-numeric id", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest("abc");
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid user ID");
  });

  it("returns 403 when trying to delete own account", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest(authUserId);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Cannot delete your own account");
  });

  it("returns 404 for non-existent user", async () => {
    await seedAuthSession();
    const [req, ctx] = makeDeleteRequest(99999);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("User not found");
  });

  it("deletes user successfully", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makeDeleteRequest(other.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);

    const userRepo = testDs.getRepository(UserEntity);
    const deleted = await userRepo.findOne({ where: { id: other.id } });
    expect(deleted).toBeNull();
  });

  // NOTE: Session cascade deletion is handled by the DB-level FK constraint
  // (ON DELETE CASCADE) defined in migrations. Since the test DB uses
  // synchronize: true (no migrations), this is verified via E2E tests instead.
});

describe("Azure mode - /api/users/[id]", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    mockAuthMethod = "azure";
  });

  it("PUT returns 403 with Azure AD error message", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makePutRequest(other.id, { username: "renamed" });
    const response = await PUT(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain("Azure AD");
  });

  it("DELETE returns 403 with Azure AD error message", async () => {
    await seedAuthSession();
    const other = await createOtherUser();
    const [req, ctx] = makeDeleteRequest(other.id);
    const response = await DELETE(req, ctx);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain("Azure AD");
  });
});
