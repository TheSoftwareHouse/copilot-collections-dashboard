/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("SeatUsageStatsCards", () => {
  it("exports SeatUsageStatsCards as a default export", async () => {
    const mod = await import("@/components/usage/SeatUsageStatsCards");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
