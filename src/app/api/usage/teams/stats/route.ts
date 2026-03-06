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

    const rows: {
      averageUsage: string | null;
      medianUsage: string | null;
      minUsage: string | null;
      maxUsage: string | null;
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
           CASE WHEN $3 > 0
             THEN capped_total / (member_count * $3) * 100
             ELSE 0
           END AS usage_percent
         FROM team_aggregates
         WHERE member_count > 0
       )
       SELECT
         ROUND(AVG(usage_percent)::numeric, 1) AS "averageUsage",
         ROUND(
           (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usage_percent))::numeric,
           1
         ) AS "medianUsage",
         ROUND(MIN(usage_percent)::numeric, 1) AS "minUsage",
         ROUND(MAX(usage_percent)::numeric, 1) AS "maxUsage"
       FROM team_usage`,
      [month, year, premiumRequestsPerSeat],
    );

    const row = rows[0];

    return NextResponse.json({
      averageUsage: row?.averageUsage != null ? Number(row.averageUsage) : null,
      medianUsage: row?.medianUsage != null ? Number(row.medianUsage) : null,
      minUsage: row?.minUsage != null ? Number(row.minUsage) : null,
      maxUsage: row?.maxUsage != null ? Number(row.maxUsage) : null,
      month,
      year,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/usage/teams/stats");
  }
}
