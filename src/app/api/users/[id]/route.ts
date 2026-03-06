import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UserEntity } from "@/entities/user.entity";
import { UserRole } from "@/entities/enums";
import { updateUserSchema } from "@/lib/validations/user";
import { hashPassword } from "@/lib/auth";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import {
  parseEntityId,
  invalidIdResponse,
  validateBody,
  isValidationError,
  handleRouteError,
} from "@/lib/api-helpers";
import { getAuthMethod } from "@/lib/auth-config";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
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

  const parsed = await validateBody(request, updateUserSchema);
  if (isValidationError(parsed)) return parsed;

  const { username, password, role } = parsed.data;

  if (role !== undefined && auth.user.id === id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 403 },
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

    if (role !== undefined && user.role === UserRole.ADMIN && role === UserRole.USER) {
      const adminCount = await userRepo.count({ where: { role: UserRole.ADMIN } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last remaining admin" },
          { status: 409 },
        );
      }
    }

    if (username !== undefined) {
      user.username = username;
    }
    if (password !== undefined) {
      user.passwordHash = await hashPassword(password);
    }
    if (role !== undefined) {
      user.role = role;
    }

    const saved = await userRepo.save(user);

    return NextResponse.json({
      id: saved.id,
      username: saved.username,
      role: saved.role,
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
  const auth = await requireAdmin();
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
