import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/entities/enums";

type AuthSuccess = { user: { id: number; username: string; role: string } };
type AuthFailure = NextResponse;

export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return session;
}

export async function requireAdmin(): Promise<AuthSuccess | AuthFailure> {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  if (auth.user.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  return auth;
}

export function isAuthFailure(
  result: AuthSuccess | AuthFailure
): result is AuthFailure {
  return result instanceof NextResponse;
}
