import Link from "next/link";
import { calcUsagePercent } from "@/lib/usage-helpers";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";
import { formatCurrency, formatName } from "@/lib/format-helpers";

interface TeamMember {
  seatId: number;
  githubUsername: string;
  firstName: string | null;
  lastName: string | null;
  totalRequests: number;
  totalGrossAmount: number;
}

interface TeamMemberTableProps {
  members: TeamMember[];
  premiumRequestsPerSeat: number;
  month?: number;
  year?: number;
}

export default function TeamMemberTable({ members, premiumRequestsPerSeat, month, year }: TeamMemberTableProps) {
  const navigable = month != null && year != null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 font-medium text-gray-500">
              GitHub Username
            </th>
            <th className="px-6 py-3 font-medium text-gray-500">Name</th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Usage
            </th>
            <th className="px-6 py-3 text-right font-medium text-gray-500">
              Gross Spending
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const rawPercent = calcUsagePercent(member.totalRequests, premiumRequestsPerSeat);
            const href = navigable
              ? `/usage/seats/${member.seatId}?month=${month}&year=${year}`
              : undefined;

            return (
              <tr
                key={member.seatId}
                className={`border-b border-gray-100 last:border-0${navigable ? " hover:bg-gray-50 cursor-pointer" : ""}`}
              >
                <td className="px-6 py-3 text-gray-900 font-medium">
                  {href ? (
                    <Link href={href} className="block w-full">
                      <span className="inline-flex items-center gap-2">
                        <UsageStatusIndicator percent={rawPercent} />
                        {member.githubUsername}
                      </span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <UsageStatusIndicator percent={rawPercent} />
                      {member.githubUsername}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-gray-700">
                  {href ? (
                    <Link href={href} className="block w-full">
                      {formatName(member.firstName, member.lastName)}
                    </Link>
                  ) : (
                    formatName(member.firstName, member.lastName)
                  )}
                </td>
                <td className="px-6 py-3 text-right text-gray-700">
                  {href ? (
                    <Link href={href} className="block w-full">
                      {member.totalRequests.toLocaleString()} / {premiumRequestsPerSeat} ({Math.round(rawPercent)}%)
                    </Link>
                  ) : (
                    <>{member.totalRequests.toLocaleString()} / {premiumRequestsPerSeat} ({Math.round(rawPercent)}%)</>
                  )}
                </td>
                <td className="px-6 py-3 text-right text-gray-700">
                  {href ? (
                    <Link href={href} className="block w-full">
                      {formatCurrency(member.totalGrossAmount)}
                    </Link>
                  ) : (
                    formatCurrency(member.totalGrossAmount)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
