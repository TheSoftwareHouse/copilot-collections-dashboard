import { formatCurrency } from "@/lib/format-helpers";

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
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium text-gray-500">Model</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Total Requests
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Gross Amount
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Net Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
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
