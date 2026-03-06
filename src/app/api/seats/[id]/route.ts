import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { DepartmentEntity } from "@/entities/department.entity";
import { updateSeatSchema } from "@/lib/validations/seat";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import {
  parseEntityId,
  invalidIdResponse,
  parseJsonBody,
  isJsonParseError,
  handleRouteError,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("seat");

  const body = await parseJsonBody(request);
  if (isJsonParseError(body)) return body;

  const result = updateSeatSchema.safeParse(body);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const formErrors = result.error.flatten().formErrors;
    return NextResponse.json(
      {
        error: "Validation failed",
        details: { ...fieldErrors, _form: formErrors },
      },
      { status: 400 }
    );
  }

  const { firstName, lastName, department, departmentId } = result.data;

  try {
    const dataSource = await getDb();
    const seatRepo = dataSource.getRepository(CopilotSeatEntity);

    const seat = await seatRepo.findOne({ where: { id } });
    if (!seat) {
      return NextResponse.json(
        { error: "Seat not found" },
        { status: 404 }
      );
    }

    if (firstName !== undefined) {
      seat.firstName = firstName;
    }
    if (lastName !== undefined) {
      seat.lastName = lastName;
    }
    if (departmentId !== undefined) {
      if (departmentId === null) {
        seat.departmentId = null;
        seat.department = null;
      } else {
        const deptRepo = dataSource.getRepository(DepartmentEntity);
        const dept = await deptRepo.findOne({ where: { id: departmentId } });
        if (!dept) {
          return NextResponse.json(
            { error: "Department not found" },
            { status: 400 }
          );
        }
        seat.departmentId = dept.id;
        seat.department = dept.name;
      }
    } else if (department !== undefined) {
      seat.department = department;
    }

    const saved = await seatRepo.save(seat);

    return NextResponse.json({
      id: saved.id,
      githubUsername: saved.githubUsername,
      status: saved.status,
      firstName: saved.firstName,
      lastName: saved.lastName,
      department: saved.department,
      departmentId: saved.departmentId,
      lastActivityAt: saved.lastActivityAt,
      createdAt: saved.createdAt,
    });
  } catch (error) {
    return handleRouteError(error, "PUT /api/seats/[id]");
  }
}
