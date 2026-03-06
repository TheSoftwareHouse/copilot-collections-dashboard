"use client";

import { useAsyncFetch } from "@/lib/hooks/useAsyncFetch";

interface DepartmentUsageStatsResponse {
  averageUsage: number | null;
  medianUsage: number | null;
  minUsage: number | null;
  maxUsage: number | null;
  month: number;
  year: number;
}

interface DepartmentUsageStatsCardsProps {
  month: number;
  year: number;
}

const STAT_CARDS = [
  { key: "averageUsage" as const, label: "Average Usage" },
  { key: "medianUsage" as const, label: "Median Usage" },
  { key: "minUsage" as const, label: "Minimum Usage" },
  { key: "maxUsage" as const, label: "Maximum Usage" },
];

export default function DepartmentUsageStatsCards({ month, year }: DepartmentUsageStatsCardsProps) {
  const { data, loading } = useAsyncFetch<DepartmentUsageStatsResponse>(
    `/api/usage/departments/stats?month=${month}&year=${year}`,
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={loading}>
      {STAT_CARDS.map(({ key, label }) => {
        const value = data?.[key];
        const display = !loading && value != null ? `${Math.round(value)}%` : "—";

        return (
          <div
            key={key}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-sm font-medium text-gray-500">{label}</h2>
            <p className="mt-2 text-3xl font-bold text-gray-900">{display}</p>
          </div>
        );
      })}
    </div>
  );
}
