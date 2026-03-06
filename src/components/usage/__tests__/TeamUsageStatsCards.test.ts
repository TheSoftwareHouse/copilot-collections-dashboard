/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("TeamUsageStatsCards", () => {
  it("exports TeamUsageStatsCards as a default export", async () => {
    const mod = await import("@/components/usage/TeamUsageStatsCards");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
