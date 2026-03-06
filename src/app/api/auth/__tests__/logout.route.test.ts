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

// Controllable auth method mock
let mockAuthMethod: "credentials" | "azure" = "credentials";
vi.mock("@/lib/auth-config", () => ({
  getAuthMethod: () => mockAuthMethod,
  shouldUseSecureCookies: () => false,
}));

// Mock the dynamic import of azure-auth for Azure logout URL
vi.mock("@/lib/azure-auth", () => ({
  getAzureLogoutUrl: () =>
    "https://login.microsoftonline.com/test-tenant/oauth2/v2.0/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin",
}));

const { POST } = await import("@/app/api/auth/logout/route");
const { hashPassword, createSession, SESSION_COOKIE_NAME } = await import(
  "@/lib/auth"
);

describe("POST /api/auth/logout", () => {
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

  it("returns 200 and clears session from DB on valid logout", async () => {
    // Create a user and session
    const { UserEntity } = await import("@/entities/user.entity");
    const { SessionEntity } = await import("@/entities/session.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const sessionRepo = testDs.getRepository(SessionEntity);

    const user = await userRepo.save({
      username: "admin",
      passwordHash: await hashPassword("password"),
    });

    const token = await createSession(user.id);
    mockCookieStore[SESSION_COOKIE_NAME] = token;

    const response = await POST();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);

    // Verify session is deleted from DB
    const sessions = await sessionRepo.find();
    expect(sessions).toHaveLength(0);

    // Verify cookie is cleared
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("session_token=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 200 even when no session exists (idempotent)", async () => {
    const response = await POST();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("returns 200 when cookie contains an invalid token", async () => {
    mockCookieStore[SESSION_COOKIE_NAME] = "nonexistent-token";

    const response = await POST();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("does not include azureLogoutUrl when AUTH_METHOD=credentials", async () => {
    const response = await POST();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.azureLogoutUrl).toBeUndefined();
  });

  it("includes azureLogoutUrl when AUTH_METHOD=azure", async () => {
    mockAuthMethod = "azure";

    const response = await POST();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.azureLogoutUrl).toContain(
      "https://login.microsoftonline.com/",
    );
  });

  it("destroys session and includes azureLogoutUrl when AUTH_METHOD=azure", async () => {
    mockAuthMethod = "azure";

    const { UserEntity } = await import("@/entities/user.entity");
    const { SessionEntity } = await import("@/entities/session.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const sessionRepo = testDs.getRepository(SessionEntity);

    const user = await userRepo.save({
      username: "azure-user",
      passwordHash: "AZURE_AD_USER",
    });

    const token = await createSession(user.id);
    mockCookieStore[SESSION_COOKIE_NAME] = token;

    const response = await POST();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.azureLogoutUrl).toContain(
      "https://login.microsoftonline.com/",
    );

    // Verify session is deleted from DB
    const sessions = await sessionRepo.find();
    expect(sessions).toHaveLength(0);
  });
});
