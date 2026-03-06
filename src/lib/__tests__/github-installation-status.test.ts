import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeyPairSync } from "crypto";
import { checkInstallationStatus } from "@/lib/github-installation-status";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const TEST_APP_ID = 12345;
const TEST_INSTALLATION_ID = 55555;

describe("checkInstallationStatus", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns active when GitHub API returns 200 with suspended_at null", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: TEST_INSTALLATION_ID, suspended_at: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await checkInstallationStatus(
      TEST_APP_ID,
      privateKey,
      TEST_INSTALLATION_ID,
    );

    expect(result).toEqual({ status: "active" });
  });

  it("returns suspended with suspendedAt and statusMessage when suspended_at is set", async () => {
    const suspendedAt = "2026-03-01T00:00:00Z";
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: TEST_INSTALLATION_ID,
          suspended_at: suspendedAt,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await checkInstallationStatus(
      TEST_APP_ID,
      privateKey,
      TEST_INSTALLATION_ID,
    );

    expect(result.status).toBe("suspended");
    expect(result.suspendedAt).toBe(suspendedAt);
    expect(result.statusMessage).toBeDefined();
  });

  it("returns revoked with statusMessage when GitHub API returns 404", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkInstallationStatus(
      TEST_APP_ID,
      privateKey,
      TEST_INSTALLATION_ID,
    );

    expect(result.status).toBe("revoked");
    expect(result.statusMessage).toBeDefined();
  });

  it("returns unknown with statusMessage when GitHub API returns 401", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkInstallationStatus(
      TEST_APP_ID,
      privateKey,
      TEST_INSTALLATION_ID,
    );

    expect(result.status).toBe("unknown");
    expect(result.statusMessage).toContain("credentials");
  });

  it("returns unknown with statusMessage when GitHub API returns 500", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Internal Server Error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await checkInstallationStatus(
      TEST_APP_ID,
      privateKey,
      TEST_INSTALLATION_ID,
    );

    expect(result.status).toBe("unknown");
    expect(result.statusMessage).toBeDefined();
  });

  it("returns unknown with statusMessage when fetch throws a network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await checkInstallationStatus(
      TEST_APP_ID,
      privateKey,
      TEST_INSTALLATION_ID,
    );

    expect(result.status).toBe("unknown");
    expect(result.statusMessage).toBeDefined();
  });
});
