import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import { handleRouteError } from "@/lib/api-helpers";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { CopilotUsageEntity } from "@/entities/copilot-usage.entity";
import { TeamEntity } from "@/entities/team.entity";
import { DepartmentEntity } from "@/entities/department.entity";
import { DashboardMonthlySummaryEntity } from "@/entities/dashboard-monthly-summary.entity";
import { IsNull } from "typeorm";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (isAuthFailure(auth)) return auth;

    const dataSource = await getDb();

    const [seats, usageRecords, teams, departments, monthlySummaries] =
      await Promise.all([
        dataSource.getRepository(CopilotSeatEntity).count(),
        dataSource.getRepository(CopilotUsageEntity).count(),
        dataSource
          .getRepository(TeamEntity)
          .count({ where: { deletedAt: IsNull() } }),
        dataSource.getRepository(DepartmentEntity).count(),
        dataSource.getRepository(DashboardMonthlySummaryEntity).count(),
      ]);

    return NextResponse.json({
      seats,
      usageRecords,
      teams,
      departments,
      monthlySummaries,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/github-app/disconnect-preview");
  }
}
