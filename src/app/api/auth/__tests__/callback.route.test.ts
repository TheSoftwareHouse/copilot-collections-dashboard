/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { OAuth2RequestError, ArcticFetchError } from "arctic";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

// Mock auth-config
vi.mock("@/lib/auth-config", () => ({
  getAuthConfig: () => ({
    method: "azure",
    tenantId: "test-tenant-id",
    clientId: "test-client-id",
    redirectUri: "https://app.example.com/api/auth/callback",
  }),
  getAuthMethod: () => "azure",
  shouldUseSecureCookies: () => true,
}));

// Mock pkce-token — verifyPkceToken returns a predictable result
const mockVerifyPkceToken = vi.fn();
vi.mock("@/lib/pkce-token", () => ({
  verifyPkceToken: (...args: unknown[]) => mockVerifyPkceToken(...args),
}));

// Mock Arctic functions
const mockValidateAuthorizationCode = vi.fn();

const defaultIdTokenClaims = {
  sub: "azure-subject-123",
  preferred_username: "testuser@example.com",
  name: "Test User",
  email: "testuser@example.com",
  iss: "https://login.microsoftonline.com/test-tenant-id/v2.0",
  aud: "test-client-id",
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const mockDecodeIdToken = vi.fn().mockReturnValue(defaultIdTokenClaims);

vi.mock("@/lib/azure-auth", async () => {
  const { mapAzureRolesToAppRole } = await import("@/lib/azure-auth");
  return {
    getEntraIdClient: () => ({
      validateAuthorizationCode: mockValidateAuthorizationCode,
    }),
    decodeIdToken: (...args: unknown[]) => mockDecodeIdToken(...args),
    validateIdTokenClaims: vi.fn(),
    mapArcticError: (error: unknown) => {
      if (error instanceof OAuth2RequestError) return "auth_failed";
      if (error instanceof ArcticFetchError) return "provider_unavailable";
      return "auth_failed";
    },
    mapAzureRolesToAppRole,
  };
});

const { GET } = await import("@/app/api/auth/callback/route");

function makeCallbackRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost:3000/api/auth/callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  return new URL(location!);
}

