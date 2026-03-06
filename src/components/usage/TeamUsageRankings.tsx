"use client";

import Link from "next/link";
import { useAsyncFetch } from "@/lib/hooks/useAsyncFetch";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";

interface TeamRankingEntry {
  teamId: number;
  teamName: string;
  memberCount: number;
  usagePercent: number;
}

interface TeamRankingsResponse {
  mostActive: TeamRankingEntry[];
  month: number;
  year: number;
}

interface TeamUsageRankingsProps {
  month: number;
  year: number;
}

function RankingCard({
  title,
  entries,
  loading,
  month,
  year,
}: {
  title: string;
  entries: TeamRankingEntry[];
  loading: boolean;
  month: number;
  year: number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {loading ? (
        <div className="px-6 py-6" aria-busy="true" role="status">
          <p className="text-sm text-gray-500">Loading rankings…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="px-6 py-6">
          <p className="text-sm text-gray-500">No usage data for this month.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <li key={entry.teamId}>
              <Link
                href={`/usage/teams/${entry.teamId}?month=${month}&year=${year}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      <UsageStatusIndicator percent={entry.usagePercent} />
                      {entry.teamName}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.memberCount} {entry.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">
                    {Math.round(entry.usagePercent)}%
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TeamUsageRankings({ month, year }: TeamUsageRankingsProps) {
  const { data, loading } = useAsyncFetch<TeamRankingsResponse>(
    `/api/usage/teams/rankings?month=${month}&year=${year}`,
  );

  return (
    <div>
      <RankingCard
        title="Most Active Teams"
        entries={data?.mostActive ?? []}
        loading={loading}
        month={month}
        year={year}
      />
    </div>
  );
}
