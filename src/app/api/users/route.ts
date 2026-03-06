import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UserEntity } from "@/entities/user.entity";
import { createUserSchema } from "@/lib/validations/user";
import { hashPassword } from "@/lib/auth";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import { UserRole } from "@/entities/enums";
import { validateBody, isValidationError, handleRouteError } from "@/lib/api-helpers";
import { getAuthMethod } from "@/lib/auth-config";

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  try {
    const dataSource = await getDb();
    const userRepo = dataSource.getRepository(UserEntity);
    const users = await userRepo.find({
      order: { createdAt: "ASC" },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/users");
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  if (getAuthMethod() === "azure") {
    return NextResponse.json(
      { error: "User management is disabled when Azure AD authentication is active. Access is managed through Azure AD." },
      { status: 403 },
    );
  }

  const parsed = await validateBody(request, createUserSchema);
  if (isValidationError(parsed)) return parsed;

  const { username, password, role } = parsed.data;

  try {
    const dataSource = await getDb();
    const userRepo = dataSource.getRepository(UserEntity);

    const passwordHash = await hashPassword(password);
    const user = userRepo.create({ username, passwordHash, role: role ?? UserRole.USER });
    const saved = await userRepo.save(user);

    return NextResponse.json(
      {
        id: saved.id,
        username: saved.username,
        role: saved.role,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, "POST /api/users", {
      uniqueViolationMessage: "Username already exists",
    });
  }
}
