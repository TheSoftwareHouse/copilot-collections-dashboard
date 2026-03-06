/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("TeamUsageRankings", () => {
  it("exports a default function component", async () => {
    const mod = await import("@/components/usage/TeamUsageRankings");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
