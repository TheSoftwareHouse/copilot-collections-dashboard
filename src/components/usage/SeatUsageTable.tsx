import Link from "next/link";
import { calcUsagePercent } from "@/lib/usage-helpers";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";
import { formatCurrency, formatName } from "@/lib/format-helpers";
import type { SeatUsageEntry } from "@/components/usage/SeatUsagePanel";

interface SeatUsageTableProps {
  seats: SeatUsageEntry[];
  month: number;
  year: number;
  premiumRequestsPerSeat: number;
}

export default function SeatUsageTable({ seats, month, year, premiumRequestsPerSeat }: SeatUsageTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium text-gray-500">
              GitHub Username
            </th>
            <th className="px-6 py-3 font-medium text-gray-500">Name</th>
            <th className="px-6 py-3 font-medium text-gray-500">Department</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Usage
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Total Requests
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Total Spending
            </th>
          </tr>
        </thead>
        <tbody>
          {seats.map((seat) => {
            const rawPercent = calcUsagePercent(seat.totalRequests, premiumRequestsPerSeat);

            return (
            <tr
              key={seat.seatId}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-3 text-gray-900 font-medium">
                <Link
                  href={`/usage/seats/${seat.seatId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  <span className="inline-flex items-center gap-2">
                    <UsageStatusIndicator percent={rawPercent} />
                    {seat.githubUsername}
                  </span>
                </Link>
              </td>
              <td className="px-6 py-3 text-gray-700">
                <Link
                  href={`/usage/seats/${seat.seatId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {formatName(seat.firstName, seat.lastName)}
                </Link>
              </td>
              <td className="px-6 py-3 text-gray-700">
                <Link
                  href={`/usage/seats/${seat.seatId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {seat.department ?? "—"}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/seats/${seat.seatId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {seat.totalRequests.toLocaleString()} / {premiumRequestsPerSeat} ({Math.round(rawPercent)}%)
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/seats/${seat.seatId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {seat.totalRequests.toLocaleString()}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/seats/${seat.seatId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {formatCurrency(seat.totalGrossAmount)}
                </Link>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
