import { describe, it, expect } from "vitest";
import { createDepartmentSchema, updateDepartmentSchema } from "../department";

describe("createDepartmentSchema", () => {
  it("accepts a valid name", () => {
    const result = createDepartmentSchema.safeParse({ name: "Engineering" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Engineering");
    }
  });

  it("trims whitespace from name", () => {
    const result = createDepartmentSchema.safeParse({ name: "  Padded  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Padded");
    }
  });

  it("rejects empty name", () => {
    const result = createDepartmentSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = createDepartmentSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = createDepartmentSchema.safeParse({ name: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("accepts name of exactly 255 characters", () => {
    const result = createDepartmentSchema.safeParse({ name: "a".repeat(255) });
    expect(result.success).toBe(true);
  });

  it("rejects missing name field", () => {
    const result = createDepartmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-string name", () => {
    const result = createDepartmentSchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });
});

describe("updateDepartmentSchema", () => {
  it("accepts a valid name", () => {
    const result = updateDepartmentSchema.safeParse({ name: "Marketing" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Marketing");
    }
  });

  it("trims whitespace from name", () => {
    const result = updateDepartmentSchema.safeParse({ name: "  Trimmed  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Trimmed");
    }
  });

  it("rejects empty name", () => {
    const result = updateDepartmentSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = updateDepartmentSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 255 characters", () => {
    const result = updateDepartmentSchema.safeParse({ name: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects missing name field", () => {
    const result = updateDepartmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
