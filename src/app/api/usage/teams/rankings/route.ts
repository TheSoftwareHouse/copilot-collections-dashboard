import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { getPremiumAllowance } from "@/lib/get-premium-allowance";
import { handleRouteError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const { searchParams } = request.nextUrl;

    const now = new Date();
    const defaultMonth = now.getUTCMonth() + 1;
    const defaultYear = now.getUTCFullYear();

    let month = parseInt(searchParams.get("month") ?? "", 10);
    if (isNaN(month) || month < 1 || month > 12) month = defaultMonth;

    let year = parseInt(searchParams.get("year") ?? "", 10);
    if (isNaN(year) || year < 2020) year = defaultYear;

    const dataSource = await getDb();
    const premiumRequestsPerSeat = await getPremiumAllowance();

    type RankingRow = {
      teamId: number;
      teamName: string;
      memberCount: number;
      usagePercent: string;
      rank_desc: string;
      rank_asc: string;
    };

    const rows: RankingRow[] = await dataSource.query(
      `WITH team_members AS (
         SELECT tms."teamId", tms."seatId"
         FROM team_member_snapshot tms
         WHERE tms.month = $1 AND tms.year = $2
       ),
       member_usage AS (
         SELECT
           tm."teamId",
           tm."seatId",
           COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS requests
         FROM team_members tm
         LEFT JOIN copilot_usage cu
           ON cu."seatId" = tm."seatId" AND cu.month = $1 AND cu.year = $2
         LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
         GROUP BY tm."teamId", tm."seatId"
       ),
       team_aggregates AS (
         SELECT
           mu."teamId",
           COUNT(DISTINCT mu."seatId") AS member_count,
           COALESCE(SUM(LEAST(mu.requests, $3)), 0) AS capped_total
         FROM member_usage mu
         GROUP BY mu."teamId"
       ),
       team_usage AS (
         SELECT
           ta."teamId",
           ta.member_count,
           CASE WHEN $3 > 0
             THEN ta.capped_total / (ta.member_count * $3) * 100
             ELSE 0
           END AS usage_percent
         FROM team_aggregates ta
         WHERE ta.member_count > 0
       ),
       ranked AS (
         SELECT
           tu."teamId",
           t.name AS "teamName",
           tu.member_count::int AS "memberCount",
           ROUND(tu.usage_percent::numeric, 1) AS "usagePercent",
           ROW_NUMBER() OVER (ORDER BY tu.usage_percent DESC, tu.member_count DESC) AS rank_desc,
           ROW_NUMBER() OVER (ORDER BY tu.usage_percent ASC, tu.member_count ASC) AS rank_asc
         FROM team_usage tu
         JOIN team t ON t.id = tu."teamId"
       )
       SELECT *
       FROM ranked
       WHERE rank_desc <= 5 OR rank_asc <= 5`,
      [month, year, premiumRequestsPerSeat],
    );

    const mapRow = (row: RankingRow) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      memberCount: row.memberCount,
      usagePercent: Number(row.usagePercent),
    });

    const mostActive = rows
      .filter((r) => Number(r.rank_desc) <= 5)
      .sort((a, b) => Number(a.rank_desc) - Number(b.rank_desc))
      .map(mapRow);
    const leastActive = rows
      .filter((r) => Number(r.rank_asc) <= 5)
      .sort((a, b) => Number(a.rank_asc) - Number(b.rank_asc))
      .map(mapRow);

    return NextResponse.json({
      mostActive,
      leastActive,
      month,
      year,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/usage/teams/rankings");
  }
}
