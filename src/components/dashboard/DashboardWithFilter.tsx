"use client";

import { useState } from "react";
import MonthFilter from "@/components/dashboard/MonthFilter";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import { useAvailableMonths } from "@/lib/hooks/useAvailableMonths";

interface DashboardWithFilterProps {
  initialMonth: number;
  initialYear: number;
}

export default function DashboardWithFilter({
  initialMonth,
  initialYear,
}: DashboardWithFilterProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const { availableMonths, loadingMonths } = useAvailableMonths();

  function handleMonthChange(month: number, year: number) {
    setSelectedMonth(month);
    setSelectedYear(year);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <MonthFilter
          availableMonths={availableMonths}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onChange={handleMonthChange}
          disabled={loadingMonths}
        />
      </div>

      <DashboardPanel month={selectedMonth} year={selectedYear} />
    </div>
  );
}
