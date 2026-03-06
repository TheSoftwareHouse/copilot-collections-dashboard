/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DataSource } from "typeorm";
import { ApiMode } from "@/entities/enums";
import {
  getTestDataSource,
  cleanDatabase,
  destroyTestDataSource,
} from "@/test/db-helpers";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

const { getPremiumAllowance, invalidatePremiumAllowanceCache } = await import("@/lib/get-premium-allowance");

describe("getPremiumAllowance", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  beforeEach(async () => {
    await cleanDatabase(testDs);
    invalidatePremiumAllowanceCache();
  });

  it("returns the configured value when configuration exists", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
      premiumRequestsPerSeat: 500,
    });

    const result = await getPremiumAllowance();
    expect(result).toBe(500);
  });

  it("returns default (300) when no configuration row exists", async () => {
    const result = await getPremiumAllowance();
    expect(result).toBe(300);
  });

  it("returns default (300) when configuration row has the default value", async () => {
    const { ConfigurationEntity } = await import(
      "@/entities/configuration.entity"
    );
    const repo = testDs.getRepository(ConfigurationEntity);
    await repo.save({
      apiMode: ApiMode.ORGANISATION,
      entityName: "TestOrg",
      premiumRequestsPerSeat: 300,
    });

    const result = await getPremiumAllowance();
    expect(result).toBe(300);
  });
});
