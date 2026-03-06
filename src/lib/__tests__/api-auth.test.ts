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

const { requireAuth, isAuthFailure } = await import("@/lib/api-auth");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);

describe("requireAuth", () => {
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

  it("returns user object when session is valid", async () => {
    // Create a user
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.save({
      username: "testuser",
      passwordHash: await hashPassword("password"),
    });

    // Create a session
    const token = await createSession(user.id);
    mockCookieStore[SESSION_COOKIE_NAME] = token;

    const result = await requireAuth();
    expect(isAuthFailure(result)).toBe(false);
    if (!isAuthFailure(result)) {
      expect(result.user.id).toBe(user.id);
      expect(result.user.username).toBe("testuser");
    }
  });

  it("returns 401 when no session cookie is present", async () => {
    const result = await requireAuth();
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.status).toBe(401);
      const json = await result.json();
      expect(json.error).toBe("Authentication required");
    }
  });

  it("returns 401 when session token is invalid/unknown", async () => {
    mockCookieStore[SESSION_COOKIE_NAME] = "nonexistent-token";

    const result = await requireAuth();
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.status).toBe(401);
    }
  });

  it("returns 401 when session is expired", async () => {
    // Create a user
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.save({
      username: "testuser",
      passwordHash: await hashPassword("password"),
    });

    // Create a session manually with expired time
    const { SessionEntity } = await import("@/entities/session.entity");
    const sessionRepo = testDs.getRepository(SessionEntity);
    await sessionRepo.save({
      token: "expired-token-abc123",
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    });
    mockCookieStore[SESSION_COOKIE_NAME] = "expired-token-abc123";

    const result = await requireAuth();
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.status).toBe(401);
    }
  });
});
