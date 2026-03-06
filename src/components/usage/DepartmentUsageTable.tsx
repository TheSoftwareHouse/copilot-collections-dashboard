import Link from "next/link";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";
import type { DepartmentUsageEntry } from "@/components/usage/DepartmentUsagePanel";

interface DepartmentUsageTableProps {
  departments: DepartmentUsageEntry[];
  month: number;
  year: number;
}

export default function DepartmentUsageTable({
  departments,
  month,
  year,
}: DepartmentUsageTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label="Department usage summary">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium text-gray-500">
              Department Name
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Avg Requests/Member
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Usage %
            </th>
          </tr>
        </thead>
        <tbody>
          {departments.map((dept) => (
            <tr
              key={dept.departmentId}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-3 text-gray-900 font-medium">
                <Link
                  href={`/usage/departments/${dept.departmentId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  <span className="inline-flex items-center gap-2">
                    <UsageStatusIndicator percent={dept.usagePercent} />
                    {dept.departmentName}
                  </span>
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/departments/${dept.departmentId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {dept.averageRequestsPerMember.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/departments/${dept.departmentId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {Math.round(dept.usagePercent)}%
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
