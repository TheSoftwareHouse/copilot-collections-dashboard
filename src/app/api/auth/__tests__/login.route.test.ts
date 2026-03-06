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

// Mock next/headers cookies
let mockCookieStore: Record<string, string> = {};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieStore[name];
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

vi.mock("@/lib/auth-config", () => ({
  shouldUseSecureCookies: () => false,
}));

const { POST } = await import("@/app/api/auth/login/route");
const { hashPassword } = await import("@/lib/auth");

function makeRequest(body?: unknown): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/auth/login", init);
}

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockCookieStore = {};
    // Clear env vars
    delete process.env.DEFAULT_ADMIN_USERNAME;
    delete process.env.DEFAULT_ADMIN_PASSWORD;
  });

  it("returns 200 with username and set-cookie for valid credentials", async () => {
    // Seed a user
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "admin",
      passwordHash: await hashPassword("correctpassword"),
    });

    const request = makeRequest({
      username: "admin",
      password: "correctpassword",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.username).toBe("admin");

    // Verify cookie is set
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("session_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
  });

  it("returns 401 for invalid password", async () => {
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "admin",
      passwordHash: await hashPassword("correctpassword"),
    });

    const request = makeRequest({
      username: "admin",
      password: "wrongpassword",
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid username or password");
  });

  it("returns 401 for unknown username", async () => {
    const request = makeRequest({
      username: "nonexistent",
      password: "somepassword",
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid username or password");
  });

  it("returns 400 for missing body fields", async () => {
    const request = makeRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for empty username", async () => {
    const request = makeRequest({ username: "", password: "test" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details.username).toBeDefined();
  });

  it("returns 400 for empty password", async () => {
    const request = makeRequest({ username: "admin", password: "" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
    expect(json.details.password).toBeDefined();
  });

  it("returns 400 for malformed JSON body", async () => {
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("seeds default admin when env vars are set and no users exist", async () => {
    process.env.DEFAULT_ADMIN_USERNAME = "defaultadmin";
    process.env.DEFAULT_ADMIN_PASSWORD = "defaultpass123";

    const request = makeRequest({
      username: "defaultadmin",
      password: "defaultpass123",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.username).toBe("defaultadmin");
  });

  it("creates a session record in the database on successful login", async () => {
    const { UserEntity } = await import("@/entities/user.entity");
    const { SessionEntity } = await import("@/entities/session.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const sessionRepo = testDs.getRepository(SessionEntity);

    await userRepo.save({
      username: "admin",
      passwordHash: await hashPassword("password"),
    });

    const request = makeRequest({
      username: "admin",
      password: "password",
    });
    await POST(request);

    const sessions = await sessionRepo.find();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token).toBeDefined();
    expect(sessions[0].token.length).toBe(64); // 32 bytes hex
  });
});
