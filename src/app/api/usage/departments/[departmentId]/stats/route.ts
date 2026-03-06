import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DepartmentEntity } from "@/entities/department.entity";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { getPremiumAllowance } from "@/lib/get-premium-allowance";
import { handleRouteError } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ departmentId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { departmentId: departmentIdParam } = await context.params;
  const departmentId = Number(departmentIdParam);
  if (!Number.isFinite(departmentId) || !Number.isInteger(departmentId) || departmentId < 1) {
    return NextResponse.json(
      { error: "Invalid department ID" },
      { status: 400 },
    );
  }

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
    const departmentRepo = dataSource.getRepository(DepartmentEntity);

    const department = await departmentRepo.findOne({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    const rows: {
      averageUsage: string | null;
      medianUsage: string | null;
      minUsage: string | null;
      maxUsage: string | null;
    }[] = await dataSource.query(
      `WITH member_requests AS (
         SELECT
           cs.id AS "seatId",
           COALESCE(SUM((item->>'grossQuantity')::numeric), 0) AS total_requests
         FROM copilot_seat cs
         LEFT JOIN copilot_usage cu
           ON cu."seatId" = cs.id AND cu.month = $2 AND cu.year = $3
         LEFT JOIN LATERAL jsonb_array_elements(cu."usageItems") AS item ON true
         WHERE cs."departmentId" = $1
         GROUP BY cs.id
       ),
       member_usage AS (
         SELECT
           CASE WHEN $4 > 0
             THEN total_requests / $4 * 100
             ELSE 0
           END AS usage_percent
         FROM member_requests
       )
       SELECT
         ROUND(AVG(usage_percent)::numeric, 1) AS "averageUsage",
         ROUND(
           (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usage_percent))::numeric,
           1
         ) AS "medianUsage",
         ROUND(MIN(usage_percent)::numeric, 1) AS "minUsage",
         ROUND(MAX(usage_percent)::numeric, 1) AS "maxUsage"
       FROM member_usage`,
      [departmentId, month, year, premiumRequestsPerSeat],
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
    return handleRouteError(error, "GET /api/usage/departments/[departmentId]/stats");
  }
}
