"use client";

import { useState, useEffect, useCallback } from "react";
import { useAsyncFetch } from "@/lib/hooks/useAsyncFetch";
import SeatUsageTable from "@/components/usage/SeatUsageTable";
import SeatUsageStatsCards from "@/components/usage/SeatUsageStatsCards";
import SeatUsageRankings from "@/components/usage/SeatUsageRankings";
import Pagination from "@/components/usage/Pagination";
import { MONTH_NAMES } from "@/lib/constants";

interface ModelEntry {
  model: string;
  requests: number;
  grossAmount: number;
  netAmount: number;
}

export interface SeatUsageEntry {
  seatId: number;
  githubUsername: string;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  totalRequests: number;
  totalGrossAmount: number;
  totalNetAmount: number;
  models: ModelEntry[];
}

interface SeatUsageResponse {
  seats: SeatUsageEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  month: number;
  year: number;
  premiumRequestsPerSeat?: number;
}

interface SeatUsagePanelProps {
  month: number;
  year: number;
}

function readSearchFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("search") ?? "";
}

const PAGE_SIZE = 20;

export default function SeatUsagePanel({ month, year }: SeatUsagePanelProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(() => readSearchFromUrl());
  const [search, setSearch] = useState(() => readSearchFromUrl());

  // Reset to page 1 when month/year changes
  useEffect(() => {
    setPage(1);
  }, [month, year]);

  // Debounce search input → search (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Persist search query in URL
  const updateSearchUrl = useCallback((value: string) => {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set("search", value);
    } else {
      url.searchParams.delete("search");
    }
    window.history.replaceState(null, "", url.toString());
  }, []);

  useEffect(() => {
    updateSearchUrl(search);
  }, [search, updateSearchUrl]);

  const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
  const { data, loading, error } = useAsyncFetch<SeatUsageResponse>(
    `/api/usage/seats?month=${month}&year=${year}&page=${page}&pageSize=${PAGE_SIZE}${searchParam}`,
  );

  const searchBox = (
    <div>
      <label htmlFor="seat-usage-search" className="sr-only">
        Search seats
      </label>
      <input
        id="seat-usage-search"
        type="search"
        placeholder="Search seats…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <SeatUsageStatsCards month={month} year={year} />
        <SeatUsageRankings month={month} year={year} />
        {searchBox}
        <div className="flex items-center justify-center py-12" role="status">
          <p className="text-sm text-gray-500">Loading usage data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SeatUsageStatsCards month={month} year={year} />
        <SeatUsageRankings month={month} year={year} />
        {searchBox}
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-6"
          role="alert"
        >
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    const emptyMessage = search
      ? "No seats match your search query."
      : `No per-seat usage data available for ${monthLabel}. Data will appear after the usage collection job runs.`;

    return (
      <div className="space-y-4">
        <SeatUsageStatsCards month={month} year={year} />
        <SeatUsageRankings month={month} year={year} />
        {searchBox}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SeatUsageStatsCards month={month} year={year} />
      <SeatUsageRankings month={month} year={year} />
      {searchBox}
      <SeatUsageTable seats={data.seats} month={month} year={year} premiumRequestsPerSeat={data.premiumRequestsPerSeat ?? 300} />
      {data.totalPages > 1 && (
        <Pagination
          currentPage={data.page}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
