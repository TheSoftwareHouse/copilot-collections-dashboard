/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("UsageProgressBar", () => {
  it("exports UsageProgressBar as a named export", async () => {
    const mod = await import("@/components/usage/UsageProgressBar");
    expect(mod.UsageProgressBar).toBeDefined();
    expect(typeof mod.UsageProgressBar).toBe("function");
  });
});
