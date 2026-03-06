import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UserEntity } from "@/entities/user.entity";
import { loginSchema } from "@/lib/validations/login";
import {
  verifyPassword,
  createSession,
  seedDefaultAdmin,
  SESSION_COOKIE_NAME,
  getSessionTimeoutSeconds,
} from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { handleRouteError } from "@/lib/api-helpers";

export async function POST(request: Request) {
  // Ensure default admin exists on first access
  await seedDefaultAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { username, password } = result.data;

  try {
    const dataSource = await getDb();
    const userRepo = dataSource.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { username } });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await createSession(user.id);
    const maxAge = getSessionTimeoutSeconds();

    const response = NextResponse.json({ username: user.username });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    return handleRouteError(error, "POST /api/auth/login");
  }
}
