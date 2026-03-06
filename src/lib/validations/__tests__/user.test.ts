/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";

describe("createUserSchema", () => {
  it("accepts valid input", () => {
    const result = createUserSchema.safeParse({
      username: "newuser",
      password: "securepass",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("newuser");
      expect(result.data.password).toBe("securepass");
    }
  });

  it("trims username whitespace", () => {
    const result = createUserSchema.safeParse({
      username: "  trimmed  ",
      password: "pass",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("trimmed");
    }
  });

  it("rejects empty username", () => {
    const result = createUserSchema.safeParse({
      username: "",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only username", () => {
    const result = createUserSchema.safeParse({
      username: "   ",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = createUserSchema.safeParse({
      username: "user",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized username (>255 chars)", () => {
    const result = createUserSchema.safeParse({
      username: "a".repeat(256),
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("accepts username at exactly 255 chars", () => {
    const result = createUserSchema.safeParse({
      username: "a".repeat(255),
      password: "pass",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing username", () => {
    const result = createUserSchema.safeParse({ password: "pass" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = createUserSchema.safeParse({ username: "user" });
    expect(result.success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = createUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts valid input with only username", () => {
    const result = updateUserSchema.safeParse({ username: "newname" });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with only password", () => {
    const result = updateUserSchema.safeParse({ password: "newpass" });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with both fields", () => {
    const result = updateUserSchema.safeParse({
      username: "newname",
      password: "newpass",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (at least one field required)", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty username string", () => {
    const result = updateUserSchema.safeParse({ username: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only username", () => {
    const result = updateUserSchema.safeParse({ username: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects empty password string", () => {
    const result = updateUserSchema.safeParse({ password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects oversized username (>255 chars)", () => {
    const result = updateUserSchema.safeParse({
      username: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("trims username whitespace", () => {
    const result = updateUserSchema.safeParse({ username: "  trimmed  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("trimmed");
    }
  });
});
