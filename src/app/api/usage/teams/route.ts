import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { getPremiumAllowance } from "@/lib/get-premium-allowance";
import { handleRouteError } from "@/lib/api-helpers";
import { calcUsagePercent } from "@/lib/usage-helpers";

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

    const rows: {
      teamId: number;
      teamName: string;
      memberCount: string;
      totalRequests: string;
      cappedTotalRequests: string;
      totalGrossAmount: string;
    }[] = await dataSource.query(
      `WITH team_members AS (
         SELECT tms."teamId", tms."seatId"
         FROM team_member_snapshot tms
         WHERE tms.month = $1 AND tms.year = $2
       ),
       member_usage AS (
         SELECT
           tm."teamId",
           tm."seatId",
           COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS requests,
           COALESCE(SUM((item->>'grossAmount')::numeric), 0) AS "grossAmount"
         FROM team_members tm
         LEFT JOIN copilot_usage cu
           ON cu."seatId" = tm."seatId" AND cu.month = $1 AND cu.year = $2
         LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
         GROUP BY tm."teamId", tm."seatId"
       ),
       team_aggregates AS (
         SELECT
           mu."teamId",
           COUNT(DISTINCT mu."seatId") AS "memberCount",
           COALESCE(SUM(mu.requests), 0) AS "totalRequests",
           COALESCE(SUM(LEAST(mu.requests, $3)), 0) AS "cappedTotalRequests",
           COALESCE(SUM(mu."grossAmount"), 0) AS "totalGrossAmount"
         FROM member_usage mu
         GROUP BY mu."teamId"
       )
       SELECT
         t.id AS "teamId",
         t.name AS "teamName",
         COALESCE(ta."memberCount", 0)::int AS "memberCount",
         COALESCE(ta."totalRequests", 0) AS "totalRequests",
         COALESCE(ta."cappedTotalRequests", 0) AS "cappedTotalRequests",
         COALESCE(ta."totalGrossAmount", 0) AS "totalGrossAmount"
       FROM team t
       LEFT JOIN team_aggregates ta ON ta."teamId" = t.id
       ORDER BY
         CASE WHEN COALESCE(ta."memberCount", 0) = 0 THEN 0
              ELSE COALESCE(ta."cappedTotalRequests", 0) / (COALESCE(ta."memberCount", 0) * $3)
         END DESC,
         t.name ASC`,
      [month, year, premiumRequestsPerSeat],
    );

    const teams = rows.map((row) => {
      const memberCount = Number(row.memberCount);
      const totalRequests = Number(row.totalRequests);
      const cappedTotalRequests = Number(row.cappedTotalRequests);
      const totalGrossAmount = Number(row.totalGrossAmount);
      const usagePercent = calcUsagePercent(cappedTotalRequests, memberCount * premiumRequestsPerSeat);
      return {
        teamId: row.teamId,
        teamName: row.teamName,
        memberCount,
        totalRequests,
        totalGrossAmount,
        averageRequestsPerMember: memberCount > 0 ? totalRequests / memberCount : 0,
        averageGrossAmountPerMember: memberCount > 0 ? totalGrossAmount / memberCount : 0,
        usagePercent,
      };
    });

    return NextResponse.json({
      teams,
      total: teams.length,
      month,
      year,
      premiumRequestsPerSeat,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/usage/teams");
  }
}
