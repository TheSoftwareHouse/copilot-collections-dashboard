"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format-helpers";
import SortableTableHeader from "@/components/shared/SortableTableHeader";

type SortField = "model" | "totalRequests" | "grossAmount" | "netAmount";

interface ModelBreakdownEntry {
  model: string;
  totalRequests: number;
  grossAmount: number;
  netAmount: number;
}

interface SeatModelTableProps {
  models: ModelBreakdownEntry[];
}

export default function SeatModelTable({ models }: SeatModelTableProps) {
  const [sortBy, setSortBy] = useState<SortField>("totalRequests");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  function handleSortClick(field: string) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field as SortField);
      setSortOrder("asc");
    }
  }

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "model") {
        return dir * a.model.localeCompare(b.model);
      }
      return dir * (a[sortBy] - b[sortBy]);
    });
  }, [models, sortBy, sortOrder]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <SortableTableHeader label="Model" field="model" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSortClick} />
            <SortableTableHeader label="Total Requests" field="totalRequests" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSortClick} align="right" />
            <SortableTableHeader label="Gross Amount" field="grossAmount" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSortClick} align="right" />
            <SortableTableHeader label="Net Amount" field="netAmount" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={handleSortClick} align="right" />
          </tr>
        </thead>
        <tbody>
          {sortedModels.map((m) => (
            <tr
              key={m.model}
              className="border-b border-gray-100 last:border-0"
            >
              <td className="px-6 py-3 text-gray-900 font-medium">
                {m.model}
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                {m.totalRequests.toLocaleString()}
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                {formatCurrency(m.grossAmount)}
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                {formatCurrency(m.netAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
