import Link from "next/link";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";
import { formatCurrency } from "@/lib/format-helpers";
import type { TeamUsageEntry } from "@/components/usage/TeamUsagePanel";

interface TeamUsageTableProps {
  teams: TeamUsageEntry[];
  month: number;
  year: number;
}

export default function TeamUsageTable({ teams, month, year }: TeamUsageTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label="Team usage summary">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium text-gray-500">Team Name</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">Members</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">Total Requests</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">Avg Requests/Member</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">Total Spending</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">Usage %</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr
              key={team.teamId}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-3 text-gray-900 font-medium">
                <Link
                  href={`/usage/teams/${team.teamId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  <span className="inline-flex items-center gap-2">
                    <UsageStatusIndicator percent={team.usagePercent} />
                    {team.teamName}
                  </span>
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/teams/${team.teamId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {team.memberCount}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/teams/${team.teamId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {team.totalRequests.toLocaleString()}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/teams/${team.teamId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {team.averageRequestsPerMember.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/teams/${team.teamId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {formatCurrency(team.totalGrossAmount)}
                </Link>
              </td>
              <td className="px-6 py-3 text-right text-gray-700">
                <Link
                  href={`/usage/teams/${team.teamId}?month=${month}&year=${year}`}
                  className="block w-full"
                >
                  {Math.round(team.usagePercent)}%
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
