/// <reference types="vitest/globals" />
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DataSource } from "typeorm";
import {
  getTestDataSource,
  destroyTestDataSource,
} from "@/test/db-helpers";

let testDs: DataSource;

vi.mock("@/lib/db", () => ({
  getDb: async () => testDs,
}));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  beforeAll(async () => {
    testDs = await getTestDataSource();
  });

  afterAll(async () => {
    await destroyTestDataSource();
  });

  it("returns 200 with status ok when database is reachable", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns 503 with status unhealthy when database is unreachable", async () => {
    // Destroy the connection so the query fails
    await testDs.destroy();

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body).toEqual({ status: "unhealthy" });

    // Restore connection for afterAll cleanup
    testDs = await getTestDataSource();
  });

  it("does not expose sensitive information in unhealthy response", async () => {
    await testDs.destroy();

    const response = await GET();
    const body = await response.json();

    // Should not contain any error details, connection strings, or stack traces
    expect(body).toEqual({ status: "unhealthy" });
    expect(body.error).toBeUndefined();
    expect(body.stack).toBeUndefined();
    expect(body.message).toBeUndefined();

    // Restore connection
    testDs = await getTestDataSource();
  });

  it("does not require authentication", async () => {
    // No cookies or auth headers set — should still work
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
