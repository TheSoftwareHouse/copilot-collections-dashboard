import { describe, it, expect, vi, afterEach } from "vitest";

// Current date: March 2026 (UTC)
const CURRENT_MONTH = 3;
const CURRENT_YEAR = 2026;

describe("teamMembersBackfillSchema", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getSchema() {
    // Re-import to pick up the real Date (or mocked Date)
    vi.resetModules();
    const mod = await import("../team-members");
    return mod.teamMembersBackfillSchema;
  }

  it("accepts a valid payload with single seat and single-month range", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2026,
      endMonth: 1,
      endYear: 2026,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid payload spanning multiple months", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1, 2, 3],
      startMonth: 10,
      startYear: 2025,
      endMonth: 2,
      endYear: 2026,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid payload where range ends at current month", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2026,
      endMonth: CURRENT_MONTH,
      endYear: CURRENT_YEAR,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty seatIds", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [],
      startMonth: 1,
      startYear: 2026,
      endMonth: 2,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer seatIds", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1.5],
      startMonth: 1,
      startYear: 2026,
      endMonth: 2,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rejects seatIds exceeding max (100)", async () => {
    const schema = await getSchema();
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    const result = schema.safeParse({
      seatIds: ids,
      startMonth: 1,
      startYear: 2026,
      endMonth: 2,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rejects start month > 12", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 13,
      startYear: 2025,
      endMonth: 1,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rejects start month < 1", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 0,
      startYear: 2025,
      endMonth: 1,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rejects start year < 2020", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2019,
      endMonth: 1,
      endYear: 2020,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when start date is after end date (same year, month reversed)", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 3,
      startYear: 2026,
      endMonth: 1,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when start date is after end date (year reversed)", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2026,
      endMonth: 12,
      endYear: 2025,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when end date is in the future", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2026,
      endMonth: CURRENT_MONTH + 1,
      endYear: CURRENT_YEAR,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when end year is in the future", async () => {
    const schema = await getSchema();
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2026,
      endMonth: 1,
      endYear: CURRENT_YEAR + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects range exceeding 24 months", async () => {
    const schema = await getSchema();
    // 25 months: Jan 2024 → Jan 2026
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 1,
      startYear: 2024,
      endMonth: 1,
      endYear: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("accepts range of exactly 24 months", async () => {
    const schema = await getSchema();
    // 24 months: Apr 2024 → Mar 2026
    const result = schema.safeParse({
      seatIds: [1],
      startMonth: 4,
      startYear: 2024,
      endMonth: CURRENT_MONTH,
      endYear: CURRENT_YEAR,
    });
    expect(result.success).toBe(true);
  });
});
