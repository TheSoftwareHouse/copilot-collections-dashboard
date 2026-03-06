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
      `WITH seat_requests AS (
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
           CASE WHEN $3 > 0
             THEN total_requests / $3 * 100
             ELSE 0
           END AS usage_percent
         FROM seat_requests
       )
       SELECT
         ROUND(AVG(usage_percent)::numeric, 1) AS "averageUsage",
         ROUND(
           (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usage_percent))::numeric,
           1
         ) AS "medianUsage",
         ROUND(MIN(usage_percent)::numeric, 1) AS "minUsage",
         ROUND(MAX(usage_percent)::numeric, 1) AS "maxUsage"
       FROM seat_usage`,
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
    return handleRouteError(error, "GET /api/usage/seats/stats");
  }
}
