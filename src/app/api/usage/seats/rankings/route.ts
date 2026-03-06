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

    const rankingSql = `WITH seat_requests AS (
         SELECT
           cu."seatId",
           SUM((item->>'grossQuantity')::numeric) AS total_requests
         FROM copilot_usage cu,
              jsonb_array_elements(cu."usageItems") AS item
         WHERE cu."month" = $1 AND cu."year" = $2
         GROUP BY cu."seatId"
       ),
       seat_usage AS (
         SELECT
           sr."seatId",
           sr.total_requests,
           CASE WHEN $3 > 0
             THEN sr.total_requests / $3 * 100
             ELSE 0
           END AS usage_percent
         FROM seat_requests sr
       )
       SELECT
         su."seatId",
         cs."githubUsername",
         cs."firstName",
         cs."lastName",
         ROUND(su.total_requests::numeric, 0)   AS "totalRequests",
         ROUND(su.usage_percent::numeric, 1)     AS "usagePercent"
       FROM seat_usage su
       JOIN copilot_seat cs ON cs.id = su."seatId"`;

    type RankingRow = {
      seatId: number;
      githubUsername: string;
      firstName: string | null;
      lastName: string | null;
      totalRequests: string;
      usagePercent: string;
    };

    const params = [month, year, premiumRequestsPerSeat];

    const mostActiveRows: RankingRow[] = await dataSource.query(
      `${rankingSql}
       ORDER BY su.usage_percent DESC, su.total_requests DESC
       LIMIT 5`,
      params,
    );

    const leastActiveRows: RankingRow[] = await dataSource.query(
      `${rankingSql}
       ORDER BY su.usage_percent ASC, su.total_requests ASC
       LIMIT 5`,
      params,
    );

    const mapRow = (row: RankingRow) => ({
      seatId: row.seatId,
      githubUsername: row.githubUsername,
      firstName: row.firstName,
      lastName: row.lastName,
      totalRequests: Number(row.totalRequests),
      usagePercent: Number(row.usagePercent),
    });

    return NextResponse.json({
      mostActive: mostActiveRows.map(mapRow),
      leastActive: leastActiveRows.map(mapRow),
      month,
      year,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/usage/seats/rankings");
  }
}
