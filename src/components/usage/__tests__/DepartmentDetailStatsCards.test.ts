import { describe, it, expect } from "vitest";

describe("DepartmentDetailStatsCards", () => {
  it("exports a default function component", async () => {
    const mod = await import("../DepartmentDetailStatsCards");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
