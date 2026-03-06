/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { configurationSchema } from "@/lib/validations/configuration";

describe("configurationSchema", () => {
  it("accepts valid organisation input", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "TheSoftwareHouse",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiMode).toBe("organisation");
      expect(result.data.entityName).toBe("TheSoftwareHouse");
    }
  });

  it("accepts valid enterprise input", () => {
    const result = configurationSchema.safeParse({
      apiMode: "enterprise",
      entityName: "AcmeCorp",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiMode).toBe("enterprise");
      expect(result.data.entityName).toBe("AcmeCorp");
    }
  });

  it("trims whitespace from entityName", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "  SpacedName  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityName).toBe("SpacedName");
    }
  });

  it("rejects invalid apiMode", () => {
    const result = configurationSchema.safeParse({
      apiMode: "invalid",
      entityName: "TestOrg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty entityName", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only entityName", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects entityName over 255 characters", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts entityName at exactly 255 characters", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "a".repeat(255),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing apiMode", () => {
    const result = configurationSchema.safeParse({
      entityName: "TestOrg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityName", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid premiumRequestsPerSeat values", () => {
    for (const value of [1, 300, 100000]) {
      const result = configurationSchema.safeParse({
        apiMode: "organisation",
        entityName: "TestOrg",
        premiumRequestsPerSeat: value,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid premiumRequestsPerSeat values", () => {
    for (const value of [0, -1, 1.5, 100001]) {
      const result = configurationSchema.safeParse({
        apiMode: "organisation",
        entityName: "TestOrg",
        premiumRequestsPerSeat: value,
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects non-numeric premiumRequestsPerSeat", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "TestOrg",
      premiumRequestsPerSeat: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts payload without premiumRequestsPerSeat (optional)", () => {
    const result = configurationSchema.safeParse({
      apiMode: "organisation",
      entityName: "TestOrg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.premiumRequestsPerSeat).toBeUndefined();
    }
  });
});
