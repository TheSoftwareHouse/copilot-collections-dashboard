import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DashboardMonthlySummaryEntity } from "@/entities/dashboard-monthly-summary.entity";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { handleRouteError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const dataSource = await getDb();
    const summaryRepo = dataSource.getRepository(
      DashboardMonthlySummaryEntity,
    );

    const rows = await summaryRepo.find({
      select: ["month", "year"],
      order: { year: "DESC", month: "DESC" },
    });

    const months = rows.map((r) => ({ month: r.month, year: r.year }));

    return NextResponse.json({ months });
  } catch (error) {
    return handleRouteError(error, "GET /api/dashboard/months");
  }
}
