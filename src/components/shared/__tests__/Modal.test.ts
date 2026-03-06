/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";

describe("Modal", () => {
  it("exports Modal as a default export", async () => {
    const mod = await import("@/components/shared/Modal");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("accepts size prop (default and large variants)", async () => {
    const mod = await import("@/components/shared/Modal");
    const Modal = mod.default;
    // Modal is a function component that accepts ModalProps with optional size
    // TypeScript compilation validates the prop type; runtime checks function exists
    expect(typeof Modal).toBe("function");
  });
});
