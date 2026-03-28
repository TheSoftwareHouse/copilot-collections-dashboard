import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { handleRouteError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { dailyDetailQuerySchema } from "@/lib/validations/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { searchParams } = request.nextUrl;
  const rawParams: Record<string, string> = {};
  const dayParam = searchParams.get("day");
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  if (dayParam !== null) rawParams.day = dayParam;
  if (monthParam !== null) rawParams.month = monthParam;
  if (yearParam !== null) rawParams.year = yearParam;

  const parsed = dailyDetailQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { day, month, year } = parsed.data;

  try {
    const dataSource = await getDb();

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
       WHERE cu."day" = $1 AND cu."month" = $2 AND cu."year" = $3
       GROUP BY cs.id, cs."githubUsername", cs."firstName", cs."lastName", cs."department"
       ORDER BY "totalRequests" DESC`,
      [day, month, year],
    );

    const modelRows: {
      model: string;
      totalRequests: string;
      totalSpending: string;
    }[] = await dataSource.query(
      `SELECT
         item->>'model' AS "model",
         SUM((item->>'grossQuantity')::numeric) AS "totalRequests",
         SUM((item->>'grossAmount')::numeric) AS "totalSpending"
       FROM copilot_usage cu,
            jsonb_array_elements(cu."usageItems") AS item
       WHERE cu."day" = $1 AND cu."month" = $2 AND cu."year" = $3
       GROUP BY item->>'model'
       ORDER BY "totalRequests" DESC`,
      [day, month, year],
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

    const models = modelRows.map((row) => ({
      model: row.model,
      totalRequests: parseInt(String(row.totalRequests), 10),
      totalSpending: parseFloat(String(row.totalSpending)),
    }));

    const totalRequests = users.reduce((sum, u) => sum + u.totalRequests, 0);
    const totalSpending = users.reduce((sum, u) => sum + u.totalSpending, 0);

    return NextResponse.json({
      users,
      models,
      summary: {
        totalRequests,
        totalSpending,
        activeUsers: users.length,
        modelsUsed: models.length,
      },
      day,
      month,
      year,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/dashboard/daily-detail");
  }
}
