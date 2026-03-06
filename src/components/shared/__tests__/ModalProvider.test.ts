/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("ModalProvider", () => {
  it("exports ModalProvider as a named export", async () => {
    const mod = await import("@/components/shared/ModalProvider");
    expect(mod.ModalProvider).toBeDefined();
    expect(typeof mod.ModalProvider).toBe("function");
  });

  it("exports useModalContext as a named export", async () => {
    const mod = await import("@/components/shared/ModalProvider");
    expect(mod.useModalContext).toBeDefined();
    expect(typeof mod.useModalContext).toBe("function");
  });
});
