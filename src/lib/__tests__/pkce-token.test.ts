/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { createPkceToken, verifyPkceToken } from "@/lib/pkce-token";

describe("pkce-token", () => {
  it("round-trips state and codeVerifier", () => {
    const token = createPkceToken("test-state", "test-verifier");
    const result = verifyPkceToken(token);

    expect(result.state).toBe("test-state");
    expect(result.codeVerifier).toBe("test-verifier");
  });

  it("returns a string with two dot-separated parts", () => {
    const token = createPkceToken("s", "v");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("throws on tampered payload", () => {
    const token = createPkceToken("state", "verifier");
    const [, sig] = token.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ state: "evil", codeVerifier: "evil", exp: 9999999999 })).toString("base64url")}.${sig}`;

    expect(() => verifyPkceToken(tampered)).toThrow("signature");
  });

  it("throws on tampered signature", () => {
    const token = createPkceToken("state", "verifier");
    const [payload] = token.split(".");
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    expect(() => verifyPkceToken(tampered)).toThrow("signature");
  });

  it("throws on malformed token (no dot separator)", () => {
    expect(() => verifyPkceToken("no-dot-here")).toThrow("Malformed");
  });

  it("throws on expired token", () => {
    // Manually build an expired token by mocking Date
    const originalNow = Date.now;
    try {
      // Create token "in the past"
      Date.now = () => new Date("2020-01-01").getTime();
      const token = createPkceToken("state", "verifier");

      // Verify "now" — token should be expired
      Date.now = originalNow;
      expect(() => verifyPkceToken(token)).toThrow("expired");
    } finally {
      Date.now = originalNow;
    }
  });

  it("throws on empty string", () => {
    expect(() => verifyPkceToken("")).toThrow();
  });
});
