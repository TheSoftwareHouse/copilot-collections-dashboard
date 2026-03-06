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

vi.mock("@/lib/auth-config", () => ({
  getAuthMethod: () => "credentials",
  shouldUseSecureCookies: () => false,
  getAuthConfig: () => ({ method: "credentials" }),
}));

const { getSession, createSession, hashPassword, SESSION_COOKIE_NAME } =
  await import("@/lib/auth");

async function seedSessionForUser(
  overrides: { role?: string } = {},
): Promise<void> {
  const { UserEntity } = await import("@/entities/user.entity");
  const userRepo = testDs.getRepository(UserEntity);
  const user = await userRepo.save({
    username: "testuser",
    passwordHash: await hashPassword("testpass"),
    ...overrides,
  });
  const token = await createSession(user.id);
  mockCookieStore[SESSION_COOKIE_NAME] = token;
}

describe("getSession", () => {
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

  it("returns role 'user' for a user created without specifying a role", async () => {
    await seedSessionForUser();

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.user.role).toBe("user");
  });

  it("returns role 'admin' for a user created with role 'admin'", async () => {
    await seedSessionForUser({ role: "admin" });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.user.role).toBe("admin");
  });

  it("returns null when no session cookie is set", async () => {
    const session = await getSession();
    expect(session).toBeNull();
  });
});
