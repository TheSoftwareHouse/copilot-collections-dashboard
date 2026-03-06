import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TeamEntity } from "@/entities/team.entity";
import { TeamMemberSnapshotEntity } from "@/entities/team-member-snapshot.entity";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { teamMembersSeatIdsSchema, teamMembersRemoveSchema } from "@/lib/validations/team-members";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { parseEntityId, getCurrentMonthYear, parseJsonBody, isJsonParseError, invalidIdResponse, handleRouteError } from "@/lib/api-helpers";
import { IsNull, In } from "typeorm";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) {
    return invalidIdResponse("team");
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

    const { month, year } = getCurrentMonthYear();

    const rows: {
      seatId: number;
      githubUsername: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
    }[] = await dataSource.query(
      `SELECT
         tms."seatId",
         cs."githubUsername",
         cs."firstName",
         cs."lastName",
         cs."status"
       FROM team_member_snapshot tms
       JOIN copilot_seat cs ON cs.id = tms."seatId"
       WHERE tms."teamId" = $1 AND tms.month = $2 AND tms.year = $3
       ORDER BY cs."githubUsername" ASC`,
      [id, month, year],
    );

    return NextResponse.json({
      members: rows.map((r) => ({
        seatId: r.seatId,
        githubUsername: r.githubUsername,
        firstName: r.firstName,
        lastName: r.lastName,
        status: r.status,
      })),
      month,
      year,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/teams/[id]/members");
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) {
    return invalidIdResponse("team");
  }

  const body = await parseJsonBody(request);
  if (isJsonParseError(body)) return body;

  const result = teamMembersSeatIdsSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { seatIds } = result.data;

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

    // Validate that all seatIds exist
    const seatRepo = dataSource.getRepository(CopilotSeatEntity);
    const existingSeats = await seatRepo.find({
      where: { id: In(seatIds) },
      select: { id: true },
    });
    const existingIds = new Set(existingSeats.map((s) => s.id));
    const invalidIds = seatIds.filter((sid) => !existingIds.has(sid));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some seat IDs do not exist",
          invalidSeatIds: invalidIds,
        },
        { status: 400 },
      );
    }

    const { month, year } = getCurrentMonthYear();

    // Count existing snapshots before insert so we can calculate how many were actually added
    const snapshotRepo = dataSource.getRepository(TeamMemberSnapshotEntity);
    const existingCount = await snapshotRepo.count({
      where: { teamId: id, month, year },
    });

    // Use raw query with ON CONFLICT DO NOTHING for idempotent inserts
    const values = seatIds
      .map((_, i) => `($1, $${i + 4}, $2, $3)`)
      .join(", ");

    const params = [id, month, year, ...seatIds];

    await dataSource.query(
      `INSERT INTO team_member_snapshot ("teamId", "seatId", "month", "year")
       VALUES ${values}
       ON CONFLICT ON CONSTRAINT "UQ_team_member_snapshot" DO NOTHING`,
      params,
    );

    const newCount = await snapshotRepo.count({
      where: { teamId: id, month, year },
    });
    const added = newCount - existingCount;

    return NextResponse.json({ added, month, year }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "POST /api/teams/[id]/members");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) {
    return invalidIdResponse("team");
  }

  const body = await parseJsonBody(request);
  if (isJsonParseError(body)) return body;

  const result = teamMembersRemoveSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { seatIds, mode } = result.data;

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

    const snapshotRepo = dataSource.getRepository(TeamMemberSnapshotEntity);

    if (mode === "purge") {
      const deleteResult = await snapshotRepo
        .createQueryBuilder()
        .delete()
        .where('"teamId" = :teamId AND "seatId" IN (:...seatIds)', {
          teamId: id,
          seatIds,
        })
        .execute();

      return NextResponse.json({
        removed: deleteResult.affected ?? 0,
        mode: "purge",
      });
    }

    const { month, year } = getCurrentMonthYear();

    const deleteResult = await snapshotRepo
      .createQueryBuilder()
      .delete()
      .where('"teamId" = :teamId AND "month" = :month AND "year" = :year AND "seatId" IN (:...seatIds)', {
        teamId: id,
        month,
        year,
        seatIds,
      })
      .execute();

    return NextResponse.json({
      removed: deleteResult.affected ?? 0,
      month,
      year,
    });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/teams/[id]/members");
  }
}
