import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UserEntity } from "@/entities/user.entity";
import { updateUserSchema } from "@/lib/validations/user";
import { hashPassword } from "@/lib/auth";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import {
  parseEntityId,
  invalidIdResponse,
  parseJsonBody,
  isJsonParseError,
  handleRouteError,
} from "@/lib/api-helpers";
import { getAuthMethod } from "@/lib/auth-config";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  if (getAuthMethod() === "azure") {
    return NextResponse.json(
      { error: "User management is disabled when Azure AD authentication is active. Access is managed through Azure AD." },
      { status: 403 },
    );
  }

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("user");

  const body = await parseJsonBody(request);
  if (isJsonParseError(body)) return body;

  const result = updateUserSchema.safeParse(body);
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

  const { username, password } = result.data;

  try {
    const dataSource = await getDb();
    const userRepo = dataSource.getRepository(UserEntity);

    const user = await userRepo.findOne({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (username !== undefined) {
      user.username = username;
    }
    if (password !== undefined) {
      user.passwordHash = await hashPassword(password);
    }

    const saved = await userRepo.save(user);

    return NextResponse.json({
      id: saved.id,
      username: saved.username,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return handleRouteError(error, "PUT /api/users/[id]", {
      uniqueViolationMessage: "Username already exists",
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  if (getAuthMethod() === "azure") {
    return NextResponse.json(
      { error: "User management is disabled when Azure AD authentication is active. Access is managed through Azure AD." },
      { status: 403 },
    );
  }

  const { id: idParam } = await context.params;
  const id = parseEntityId(idParam);
  if (id === null) return invalidIdResponse("user");

  if (auth.user.id === id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 403 }
    );
  }

  try {
    const dataSource = await getDb();
    const userRepo = dataSource.getRepository(UserEntity);

    const user = await userRepo.findOne({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    await userRepo.remove(user);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/users/[id]");
  }
}
