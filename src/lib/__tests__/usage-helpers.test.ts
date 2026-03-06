/// <reference types="vitest/globals" />
import { describe, it, expect } from "vitest";
import { getUsageColour, calcUsagePercent, getAllowanceThresholdColor, calcAllowanceTrend, getBarHexColor } from "@/lib/usage-helpers";

describe("getUsageColour", () => {
  it("returns red for 0%", () => {
    const result = getUsageColour(0);
    expect(result).toEqual({ bgClass: "bg-red-500", label: "Low usage" });
  });

  it("returns red for 49.9%", () => {
    const result = getUsageColour(49.9);
    expect(result).toEqual({ bgClass: "bg-red-500", label: "Low usage" });
  });

  it("returns orange for 50%", () => {
    const result = getUsageColour(50);
    expect(result).toEqual({ bgClass: "bg-orange-500", label: "Moderate usage" });
  });

  it("returns orange for 89.9%", () => {
    const result = getUsageColour(89.9);
    expect(result).toEqual({ bgClass: "bg-orange-500", label: "Moderate usage" });
  });

  it("returns green for 90%", () => {
    const result = getUsageColour(90);
    expect(result).toEqual({ bgClass: "bg-green-500", label: "High usage" });
  });

  it("returns green for 100%", () => {
    const result = getUsageColour(100);
    expect(result).toEqual({ bgClass: "bg-green-500", label: "High usage" });
  });

  it("returns green for 150% (over 100%)", () => {
    const result = getUsageColour(150);
    expect(result).toEqual({ bgClass: "bg-green-500", label: "High usage" });
  });
});

describe("getBarHexColor", () => {
  it("returns red hex for 0%", () => {
    expect(getBarHexColor(0)).toBe("#ef4444");
  });

  it("returns red hex for 49.9%", () => {
    expect(getBarHexColor(49.9)).toBe("#ef4444");
  });

  it("returns orange hex for 50%", () => {
    expect(getBarHexColor(50)).toBe("#f97316");
  });

  it("returns orange hex for 89.9%", () => {
    expect(getBarHexColor(89.9)).toBe("#f97316");
  });

  it("returns green hex for 90%", () => {
    expect(getBarHexColor(90)).toBe("#22c55e");
  });

  it("returns green hex for 100%", () => {
    expect(getBarHexColor(100)).toBe("#22c55e");
  });

  it("returns green hex for 150%", () => {
    expect(getBarHexColor(150)).toBe("#22c55e");
  });
});

describe("calcUsagePercent", () => {
  it("calculates correct percentage", () => {
    expect(calcUsagePercent(150, 300)).toBe(50);
  });

  it("returns 0 when allowance is 0", () => {
    expect(calcUsagePercent(100, 0)).toBe(0);
  });

  it("calculates above 100%", () => {
    expect(calcUsagePercent(450, 300)).toBe(150);
  });

  it("returns 0 when totalRequests is 0", () => {
    expect(calcUsagePercent(0, 300)).toBe(0);
  });
});

describe("getAllowanceThresholdColor", () => {
  it("returns green for 0%", () => {
    expect(getAllowanceThresholdColor(0)).toEqual({ colorClass: "text-green-600", label: "Within limit" });
  });

  it("returns green for 79.9%", () => {
    expect(getAllowanceThresholdColor(79.9)).toEqual({ colorClass: "text-green-600", label: "Within limit" });
  });

  it("returns amber for 80%", () => {
    expect(getAllowanceThresholdColor(80)).toEqual({ colorClass: "text-amber-600", label: "Approaching limit" });
  });

  it("returns amber for 100%", () => {
    expect(getAllowanceThresholdColor(100)).toEqual({ colorClass: "text-amber-600", label: "Approaching limit" });
  });

  it("returns red for 100.1%", () => {
    expect(getAllowanceThresholdColor(100.1)).toEqual({ colorClass: "text-red-600", label: "Over limit" });
  });

  it("returns red for 150%", () => {
    expect(getAllowanceThresholdColor(150)).toEqual({ colorClass: "text-red-600", label: "Over limit" });
  });
});

describe("calcAllowanceTrend", () => {
  it("returns increase arrow and red for positive delta", () => {
    expect(calcAllowanceTrend(83, 60)).toEqual({
      arrow: "↑", delta: 23, colorClass: "text-green-600", label: "Increased usage",
    });
  });

  it("returns decrease arrow and green for negative delta", () => {
    expect(calcAllowanceTrend(60, 83)).toEqual({
      arrow: "↓", delta: 23, colorClass: "text-red-600", label: "Decreased usage",
    });
  });

  it("returns no-change indicator for zero delta", () => {
    expect(calcAllowanceTrend(75, 75)).toEqual({
      arrow: "—", delta: 0, colorClass: "text-gray-500", label: "No change",
    });
  });

  it("handles large increase from 0% to 120%", () => {
    expect(calcAllowanceTrend(120, 0)).toEqual({
      arrow: "↑", delta: 120, colorClass: "text-green-600", label: "Increased usage",
    });
  });

  it("rounds fractional delta to nearest integer", () => {
    // 83.3 - 82.7 = 0.6 → rounds to 1
    expect(calcAllowanceTrend(83.3, 82.7)).toEqual({
      arrow: "↑", delta: 1, colorClass: "text-green-600", label: "Increased usage",
    });
  });
});
