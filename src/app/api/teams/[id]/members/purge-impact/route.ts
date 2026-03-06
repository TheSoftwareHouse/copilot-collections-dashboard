import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TeamEntity } from "@/entities/team.entity";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import { parseEntityId, invalidIdResponse, handleRouteError } from "@/lib/api-helpers";
import { IsNull } from "typeorm";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) {
    return invalidIdResponse("team");
  }

  const url = new URL(request.url);
  const seatIdParam = url.searchParams.get("seatId");
  const seatId = seatIdParam !== null ? parseEntityId(seatIdParam) : null;
  if (seatId === null) {
    return NextResponse.json(
      { error: "Invalid or missing seatId query parameter" },
      { status: 400 },
    );
  }

  try {
    const dataSource = await getDb();
    const teamRepo = dataSource.getRepository(TeamEntity);

    const team = await teamRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 },
      );
    }

    const rows: { count: string }[] = await dataSource.query(
      `SELECT COUNT(*) AS count FROM team_member_snapshot WHERE "teamId" = $1 AND "seatId" = $2`,
      [id, seatId],
    );

    const months = Number(rows[0].count);

    return NextResponse.json({ months });
  } catch (error) {
    return handleRouteError(error, "GET /api/teams/[id]/members/purge-impact");
  }
}
