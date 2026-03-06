/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";
import { GitHubAppEntity } from "@/entities/github-app.entity";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

const VALID_ENCRYPTION_KEY =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

const mockGitHubResponse = {
  id: 12345,
  slug: "copilot-dashboard-abc123",
  name: "copilot-dashboard-abc123",
  pem: "-----BEGIN RSA PRIVATE KEY-----\nfake-key\n-----END RSA PRIVATE KEY-----",
  webhook_secret: "webhook-secret-value",
  client_id: "Iv1.abc123def456",
  client_secret: "client-secret-value",
  html_url: "https://github.com/apps/copilot-dashboard-abc123",
  owner: {
    id: 99,
    login: "testowner",
  },
};

function makeRequest(body?: unknown): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/github-app/callback", init);
}

const { POST } = await import("@/app/api/github-app/callback/route");

describe("POST /api/github-app/callback", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY;
  });

  afterAll(async () => {
    delete process.env.ENCRYPTION_KEY;
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    vi.restoreAllMocks();
  });

  it("returns 400 for missing code", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for empty code", async () => {
    const response = await POST(makeRequest({ code: "" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for malformed JSON body", async () => {
    const request = new Request(
      "http://localhost:3000/api/github-app/callback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      },
    );
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 201 for valid code exchange", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockGitHubResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(makeRequest({ code: "valid-code" }));
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json).toEqual({
      appName: "copilot-dashboard-abc123",
      appSlug: "copilot-dashboard-abc123",
      htmlUrl: "https://github.com/apps/copilot-dashboard-abc123",
    });
  });

  it("stores credentials encrypted, not as plaintext", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockGitHubResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await POST(makeRequest({ code: "valid-code" }));

    const repo = testDs.getRepository(GitHubAppEntity);
    const stored = await repo.findOne({ where: {} });
    expect(stored).not.toBeNull();
    expect(stored!.privateKeyEncrypted).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(stored!.webhookSecretEncrypted).not.toBe("webhook-secret-value");
    expect(stored!.clientSecretEncrypted).not.toBe("client-secret-value");
    // Encrypted format is base64:base64:base64
    expect(stored!.privateKeyEncrypted.split(":")).toHaveLength(3);
  });

  it("returns 409 when GitHub App already exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockGitHubResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await POST(makeRequest({ code: "first-code" }));

    const response = await POST(makeRequest({ code: "second-code" }));
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("GitHub App already exists");
  });

  it("returns 400 when GitHub API returns 404 (expired/used code)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(makeRequest({ code: "expired-code" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("expired");
  });

  it("returns 422 when GitHub API returns 422 (name conflict)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "Validation Failed" }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await POST(makeRequest({ code: "conflict-code" }));
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error).toContain("name already exists");
  });

  it("returns 502 when GitHub API returns unexpected error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await POST(makeRequest({ code: "some-code" }));
    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toContain("Failed to exchange code");
  });
});
