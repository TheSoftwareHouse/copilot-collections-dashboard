/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

// Mock getAuthConfig
let mockAuthConfig: { method: string; tenantId?: string; clientId?: string; redirectUri?: string } = {
  method: "azure",
  tenantId: "test-tenant-id",
  clientId: "test-client-id",
  redirectUri: "https://app.example.com/api/auth/callback",
};

vi.mock("@/lib/auth-config", () => ({
  getAuthConfig: () => mockAuthConfig,
  getAuthMethod: () => mockAuthConfig.method,
}));

// Mock Arctic functions
const mockCreateAuthorizationURL = vi.fn().mockReturnValue(
  new URL("https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize?client_id=test-client-id"),
);

vi.mock("@/lib/azure-auth", () => ({
  getEntraIdClient: () => ({
    createAuthorizationURL: mockCreateAuthorizationURL,
  }),
  generateState: () => "mock-state-value",
  generateCodeVerifier: () => "mock-code-verifier",
  AZURE_SCOPES: ["openid", "profile", "email", "offline_access"],
}));

vi.mock("@/lib/pkce-token", () => ({
  createPkceToken: (state: string, codeVerifier: string) => `token:${state}:${codeVerifier}`,
}));

const { GET } = await import("@/app/api/auth/azure/route");

describe("GET /api/auth/azure", () => {
  beforeEach(() => {
    mockAuthConfig = {
      method: "azure",
      tenantId: "test-tenant-id",
      clientId: "test-client-id",
      redirectUri: "https://app.example.com/api/auth/callback",
    };
    mockCreateAuthorizationURL.mockClear();
    mockCreateAuthorizationURL.mockReturnValue(
      new URL("https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/authorize?client_id=test-client-id"),
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 302 redirect to Azure when AUTH_METHOD=azure", async () => {
    const response = await GET();

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("https://login.microsoftonline.com/");
  });

  it("passes PKCE token as state parameter to createAuthorizationURL", async () => {
    await GET();

    expect(mockCreateAuthorizationURL).toHaveBeenCalledWith(
      "token:mock-state-value:mock-code-verifier",
      "mock-code-verifier",
      ["openid", "profile", "email", "offline_access"],
    );
  });

  it("does not set any cookies", async () => {
    const response = await GET();
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeNull();
  });

  it("returns 404 when AUTH_METHOD=credentials", async () => {
    mockAuthConfig = { method: "credentials" };

    const response = await GET();

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Azure authentication is not configured");
  });
});
