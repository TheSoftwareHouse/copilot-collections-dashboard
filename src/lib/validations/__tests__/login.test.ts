/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { loginSchema } from "@/lib/validations/login";

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "secret123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("admin");
      expect(result.data.password).toBe("secret123");
    }
  });

  it("trims whitespace from username", () => {
    const result = loginSchema.safeParse({
      username: "  admin  ",
      password: "secret123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("admin");
    }
  });

  it("does not trim password (preserves leading/trailing spaces)", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "  secret  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe("  secret  ");
    }
  });

  it("rejects empty username", () => {
    const result = loginSchema.safeParse({
      username: "",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only username", () => {
    const result = loginSchema.safeParse({
      username: "   ",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      username: "admin",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username over 255 characters", () => {
    const result = loginSchema.safeParse({
      username: "a".repeat(256),
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts username at exactly 255 characters", () => {
    const result = loginSchema.safeParse({
      username: "a".repeat(255),
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing username field", () => {
    const result = loginSchema.safeParse({
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing password field", () => {
    const result = loginSchema.safeParse({
      username: "admin",
    });
    expect(result.success).toBe(false);
  });
});
