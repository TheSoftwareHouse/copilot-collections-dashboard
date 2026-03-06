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

// Mock auth-config — switchable per test
let mockAuthMethod: "credentials" | "azure" = "credentials";
vi.mock("@/lib/auth-config", () => ({
  getAuthConfig: () => {
    if (mockAuthMethod === "azure") {
      return {
        method: "azure",
        tenantId: "test-tenant-id",
        clientId: "test-client-id",
        redirectUri: "https://app.example.com/api/auth/callback",
      };
    }
    return { method: "credentials" };
  },
  getAuthMethod: () => mockAuthMethod,
}));

// Mock refreshAzureSession
const mockRefreshAzureSession = vi.fn();
vi.mock("@/lib/azure-auth", () => ({
  refreshAzureSession: (...args: unknown[]) => mockRefreshAzureSession(...args),
}));

const { getSession, SESSION_COOKIE_NAME } = await import("@/lib/auth");

describe("getSession() — token refresh", () => {
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
    mockRefreshAzureSession.mockReset();
  });

  async function seedUser(username = "testuser") {
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.save({
      username,
      passwordHash: "AZURE_AD_USER",
    });
    return user;
  }

  async function seedSession(
    userId: number,
    options: { expired?: boolean; refreshToken?: string | null } = {},
  ) {
    const { SessionEntity } = await import("@/entities/session.entity");
    const sessionRepo = testDs.getRepository(SessionEntity);
    const token = `test-token-${Date.now()}`;
    const expiresAt = options.expired
      ? new Date(Date.now() - 60_000) // 1 minute ago
      : new Date(Date.now() + 3600_000); // 1 hour from now

    const session = await sessionRepo.save({
      token,
      userId,
      expiresAt,
      refreshToken: options.refreshToken ?? null,
    });

    return { session, token };
  }

  // ── Expired Azure session with refresh token ───────────────────

  it("calls refreshAzureSession for expired Azure session with refreshToken", async () => {
    mockAuthMethod = "azure";
    const user = await seedUser();
    const { session, token } = await seedSession(user.id, {
      expired: true,
      refreshToken: "azure-refresh-token",
    });

    // Simulate successful refresh: update the session in DB
    mockRefreshAzureSession.mockImplementation(async (sessionId: number) => {
      const { SessionEntity } = await import("@/entities/session.entity");
      const sessionRepo = testDs.getRepository(SessionEntity);
      await sessionRepo.update(sessionId, {
        expiresAt: new Date(Date.now() + 3600_000),
        refreshToken: "new-refresh-token",
      });
      return true;
    });

    mockCookieStore = { [SESSION_COOKIE_NAME]: token };
    const result = await getSession();

    expect(mockRefreshAzureSession).toHaveBeenCalledWith(
      session.id,
      "azure-refresh-token",
    );
    expect(result).not.toBeNull();
    expect(result!.user.username).toBe("testuser");
  });

  it("returns null when refreshAzureSession fails", async () => {
    mockAuthMethod = "azure";
    const user = await seedUser();
    const { session, token } = await seedSession(user.id, {
      expired: true,
      refreshToken: "azure-refresh-token",
    });

    // Simulate failed refresh: delete the session
    mockRefreshAzureSession.mockImplementation(async (sessionId: number) => {
      const { SessionEntity } = await import("@/entities/session.entity");
      const sessionRepo = testDs.getRepository(SessionEntity);
      await sessionRepo.delete(sessionId);
      return false;
    });

    mockCookieStore = { [SESSION_COOKIE_NAME]: token };
    const result = await getSession();

    expect(mockRefreshAzureSession).toHaveBeenCalledWith(
      session.id,
      "azure-refresh-token",
    );
    expect(result).toBeNull();
  });

  // ── Expired credentials session (no refresh token) ────────────

  it("destroys expired credentials session and returns null without calling refreshAzureSession", async () => {
    mockAuthMethod = "credentials";
    const user = await seedUser();
    const { session, token } = await seedSession(user.id, {
      expired: true,
      refreshToken: null,
    });

    mockCookieStore = { [SESSION_COOKIE_NAME]: token };
    const result = await getSession();

    expect(mockRefreshAzureSession).not.toHaveBeenCalled();
    expect(result).toBeNull();

    // Verify session was deleted
    const { SessionEntity } = await import("@/entities/session.entity");
    const sessionRepo = testDs.getRepository(SessionEntity);
    const found = await sessionRepo.findOne({
      where: { id: session.id },
    });
    expect(found).toBeNull();
  });

  // ── Valid (non-expired) Azure session ──────────────────────────

  it("does not call refreshAzureSession for valid (non-expired) Azure session", async () => {
    mockAuthMethod = "azure";
    const user = await seedUser();
    const { token } = await seedSession(user.id, {
      expired: false,
      refreshToken: "azure-refresh-token",
    });

    mockCookieStore = { [SESSION_COOKIE_NAME]: token };
    const result = await getSession();

    expect(mockRefreshAzureSession).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.user.username).toBe("testuser");
  });
});
