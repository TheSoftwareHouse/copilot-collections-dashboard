import type { MemberEntry } from "@/lib/types";

/**
 * Get CSS classes and label for colour-coded usage indicator.
 *
 * Thresholds:
 * - ≥90% → green (High usage)
 * - 50–89% → orange (Moderate usage)
 * - <50% → red (Low usage)
 */
export function getUsageColour(percent: number): {
  bgClass: string;
  label: string;
} {
  if (percent >= 90) {
    return { bgClass: "bg-green-500", label: "High usage" };
  }
  if (percent >= 50) {
    return { bgClass: "bg-orange-500", label: "Moderate usage" };
  }
  return { bgClass: "bg-red-500", label: "Low usage" };
}

/**
 * Get hex colour string for chart bars using the same thresholds as getUsageColour.
 */
export function getBarHexColor(percent: number): string {
  if (percent >= 90) return "#22c55e";
  if (percent >= 50) return "#f97316";
  return "#ef4444";
}

/**
 * Calculate usage percentage with a guard against division by zero.
 */
export function calcUsagePercent(
  totalRequests: number,
  premiumRequestsPerSeat: number,
): number {
  return premiumRequestsPerSeat > 0
    ? (totalRequests / premiumRequestsPerSeat) * 100
    : 0;
}

/**
 * Get text color class and label for allowance usage percentage.
 *
 * Thresholds (inverted from per-user usage — high = bad):
 * - < 80% → green (Within limit)
 * - 80–100% → amber (Approaching limit)
 * - > 100% → red (Over limit)
 */
export function getAllowanceThresholdColor(percent: number): {
  colorClass: string;
  label: string;
} {
  if (percent > 100) {
    return { colorClass: "text-red-600", label: "Over limit" };
  }
  if (percent >= 80) {
    return { colorClass: "text-amber-600", label: "Approaching limit" };
  }
  return { colorClass: "text-green-600", label: "Within limit" };
}

/**
 * Calculate the allowance usage trend between two months.
 *
 * Returns a directional arrow, rounded delta in percentage points,
 * color class, and accessibility label. For allowance usage,
 * increase = good (green), decrease = bad (red).
 */
export function calcAllowanceTrend(
  currentPercent: number,
  previousPercent: number,
): { arrow: string; delta: number; colorClass: string; label: string } {
  const delta = Math.round(currentPercent - previousPercent);
  if (delta > 0) {
    return { arrow: "↑", delta, colorClass: "text-green-600", label: "Increased usage" };
  }
  if (delta < 0) {
    return { arrow: "↓", delta: Math.abs(delta), colorClass: "text-red-600", label: "Decreased usage" };
  }
  return { arrow: "—", delta: 0, colorClass: "text-gray-500", label: "No change" };
}

/**
 * Check whether a member matches a search query.
 *
 * Matches case-insensitively against `githubUsername`, `firstName`, and
 * `lastName`. `null` values for `firstName` / `lastName` are treated as
 * non-matching.
 */
export function memberMatchesSearch(
  member: MemberEntry,
  query: string,
): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    member.githubUsername.toLowerCase().includes(lowerQuery) ||
    (member.firstName?.toLowerCase().includes(lowerQuery) ?? false) ||
    (member.lastName?.toLowerCase().includes(lowerQuery) ?? false)
  );
}

