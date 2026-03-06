/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { generateKeyPairSync } from "crypto";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import { GitHubAppEntity, type GitHubApp } from "@/entities/github-app.entity";
import { encrypt } from "@/lib/encryption";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

const { getInstallationToken, NoOrgConnectedError } = await import(
  "@/lib/github-app-token"
);

// Generate a test RSA key pair once for all tests
const { privateKey: testPrivateKeyPem } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

async function seedGitHubApp(
  ds: DataSource,
  overrides: Partial<GitHubApp> = {},
): Promise<void> {
  const repo = ds.getRepository(GitHubAppEntity);
  await repo.save({
    appId: 12345,
    appSlug: "test-app",
    appName: "Test App",
    privateKeyEncrypted: encrypt(testPrivateKeyPem as string),
    webhookSecretEncrypted: encrypt("test-webhook-secret"),
    clientId: "Iv1.abc123",
    clientSecretEncrypted: encrypt("test-client-secret"),
    htmlUrl: "https://github.com/apps/test-app",
    ownerId: 1,
    ownerLogin: "test-org",
    installationId: 99999,
    ...overrides,
  });
}

describe("getInstallationToken", () => {
  beforeAll(async () => {
    process.env.ENCRYPTION_KEY =
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns token when GitHubApp exists with installationId and GitHub API returns 201", async () => {
    await seedGitHubApp(testDs);

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        token: "ghs_test_token_abc123",
        expires_at: "2026-03-08T14:00:00Z",
      }), { status: 201 }),
    );

    const token = await getInstallationToken();

    expect(token).toBe("ghs_test_token_abc123");
  });

  it("calls GitHub API with correct URL, method, and JWT in Authorization header", async () => {
    await seedGitHubApp(testDs);

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        token: "ghs_test_token",
        expires_at: "2026-03-08T14:00:00Z",
      }), { status: 201 }),
    );

    await getInstallationToken();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/99999/access_tokens",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        }),
      }),
    );

    // Authorization header should contain a valid JWT (three dot-separated parts)
    const callOptions = vi.mocked(fetch).mock.calls[0][1]!;
    const authHeader = (callOptions.headers as Record<string, string>).Authorization;
    expect(authHeader).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("throws NoOrgConnectedError when no GitHubApp row exists", async () => {
    // Do not seed any GitHubApp row

    await expect(getInstallationToken()).rejects.toThrow(NoOrgConnectedError);
    await expect(getInstallationToken()).rejects.toThrow(
      /No GitHub App configured/,
    );
  });

  it("throws NoOrgConnectedError when GitHubApp has installationId null", async () => {
    await seedGitHubApp(testDs, { installationId: null });

    await expect(getInstallationToken()).rejects.toThrow(NoOrgConnectedError);
    await expect(getInstallationToken()).rejects.toThrow(
      /not installed on any organisation/,
    );
  });

  it("throws Error (not NoOrgConnectedError) when GitHub API returns 401", async () => {
    await seedGitHubApp(testDs);

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 401 }),
    );

    try {
      await getInstallationToken();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).not.toBeInstanceOf(NoOrgConnectedError);
      expect((error as Error).message).toMatch(/GitHub API returned 401/);
    }
  });

  it("throws Error when GitHub API returns 500", async () => {
    await seedGitHubApp(testDs);

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );

    await expect(getInstallationToken()).rejects.toThrow(
      /GitHub API returned 500/,
    );
  });
});
