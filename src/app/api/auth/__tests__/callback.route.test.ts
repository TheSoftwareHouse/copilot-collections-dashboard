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

vi.mock("@/lib/azure-auth", () => ({
  getEntraIdClient: () => ({
    validateAuthorizationCode: mockValidateAuthorizationCode,
  }),
  decodeIdToken: () => ({
    sub: "azure-subject-123",
    preferred_username: "testuser@example.com",
    name: "Test User",
    email: "testuser@example.com",
    iss: "https://login.microsoftonline.com/test-tenant-id/v2.0",
    aud: "test-client-id",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  validateIdTokenClaims: vi.fn(),
  mapArcticError: (error: unknown) => {
    if (error instanceof OAuth2RequestError) return "auth_failed";
    if (error instanceof ArcticFetchError) return "provider_unavailable";
    return "auth_failed";
  },
}));

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

  it("returns HTML page that redirects to /dashboard on successful flow", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("/dashboard");
    expect(body).toContain('meta http-equiv="refresh"');
  });

  it("sets session_token cookie on success", async () => {
    const request = makeCallbackRequest(
      { code: "valid-auth-code", state: "signed-pkce-token" },
    );

    const response = await GET(request);
    const setCookie = response.headers.get("set-cookie") || "";

    expect(setCookie).toContain("session_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
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
});
