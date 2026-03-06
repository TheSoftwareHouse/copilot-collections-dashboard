/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("auth-config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Strip all auth-related env vars so each test starts clean
    delete process.env.AUTH_METHOD;
    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.AZURE_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadModule() {
    return await import("@/lib/auth-config");
  }

  // ── Credentials (default) ──────────────────────────────────────

  it("defaults to credentials when AUTH_METHOD is not set", async () => {
    const { validateAuthConfig, getAuthConfig } = await loadModule();
    validateAuthConfig();
    expect(getAuthConfig()).toEqual({ method: "credentials" });
  });

  it("returns credentials when AUTH_METHOD='credentials'", async () => {
    process.env.AUTH_METHOD = "credentials";
    const { validateAuthConfig, getAuthConfig } = await loadModule();
    validateAuthConfig();
    expect(getAuthConfig()).toEqual({ method: "credentials" });
  });

  it("defaults to credentials when AUTH_METHOD is empty string", async () => {
    process.env.AUTH_METHOD = "";
    const { validateAuthConfig, getAuthConfig } = await loadModule();
    validateAuthConfig();
    expect(getAuthConfig()).toEqual({ method: "credentials" });
  });

  // ── Azure (valid) ──────────────────────────────────────────────

  it("returns azure config when AUTH_METHOD='azure' with all required vars", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "tenant-123";
    process.env.AZURE_CLIENT_ID = "client-456";
    process.env.AZURE_REDIRECT_URI = "https://app.example.com/api/auth/callback";

    const { validateAuthConfig, getAuthConfig } = await loadModule();
    validateAuthConfig();

    expect(getAuthConfig()).toEqual({
      method: "azure",
      tenantId: "tenant-123",
      clientId: "client-456",
      redirectUri: "https://app.example.com/api/auth/callback",
    });
  });

  // ── Azure (missing vars) ──────────────────────────────────────

  it("throws when AUTH_METHOD='azure' and AZURE_TENANT_ID is missing", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_CLIENT_ID = "client-456";
    process.env.AZURE_REDIRECT_URI = "https://app.example.com/callback";

    const { validateAuthConfig } = await loadModule();
    expect(() => validateAuthConfig()).toThrow("AZURE_TENANT_ID");
  });

  it("throws when AUTH_METHOD='azure' and AZURE_CLIENT_ID is missing", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "tenant-123";
    process.env.AZURE_REDIRECT_URI = "https://app.example.com/callback";

    const { validateAuthConfig } = await loadModule();
    expect(() => validateAuthConfig()).toThrow("AZURE_CLIENT_ID");
  });

  it("throws when AUTH_METHOD='azure' and AZURE_REDIRECT_URI is missing", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "tenant-123";
    process.env.AZURE_CLIENT_ID = "client-456";

    const { validateAuthConfig } = await loadModule();
    expect(() => validateAuthConfig()).toThrow("AZURE_REDIRECT_URI");
  });

  it("throws listing all missing Azure vars when multiple are absent", async () => {
    process.env.AUTH_METHOD = "azure";

    const { validateAuthConfig } = await loadModule();
    expect.assertions(3);

    try {
      validateAuthConfig();
    } catch (e: unknown) {
      const message = (e as Error).message;
      expect(message).toContain("AZURE_TENANT_ID");
      expect(message).toContain("AZURE_CLIENT_ID");
      expect(message).toContain("AZURE_REDIRECT_URI");
    }
  });

  // ── Invalid AUTH_METHOD ────────────────────────────────────────

  it("throws with supported values when AUTH_METHOD is unrecognized", async () => {
    process.env.AUTH_METHOD = "google";

    const { validateAuthConfig } = await loadModule();
    expect(() => validateAuthConfig()).toThrow(/credentials.*azure|azure.*credentials/);
  });

  // ── Invalid AZURE_REDIRECT_URI ─────────────────────────────────

  it("throws when AZURE_REDIRECT_URI is not a valid URL", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "tenant-123";
    process.env.AZURE_CLIENT_ID = "client-456";
    process.env.AZURE_REDIRECT_URI = "not-a-url";

    const { validateAuthConfig } = await loadModule();
    expect(() => validateAuthConfig()).toThrow("AZURE_REDIRECT_URI must be a valid URL");
  });

  // ── getAuthConfig lazy initialisation ───────────────────────

  it("getAuthConfig lazily initialises when validateAuthConfig was not called", async () => {
    const { getAuthConfig } = await loadModule();
    expect(getAuthConfig()).toEqual({ method: "credentials" });
  });

  // ── getAuthMethod ──────────────────────────────────────────────

  it("getAuthMethod returns the active authentication method", async () => {
    process.env.AUTH_METHOD = "credentials";
    const { validateAuthConfig, getAuthMethod } = await loadModule();
    validateAuthConfig();
    expect(getAuthMethod()).toBe("credentials");
  });

  // ── shouldUseSecureCookies ─────────────────────────────────────

  it("shouldUseSecureCookies returns true when AZURE_REDIRECT_URI uses https", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "tenant-123";
    process.env.AZURE_CLIENT_ID = "client-456";
    process.env.AZURE_REDIRECT_URI = "https://app.example.com/api/auth/callback";

    const { validateAuthConfig, shouldUseSecureCookies } = await loadModule();
    validateAuthConfig();
    expect(shouldUseSecureCookies()).toBe(true);
  });

  it("shouldUseSecureCookies returns false when AZURE_REDIRECT_URI uses http", async () => {
    process.env.AUTH_METHOD = "azure";
    process.env.AZURE_TENANT_ID = "tenant-123";
    process.env.AZURE_CLIENT_ID = "client-456";
    process.env.AZURE_REDIRECT_URI = "http://localhost:3000/api/auth/callback";

    const { validateAuthConfig, shouldUseSecureCookies } = await loadModule();
    validateAuthConfig();
    expect(shouldUseSecureCookies()).toBe(false);
  });

  it("shouldUseSecureCookies falls back to NODE_ENV for credentials auth", async () => {
    process.env.AUTH_METHOD = "credentials";

    const { validateAuthConfig, shouldUseSecureCookies } = await loadModule();
    validateAuthConfig();
    // NODE_ENV is "test" in vitest, so should return false
    expect(shouldUseSecureCookies()).toBe(false);
  });
});
