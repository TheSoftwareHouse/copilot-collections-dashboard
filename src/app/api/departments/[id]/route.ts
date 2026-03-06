import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { DepartmentEntity } from "@/entities/department.entity";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { updateDepartmentSchema } from "@/lib/validations/department";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import {
  parseEntityId,
  invalidIdResponse,
  validateBody,
  isValidationError,
  handleRouteError,
} from "@/lib/api-helpers";
import { NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("department");

  const parsed = await validateBody(request, updateDepartmentSchema);
  if (isValidationError(parsed)) return parsed;

  const { name } = parsed.data;

  try {
    const dataSource = await getDb();
    const deptRepo = dataSource.getRepository(DepartmentEntity);

    const dept = await deptRepo.findOne({ where: { id } });
    if (!dept) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    dept.name = name;
    const saved = await deptRepo.save(dept);

    return NextResponse.json({
      id: saved.id,
      name: saved.name,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return handleRouteError(error, "PUT /api/departments/[id]", {
      uniqueViolationMessage: "Department name already exists",
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("department");

  try {
    const dataSource = await getDb();

    await dataSource.transaction(async (manager) => {
      const deptRepo = manager.getRepository(DepartmentEntity);
      const seatRepo = manager.getRepository(CopilotSeatEntity);

      const dept = await deptRepo.findOne({ where: { id } });
      if (!dept) {
        throw new NotFoundError("Department not found");
      }

      await seatRepo
        .createQueryBuilder()
        .update()
        .set({ departmentId: null })
        .where('"departmentId" = :id', { id })
        .execute();

      await deptRepo.remove(dept);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/departments/[id]");
  }
}
