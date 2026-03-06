"use client";

import { MONTH_NAMES } from "@/lib/constants";
import type { AvailableMonth } from "@/lib/types";

interface MonthFilterProps {
  availableMonths: AvailableMonth[];
  selectedMonth: number;
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  disabled?: boolean;
}

function formatMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export default function MonthFilter({
  availableMonths,
  selectedMonth,
  selectedYear,
  onChange,
  disabled = false,
}: MonthFilterProps) {
  const selectedValue = `${selectedMonth}-${selectedYear}`;

  // Check if the current selection is in the available months
  const selectionInAvailable = availableMonths.some(
    (m) => m.month === selectedMonth && m.year === selectedYear,
  );

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [monthStr, yearStr] = e.target.value.split("-");
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!isNaN(month) && !isNaN(year)) {
      onChange(month, year);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="month-filter" className="text-sm font-medium text-gray-700">
        Month
      </label>
      <select
        id="month-filter"
        value={selectedValue}
        onChange={handleChange}
        disabled={disabled}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {!selectionInAvailable && (
          <option value={selectedValue}>
            {formatMonthLabel(selectedMonth, selectedYear)}
          </option>
        )}
        {availableMonths.map((m) => (
          <option key={`${m.month}-${m.year}`} value={`${m.month}-${m.year}`}>
            {formatMonthLabel(m.month, m.year)}
          </option>
        ))}
      </select>
    </div>
  );
}
