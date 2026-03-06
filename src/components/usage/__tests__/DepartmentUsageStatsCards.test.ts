/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("DepartmentUsageStatsCards", () => {
  it("exports DepartmentUsageStatsCards as a default export", async () => {
    const mod = await import("@/components/usage/DepartmentUsageStatsCards");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
