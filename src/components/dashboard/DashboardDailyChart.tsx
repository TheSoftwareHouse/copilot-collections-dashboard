"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardDailyChartProps {
  dailyUsage: Array<{ day: number; totalRequests: number }>;
  daysInMonth: number;
}

export default function DashboardDailyChart({
  dailyUsage,
  daysInMonth,
}: DashboardDailyChartProps) {
  const usageByDay = new Map(dailyUsage.map((d) => [d.day, d]));

  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const entry = usageByDay.get(day);
    return {
      day,
      totalRequests: entry?.totalRequests ?? 0,
    };
  });

  return (
    <div
      role="img"
      aria-label="Daily premium requests bar chart showing total requests per day"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number | undefined) => [
              (value ?? 0).toLocaleString(),
              "Total Requests",
            ]}
            labelFormatter={(label) => `Day ${label}`}
          />
          <Bar dataKey="totalRequests" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
