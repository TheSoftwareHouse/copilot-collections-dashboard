/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OAuth2RequestError, ArcticFetchError, MicrosoftEntraId } from "arctic";

describe("azure-auth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.AUTH_METHOD;
    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.AZURE_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function setAzureEnv() {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "test-tenant-id";
    process.env.AZURE_CLIENT_ID = "test-client-id";
    process.env.AZURE_REDIRECT_URI = "https://app.example.com/api/auth/callback";
  }

  async function loadModule() {
    return await import("@/lib/azure-auth");
  }

  // ── getEntraIdClient() ─────────────────────────────────────────

  describe("getEntraIdClient()", () => {
    it("returns a MicrosoftEntraId instance when auth method is azure", async () => {
      setAzureEnv();
      const { getEntraIdClient, _resetEntraIdClient } = await loadModule();
      _resetEntraIdClient();

      const client = getEntraIdClient();
      expect(client).toBeInstanceOf(MicrosoftEntraId);
    });

    it("throws when auth method is credentials", async () => {
      process.env.AUTH_METHOD = "credentials";
      const { getEntraIdClient, _resetEntraIdClient } = await loadModule();
      _resetEntraIdClient();

      expect(() => getEntraIdClient()).toThrow(
        "Azure Entra ID client is not available: AUTH_METHOD is not 'azure'",
      );
    });

    it("returns the same instance on subsequent calls (singleton)", async () => {
      setAzureEnv();
      const { getEntraIdClient, _resetEntraIdClient } = await loadModule();
      _resetEntraIdClient();

      const first = getEntraIdClient();
      const second = getEntraIdClient();
      expect(first).toBe(second);
    });
  });

  // ── validateIdTokenClaims() ────────────────────────────────────

  describe("validateIdTokenClaims()", () => {
    const config = { tenantId: "test-tenant-id", clientId: "test-client-id" };

    it("passes for valid claims", async () => {
      setAzureEnv();
      const { validateIdTokenClaims } = await loadModule();

      expect(() =>
        validateIdTokenClaims(
          {
            iss: "https://login.microsoftonline.com/test-tenant-id/v2.0",
            aud: "test-client-id",
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
          config,
        ),
      ).not.toThrow();
    });

    it("throws for wrong issuer", async () => {
      setAzureEnv();
      const { validateIdTokenClaims } = await loadModule();

      expect(() =>
        validateIdTokenClaims(
          {
            iss: "https://login.microsoftonline.com/wrong-tenant/v2.0",
            aud: "test-client-id",
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
          config,
        ),
      ).toThrow("Invalid issuer");
    });

    it("throws for wrong audience", async () => {
      setAzureEnv();
      const { validateIdTokenClaims } = await loadModule();

      expect(() =>
        validateIdTokenClaims(
          {
            iss: "https://login.microsoftonline.com/test-tenant-id/v2.0",
            aud: "wrong-client-id",
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
          config,
        ),
      ).toThrow("Invalid audience");
    });

    it("throws for expired token", async () => {
      setAzureEnv();
      const { validateIdTokenClaims } = await loadModule();

      expect(() =>
        validateIdTokenClaims(
          {
            iss: "https://login.microsoftonline.com/test-tenant-id/v2.0",
            aud: "test-client-id",
            exp: Math.floor(Date.now() / 1000) - 60,
          },
          config,
        ),
      ).toThrow("ID token has expired");
    });
  });

  // ── mapArcticError() ───────────────────────────────────────────

  describe("mapArcticError()", () => {
    it("maps OAuth2RequestError to 'auth_failed'", async () => {
      setAzureEnv();
      const { mapArcticError } = await loadModule();

      const error = new OAuth2RequestError("invalid_grant", null, null, null);
      expect(mapArcticError(error)).toBe("auth_failed");
    });

    it("maps ArcticFetchError to 'provider_unavailable'", async () => {
      setAzureEnv();
      const { mapArcticError } = await loadModule();

      const error = new ArcticFetchError(new Error("network error"));
      expect(mapArcticError(error)).toBe("provider_unavailable");
    });

    it("maps unknown errors to 'auth_failed'", async () => {
      setAzureEnv();
      const { mapArcticError } = await loadModule();

      expect(mapArcticError(new Error("unexpected"))).toBe("auth_failed");
      expect(mapArcticError("string error")).toBe("auth_failed");
    });
  });

  // ── AZURE_SCOPES ──────────────────────────────────────────────

  describe("AZURE_SCOPES", () => {
    it("contains openid, profile, email, offline_access", async () => {
      setAzureEnv();
      const { AZURE_SCOPES } = await loadModule();

      expect(AZURE_SCOPES).toContain("openid");
      expect(AZURE_SCOPES).toContain("profile");
      expect(AZURE_SCOPES).toContain("email");
      expect(AZURE_SCOPES).toContain("offline_access");
    });
  });

  // ── getAzureLogoutUrl() ────────────────────────────────────────

  describe("getAzureLogoutUrl()", () => {
    it("returns URL starting with the Azure logout endpoint for the tenant", async () => {
      setAzureEnv();
      const { getAzureLogoutUrl } = await loadModule();

      const url = getAzureLogoutUrl();
      expect(url).toContain(
        "https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/logout",
      );
    });

    it("contains post_logout_redirect_uri derived from AZURE_REDIRECT_URI (https)", async () => {
      setAzureEnv();
      const { getAzureLogoutUrl } = await loadModule();

      const url = new URL(getAzureLogoutUrl());
      const postLogoutUri = url.searchParams.get("post_logout_redirect_uri");
      expect(postLogoutUri).toBe("https://app.example.com/login");
    });

    it("derives login URL from localhost AZURE_REDIRECT_URI", async () => {
      setAzureEnv();
      process.env.AZURE_REDIRECT_URI = "http://localhost:3001/api/auth/callback";
      const { getAzureLogoutUrl } = await loadModule();

      const url = new URL(getAzureLogoutUrl());
      const postLogoutUri = url.searchParams.get("post_logout_redirect_uri");
      expect(postLogoutUri).toBe("http://localhost:3001/login");
    });

    it("throws when auth method is credentials", async () => {
      process.env.AUTH_METHOD = "credentials";
      const { getAzureLogoutUrl } = await loadModule();

      expect(() => getAzureLogoutUrl()).toThrow(
        "Azure logout URL is not available: AUTH_METHOD is not 'azure'",
      );
    });
  });

  // ── mapAzureRolesToAppRole() ───────────────────────────────────

  describe("mapAzureRolesToAppRole()", () => {
    it("returns ADMIN when roles contains 'Admin'", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole(["Admin"])).toBe("admin");
    });

    it("returns ADMIN when 'Admin' is among multiple roles", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole(["Admin", "Reader"])).toBe("admin");
    });

    it("returns USER when roles do not contain 'Admin'", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole(["User"])).toBe("user");
    });

    it("returns ADMIN for lowercase 'admin' (case-insensitive)", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole(["admin"])).toBe("admin");
    });

    it("returns ADMIN for mixed case 'ADMIN' (case-insensitive)", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole(["ADMIN"])).toBe("admin");
    });

    it("returns USER when roles is empty array", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole([])).toBe("user");
    });

    it("returns USER when roles is undefined", async () => {
      const { mapAzureRolesToAppRole } = await loadModule();
      expect(mapAzureRolesToAppRole(undefined)).toBe("user");
    });
  });
});
