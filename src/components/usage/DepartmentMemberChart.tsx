"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
interface MemberChartEntry {
  seatId: number;
  githubUsername: string;
  totalRequests: number;
}

interface DepartmentMemberChartProps {
  members: MemberChartEntry[];
  premiumRequestsPerSeat: number;
  onBarClick?: (seatId: number) => void;
}

function getBarColor(totalRequests: number, premiumRequestsPerSeat: number): string {
  const percent = premiumRequestsPerSeat > 0
    ? (totalRequests / premiumRequestsPerSeat) * 100
    : 0;
  if (percent >= 100) return "#22c55e";
  if (percent >= 51) return "#f97316";
  return "#ef4444";
}

export default function DepartmentMemberChart({
  members,
  premiumRequestsPerSeat,
  onBarClick,
}: DepartmentMemberChartProps) {
  // Sort highest → lowest so the horizontal bar chart renders highest usage at the top
  const sortedMembers = [...members].sort(
    (a, b) => b.totalRequests - a.totalRequests,
  );

  const chartHeight = Math.max(200, sortedMembers.length * 40);

  return (
    <div
      role="img"
      aria-label="Department member usage chart showing each member's total premium requests relative to included allowance"
    >
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart layout="vertical" data={sortedMembers}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="githubUsername"
            tick={{ fontSize: 12 }}
            width={150}
          />
          <Tooltip
            formatter={(value: number | undefined) => [
              (value ?? 0).toLocaleString(),
              "Total Requests",
            ]}
            labelFormatter={(label) => String(label)}
          />
          <ReferenceLine
            x={premiumRequestsPerSeat}
            stroke="#6b7280"
            strokeDasharray="3 3"
            label={{
              value: `${premiumRequestsPerSeat} included`,
              position: "top",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="totalRequests"
            name="Total Requests"
            cursor={onBarClick ? "pointer" : undefined}
            onClick={(_data: unknown, index: number) => {
              if (onBarClick && sortedMembers[index]) {
                onBarClick(sortedMembers[index].seatId);
              }
            }}
          >
            {sortedMembers.map((member) => (
              <Cell
                key={member.seatId}
                fill={getBarColor(member.totalRequests, premiumRequestsPerSeat)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
