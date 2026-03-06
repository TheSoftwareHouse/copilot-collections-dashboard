/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { updateSeatSchema } from "@/lib/validations/seat";

describe("updateSeatSchema", () => {
  it("accepts valid input with all three fields", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "Octo",
      lastName: "Cat",
      department: "Engineering",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Octo");
      expect(result.data.lastName).toBe("Cat");
      expect(result.data.department).toBe("Engineering");
    }
  });

  it("accepts partial input — only firstName", () => {
    const result = updateSeatSchema.safeParse({ firstName: "Alice" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Alice");
      expect(result.data.lastName).toBeUndefined();
      expect(result.data.department).toBeUndefined();
    }
  });

  it("accepts partial input — only lastName", () => {
    const result = updateSeatSchema.safeParse({ lastName: "Smith" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastName).toBe("Smith");
    }
  });

  it("accepts partial input — only department", () => {
    const result = updateSeatSchema.safeParse({ department: "Product" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.department).toBe("Product");
    }
  });

  it("trims whitespace from string values", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "  Alice  ",
      lastName: "  Smith  ",
      department: "  Engineering  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Alice");
      expect(result.data.lastName).toBe("Smith");
      expect(result.data.department).toBe("Engineering");
    }
  });

  it("coerces empty string to null", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "",
      lastName: "",
      department: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBeNull();
      expect(result.data.lastName).toBeNull();
      expect(result.data.department).toBeNull();
    }
  });

  it("coerces whitespace-only string to null", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "   ",
      lastName: "   ",
      department: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBeNull();
      expect(result.data.lastName).toBeNull();
      expect(result.data.department).toBeNull();
    }
  });

  it("accepts explicit null values", () => {
    const result = updateSeatSchema.safeParse({
      firstName: null,
      lastName: null,
      department: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBeNull();
      expect(result.data.lastName).toBeNull();
      expect(result.data.department).toBeNull();
    }
  });

  it("rejects firstName exceeding 255 characters", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects lastName exceeding 255 characters", () => {
    const result = updateSeatSchema.safeParse({
      lastName: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects department exceeding 255 characters", () => {
    const result = updateSeatSchema.safeParse({
      department: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts fields at exactly 255 characters", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "a".repeat(255),
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (no fields provided)", () => {
    const result = updateSeatSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("ignores extra/unknown fields", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "Alice",
      githubUsername: "should-be-ignored",
      status: "active",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Alice");
      expect(result.data).not.toHaveProperty("githubUsername");
      expect(result.data).not.toHaveProperty("status");
    }
  });

  // departmentId tests
  it("accepts departmentId as a positive integer", () => {
    const result = updateSeatSchema.safeParse({ departmentId: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.departmentId).toBe(5);
    }
  });

  it("accepts departmentId as null (clear assignment)", () => {
    const result = updateSeatSchema.safeParse({ departmentId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.departmentId).toBeNull();
    }
  });

  it("rejects departmentId as a string", () => {
    const result = updateSeatSchema.safeParse({ departmentId: "five" });
    expect(result.success).toBe(false);
  });

  it("rejects departmentId as a negative number", () => {
    const result = updateSeatSchema.safeParse({ departmentId: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects departmentId as a float", () => {
    const result = updateSeatSchema.safeParse({ departmentId: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects departmentId as zero", () => {
    const result = updateSeatSchema.safeParse({ departmentId: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts departmentId alongside firstName and lastName", () => {
    const result = updateSeatSchema.safeParse({
      firstName: "Octo",
      lastName: "Cat",
      departmentId: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Octo");
      expect(result.data.lastName).toBe("Cat");
      expect(result.data.departmentId).toBe(3);
    }
  });
});
