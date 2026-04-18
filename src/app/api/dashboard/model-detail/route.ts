import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { handleRouteError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { modelDetailQuerySchema } from "@/lib/validations/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { searchParams } = request.nextUrl;
  const rawParams: Record<string, string> = {};
  const modelParam = searchParams.get("model");
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const dayParam = searchParams.get("day");
  if (modelParam !== null) rawParams.model = modelParam;
  if (monthParam !== null) rawParams.month = monthParam;
  if (yearParam !== null) rawParams.year = yearParam;
  if (dayParam !== null) rawParams.day = dayParam;

  const parsed = modelDetailQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { model, month, year, day } = parsed.data;

  try {
    const dataSource = await getDb();

    const params: (string | number)[] = [month, year, model];
    let dayClause = "";
    if (day !== undefined) {
      params.push(day);
      dayClause = ` AND cu."day" = $${params.length}`;
    }

    const userRows: {
      seatId: number;
      githubUsername: string;
      firstName: string | null;
      lastName: string | null;
      department: string | null;
      totalRequests: string;
      totalSpending: string;
    }[] = await dataSource.query(
      `SELECT
         cs.id AS "seatId",
         cs."githubUsername",
         cs."firstName",
         cs."lastName",
         cs."department",
         SUM((item->>'grossQuantity')::numeric) AS "totalRequests",
         SUM((item->>'grossAmount')::numeric) AS "totalSpending"
       FROM copilot_usage cu
       JOIN copilot_seat cs ON cu."seatId" = cs.id,
            jsonb_array_elements(cu."usageItems") AS item
       WHERE cu."month" = $1 AND cu."year" = $2
         AND item->>'model' = $3${dayClause}
       GROUP BY cs.id, cs."githubUsername", cs."firstName", cs."lastName", cs."department"
       ORDER BY "totalRequests" DESC`,
      params,
    );

    const users = userRows.map((row) => ({
      seatId: row.seatId,
      githubUsername: row.githubUsername,
      firstName: row.firstName,
      lastName: row.lastName,
      department: row.department,
      totalRequests: parseInt(String(row.totalRequests), 10),
      totalSpending: parseFloat(String(row.totalSpending)),
    }));

    const totalRequests = users.reduce((sum, u) => sum + u.totalRequests, 0);
    const totalSpending = users.reduce((sum, u) => sum + u.totalSpending, 0);

    return NextResponse.json({
      users,
      summary: {
        totalRequests,
        totalSpending,
        activeUsers: users.length,
      },
      model,
      month,
      year,
      ...(day !== undefined && { day }),
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/dashboard/model-detail");
  }
}