describe("GET /api/auth/callback", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    mockValidateAuthorizationCode.mockReset();
    mockVerifyPkceToken.mockReset();
    mockDecodeIdToken.mockReset();
    mockDecodeIdToken.mockReturnValue(defaultIdTokenClaims);
    // Default: successful PKCE token verification
    mockVerifyPkceToken.mockReturnValue({
      state: "original-state",
      codeVerifier: "test-verifier",
    });
    // Default: successful token exchange
    mockValidateAuthorizationCode.mockResolvedValue({
      idToken: () => "mock-id-token",
      accessToken: () => "mock-access-token",
      refreshToken: () => "mock-refresh-token",
    });
  });

  // ── Successful flow ────────────────────────────────────────────

  it("redirects to /dashboard on successful flow", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/dashboard");
  });

  it("sets session_token cookie on success", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);
    const setCookie = response.headers.get("set-cookie") || "";

    expect(setCookie).toContain("session_token=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/");
  });

  it("creates user in app_user table with correct data", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    await GET(request);

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBe("AZURE_AD_USER");
  });

  it("creates session with refreshToken", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    await GET(request);

    const { SessionEntity } = await import("@/entities/session.entity");
    const sessionRepo = testDs.getRepository(SessionEntity);
    const sessions = await sessionRepo.find();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].refreshToken).toBe("mock-refresh-token");
  });

  it("does not set any PKCE cookies on success", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);
    const setCookie = response.headers.get("set-cookie") || "";

    expect(setCookie).not.toContain("pkce_code_verifier");
    expect(setCookie).not.toContain("pkce_state");
  });

  it("does not create duplicate user on returning login", async () => {
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "testuser@example.com",
      passwordHash: "AZURE_AD_USER",
    });

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    await GET(request);

    const users = await userRepo.find({
      where: { username: "testuser@example.com" },
    });
    expect(users).toHaveLength(1);
  });

  // ── Error paths ────────────────────────────────────────────────

  it("redirects to /login?error=auth_failed when Azure returns error", async () => {
    const request = makeCallbackRequest(
      { error: "access_denied", error_description: "User cancelled" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_failed");
  });

  it("redirects to /login?error=state_mismatch when PKCE token verification fails", async () => {
    mockVerifyPkceToken.mockImplementation(() => {
      throw new Error("Invalid PKCE token signature");
    });

    const request = makeCallbackRequest(
      { code: "valid-code", state: "tampered-token" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("state_mismatch");
  });

  it("redirects to /login?error=state_mismatch when state parameter is missing", async () => {
    const request = makeCallbackRequest(
      { code: "valid-code" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("state_mismatch");
  });

  it("redirects to /login?error=invalid_callback when code is missing", async () => {
    const request = makeCallbackRequest(
      { state: "signed-pkce-token" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("invalid_callback");
  });

  it("redirects to /login?error=auth_failed when validateAuthorizationCode throws OAuth2RequestError", async () => {
    mockValidateAuthorizationCode.mockRejectedValue(
      new OAuth2RequestError("invalid_grant", null, null, null),
    );

    const request = makeCallbackRequest(
      { code: "bad-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_failed");
  });

  it("redirects to /login?error=provider_unavailable when validateAuthorizationCode throws ArcticFetchError", async () => {
    mockValidateAuthorizationCode.mockRejectedValue(
      new ArcticFetchError(new Error("network error")),
    );

    const request = makeCallbackRequest(
      { code: "bad-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("provider_unavailable");
  });

  // ── Roles claim extraction ─────────────────────────────────────

  it("logs Azure App Roles when present in ID token", async () => {
    mockDecodeIdToken.mockReturnValueOnce({
      ...defaultIdTokenClaims,
      roles: ["Admin"],
    });
    const logSpy = vi.spyOn(console, "log");

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(getRedirectLocation(response).pathname).toBe("/dashboard");
    expect(logSpy).toHaveBeenCalledWith(
      "[auth/callback] Azure App Roles from ID token:",
      ["Admin"],
    );
    logSpy.mockRestore();
  });

  it("logs empty array when roles claim is missing from ID token", async () => {
    const logSpy = vi.spyOn(console, "log");

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(getRedirectLocation(response).pathname).toBe("/dashboard");
    expect(logSpy).toHaveBeenCalledWith(
      "[auth/callback] Azure App Roles from ID token:",
      [],
    );
    logSpy.mockRestore();
  });

  it("logs empty array when roles claim is empty array", async () => {
    mockDecodeIdToken.mockReturnValueOnce({
      ...defaultIdTokenClaims,
      roles: [],
    });
    const logSpy = vi.spyOn(console, "log");

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(getRedirectLocation(response).pathname).toBe("/dashboard");
    expect(logSpy).toHaveBeenCalledWith(
      "[auth/callback] Azure App Roles from ID token:",
      [],
    );
    logSpy.mockRestore();
  });

  // ── Role mapping on login ──────────────────────────────────────

  it("assigns admin role to new user when Azure roles contain Admin", async () => {
    mockDecodeIdToken.mockReturnValue({
      ...defaultIdTokenClaims,
      roles: ["Admin"],
    });

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    await GET(request);

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
  });

  it("assigns user role to new user when Azure roles do not contain Admin", async () => {
    mockDecodeIdToken.mockReturnValue({
      ...defaultIdTokenClaims,
      roles: ["Reader"],
    });

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    await GET(request);

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("user");
  });

  it("assigns user role to new user when Azure roles claim is missing", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    await GET(request);

    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("user");
  });

  it("promotes existing user to admin when Admin role added in Azure", async () => {
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "testuser@example.com",
      passwordHash: "AZURE_AD_USER",
      role: "user",
    });

    mockDecodeIdToken.mockReturnValue({
      ...defaultIdTokenClaims,
      roles: ["Admin"],
    });

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    await GET(request);

    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
  });

  it("demotes existing admin to user when Admin role removed in Azure", async () => {
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "testuser@example.com",
      passwordHash: "AZURE_AD_USER",
      role: "admin",
    });

    mockDecodeIdToken.mockReturnValue({
      ...defaultIdTokenClaims,
      roles: [],
    });

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    await GET(request);

    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("user");
  });

  it("preserves admin role for returning admin user", async () => {
    const { UserEntity } = await import("@/entities/user.entity");
    const userRepo = testDs.getRepository(UserEntity);
    await userRepo.save({
      username: "testuser@example.com",
      passwordHash: "AZURE_AD_USER",
      role: "admin",
    });

    mockDecodeIdToken.mockReturnValue({
      ...defaultIdTokenClaims,
      roles: ["Admin"],
    });

    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );
    await GET(request);

    const user = await userRepo.findOne({
      where: { username: "testuser@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
  });
});
