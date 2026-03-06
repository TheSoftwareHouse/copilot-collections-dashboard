/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("UsageStatusIndicator", () => {
  it("exports UsageStatusIndicator as a named export", async () => {
    const mod = await import("@/components/usage/UsageStatusIndicator");
    expect(mod.UsageStatusIndicator).toBeDefined();
    expect(typeof mod.UsageStatusIndicator).toBe("function");
  });
});
