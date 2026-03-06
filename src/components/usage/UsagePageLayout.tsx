"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import MonthFilter from "@/components/dashboard/MonthFilter";
import SeatUsagePanel from "@/components/usage/SeatUsagePanel";
import TeamUsagePanel from "@/components/usage/TeamUsagePanel";
import DepartmentUsagePanel from "@/components/usage/DepartmentUsagePanel";
import { useAvailableMonths } from "@/lib/hooks/useAvailableMonths";

const TABS = [
  { id: "seat", label: "Seat" },
  { id: "team", label: "Team" },
  { id: "department", label: "Department" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface UsagePageLayoutProps {
  initialMonth: number;
  initialYear: number;
  initialTab?: TabId;
}

function isValidTab(value: unknown): value is TabId {
  return (
    typeof value === "string" &&
    TABS.some((t) => t.id === value)
  );
}

function readTabFromUrl(fallback: TabId): TabId {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return isValidTab(tab) ? tab : fallback;
}

function readIntFromUrl(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const v = params.get(key);
  return v && !isNaN(parseInt(v, 10)) ? parseInt(v, 10) : fallback;
}

export default function UsagePageLayout({
  initialMonth,
  initialYear,
  initialTab = "seat",
}: UsagePageLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    readTabFromUrl(isValidTab(initialTab) ? initialTab : "seat"),
  );
  const [selectedMonth, setSelectedMonth] = useState(() =>
    readIntFromUrl("month", initialMonth),
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    readIntFromUrl("year", initialYear),
  );
  const { availableMonths, loadingMonths } = useAvailableMonths();

  function buildUrl(tab: TabId, month: number, year: number): string {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.set("month", String(month));
    url.searchParams.set("year", String(year));
    return url.toString();
  }

  /* Tab changes → pushState (creates history entry so browser back works) */
  function handleTabChange(tab: TabId) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const url = new URL(buildUrl(tab, selectedMonth, selectedYear));
    url.searchParams.delete("search");
    window.history.pushState(null, "", url.toString());
  }

  /* Month/year changes → replaceState (filter change, no new history entry) */
  function handleMonthChange(month: number, year: number) {
    setSelectedMonth(month);
    setSelectedYear(year);
    window.history.replaceState(null, "", buildUrl(activeTab, month, year));
  }

  /* Ensure URL reflects initial state on mount */
  useLayoutEffect(() => {
    window.history.replaceState(null, "", buildUrl(activeTab, selectedMonth, selectedYear));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Listen for browser back/forward to restore tab state from URL */
  useEffect(() => {
    function onPopState() {
      const tab = readTabFromUrl(activeTab);
      const month = readIntFromUrl("month", selectedMonth);
      const year = readIntFromUrl("year", selectedYear);
      setActiveTab(tab);
      setSelectedMonth(month);
      setSelectedYear(year);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div role="tablist" aria-label="Usage analytics tabs" className="flex gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <MonthFilter
          availableMonths={availableMonths}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={handleMonthChange}
          disabled={loadingMonths}
        />
      </div>

      {activeTab === "seat" && (
        <div
          role="tabpanel"
          id="tabpanel-seat"
          aria-labelledby="tab-seat"
        >
          <SeatUsagePanel month={selectedMonth} year={selectedYear} />
        </div>
      )}

      {activeTab === "team" && (
        <div
          role="tabpanel"
          id="tabpanel-team"
          aria-labelledby="tab-team"
        >
          <TeamUsagePanel month={selectedMonth} year={selectedYear} />
        </div>
      )}

      {activeTab === "department" && (
        <div
          role="tabpanel"
          id="tabpanel-department"
          aria-labelledby="tab-department"
        >
          <DepartmentUsagePanel month={selectedMonth} year={selectedYear} />
        </div>
      )}
    </div>
  );
}
