import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TeamEntity } from "@/entities/team.entity";
import { TeamMemberSnapshotEntity } from "@/entities/team-member-snapshot.entity";
import { updateTeamSchema } from "@/lib/validations/team";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import {
  parseEntityId,
  invalidIdResponse,
  validateBody,
  isValidationError,
  handleRouteError,
} from "@/lib/api-helpers";
import { NotFoundError } from "@/lib/errors";
import { IsNull } from "typeorm";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("team");

  const parsed = await validateBody(request, updateTeamSchema);
  if (isValidationError(parsed)) return parsed;

  const { name } = parsed.data;

  try {
    const dataSource = await getDb();
    const teamRepo = dataSource.getRepository(TeamEntity);

    const team = await teamRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    team.name = name;
    const saved = await teamRepo.save(team);

    return NextResponse.json({
      id: saved.id,
      name: saved.name,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return handleRouteError(error, "PUT /api/teams/[id]", {
      uniqueViolationMessage: "Team name already exists",
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("team");

  try {
    const dataSource = await getDb();

    await dataSource.transaction(async (manager) => {
      const teamRepo = manager.getRepository(TeamEntity);
      const snapshotRepo = manager.getRepository(TeamMemberSnapshotEntity);

      const team = await teamRepo.findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!team) {
        throw new NotFoundError("Team not found");
      }

      // Remove current-month member snapshots
      const now = new Date();
      const currentMonth = now.getUTCMonth() + 1;
      const currentYear = now.getUTCFullYear();

      await snapshotRepo
        .createQueryBuilder()
        .delete()
        .where('"teamId" = :teamId AND "month" = :month AND "year" = :year', {
          teamId: id,
          month: currentMonth,
          year: currentYear,
        })
        .execute();

      // Soft-delete the team
      team.deletedAt = now;
      await teamRepo.save(team);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/teams/[id]");
  }
}
