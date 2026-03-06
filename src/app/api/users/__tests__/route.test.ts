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

const { GET, POST } = await import("@/app/api/users/route");
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

function makeRequest(body?: unknown): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/users", init);
}

describe("GET /api/users", () => {
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
    const response = await GET();
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const response = await GET();
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("returns 200 with empty user list when only the auth user exists", async () => {
    await seedAuthSession();
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.users).toHaveLength(1);
    expect(json.users[0].username).toBe("testadmin");
  });

  it("returns 200 with seeded users and excludes passwordHash", async () => {
    await seedAuthSession();

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "anotheruser",
      passwordHash: await hashPassword("pass"),
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.users).toHaveLength(2);

    for (const user of json.users) {
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("username");
      expect(user).toHaveProperty("role");
      expect(user).toHaveProperty("createdAt");
      expect(user).toHaveProperty("updatedAt");
      expect(user).not.toHaveProperty("passwordHash");
    }

    const adminUser = json.users.find((u: { username: string }) => u.username === "testadmin");
    expect(adminUser.role).toBe("admin");
    const regularUser = json.users.find((u: { username: string }) => u.username === "anotheruser");
    expect(regularUser.role).toBe("user");
  });
});

describe("POST /api/users", () => {
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
    const request = makeRequest({ username: "new", password: "pass" });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 201 for valid input", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "newuser", password: "newpass" });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.username).toBe("newuser");
    expect(json.role).toBe("user");
    expect(json).toHaveProperty("id");
    expect(json).toHaveProperty("createdAt");
    expect(json).toHaveProperty("updatedAt");
    expect(json).not.toHaveProperty("passwordHash");
  });

  it("returns 403 for non-admin user", async () => {
    const { UserRole } = await import("@/entities/enums");
    await seedAuthSession({ role: UserRole.USER });
    const request = makeRequest({ username: "newuser", password: "newpass" });
    const response = await POST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Admin access required");
  });

  it("creates user with admin role when role is 'admin'", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "adminuser", password: "pass", role: "admin" });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.role).toBe("admin");

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: json.id } });
    expect(user!.role).toBe("admin");
  });

  it("creates user with user role when role is 'user'", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "regularuser", password: "pass", role: "user" });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.role).toBe("user");

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: json.id } });
    expect(user!.role).toBe("user");
  });

  it("defaults to user role when role is not specified", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "defaultrole", password: "pass" });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.role).toBe("user");

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: json.id } });
    expect(user!.role).toBe("user");
  });

  it("returns 400 for invalid role value", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "badrole", password: "pass", role: "superadmin" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("stores hashed password in database", async () => {
    await seedAuthSession();
    const request = makeRequest({
      username: "hashtest",
      password: "plaintext",
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const json = await response.json();

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { id: json.id } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe("plaintext");
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("returns 400 for missing fields", async () => {
    await seedAuthSession();
    const request = makeRequest({});
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for empty username", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "", password: "pass" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.details.username).toBeDefined();
  });

  it("returns 400 for empty password", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "user", password: "" });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.details.password).toBeDefined();
  });

  it("returns 400 for malformed JSON body", async () => {
    await seedAuthSession();
    const request = new Request("http://localhost:3000/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 409 for duplicate username", async () => {
    await seedAuthSession();
    const request1 = makeRequest({ username: "duplicate", password: "pass1" });
    const response1 = await POST(request1);
    expect(response1.status).toBe(201);

    const request2 = makeRequest({ username: "duplicate", password: "pass2" });
    const response2 = await POST(request2);
    expect(response2.status).toBe(409);
    const json = await response2.json();
    expect(json.error).toBe("Username already exists");
  });
});

describe("Azure mode - /api/users", () => {
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

  it("POST returns 403 with Azure AD error message", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "newuser", password: "newpass" });
    const response = await POST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain("Azure AD");
  });

  it("POST does not create a user in the database", async () => {
    await seedAuthSession();
    const request = makeRequest({ username: "blocked", password: "pass" });
    await POST(request);

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const users = await userRepo.find();
    // Only the auth session user should exist
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("testadmin");
  });

  it("GET returns 200 with user list (unchanged)", async () => {
    await seedAuthSession();
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.users).toHaveLength(1);
  });
});
