import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TeamEntity } from "@/entities/team.entity";
import { createTeamSchema } from "@/lib/validations/team";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import { validateBody, isValidationError, handleRouteError } from "@/lib/api-helpers";
import { IsNull } from "typeorm";
import { getPremiumAllowance } from "@/lib/get-premium-allowance";
import { calcUsagePercent } from "@/lib/usage-helpers";

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  try {
    const dataSource = await getDb();
    const premiumRequestsPerSeat = await getPremiumAllowance();

    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    const teamRepo = dataSource.getRepository(TeamEntity);
    const teams = await teamRepo.find({
      where: { deletedAt: IsNull() },
      order: { name: "ASC" },
    });

    // Aggregate current-month usage per team
    const usageRows: {
      teamId: number;
      memberCount: string;
      totalRequests: string;
      cappedTotalRequests: string;
    }[] = teams.length > 0
      ? await dataSource.query(
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
           )
           SELECT
             mu."teamId" AS "teamId",
             COUNT(DISTINCT mu."seatId")::int AS "memberCount",
             COALESCE(SUM(mu.requests), 0) AS "totalRequests",
             COALESCE(SUM(LEAST(mu.requests, $3)), 0) AS "cappedTotalRequests"
           FROM member_usage mu
           GROUP BY mu."teamId"`,
          [month, year, premiumRequestsPerSeat],
        )
      : [];

    const usageMap = new Map<number, { memberCount: number; cappedTotalRequests: number }>();
    for (const row of usageRows) {
      usageMap.set(row.teamId, {
        memberCount: Number(row.memberCount),
        cappedTotalRequests: Number(row.cappedTotalRequests),
      });
    }

    return NextResponse.json({
      teams: teams.map((t) => {
        const usage = usageMap.get(t.id);
        const memberCount = usage?.memberCount ?? 0;
        const cappedTotalRequests = usage?.cappedTotalRequests ?? 0;
        const usagePercent = calcUsagePercent(cappedTotalRequests, memberCount * premiumRequestsPerSeat);
        return {
          id: t.id,
          name: t.name,
          memberCount,
          usagePercent,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
      }),
      premiumRequestsPerSeat,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/teams");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const parsed = await validateBody(request, createTeamSchema);
  if (isValidationError(parsed)) return parsed;

  const { name } = parsed.data;

  try {
    const dataSource = await getDb();
    const teamRepo = dataSource.getRepository(TeamEntity);

    const team = teamRepo.create({ name });
    const saved = await teamRepo.save(team);

    return NextResponse.json(
      {
        id: saved.id,
        name: saved.name,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, "POST /api/teams", {
      uniqueViolationMessage: "Team name already exists",
    });
  }
}
