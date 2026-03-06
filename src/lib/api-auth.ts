import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type AuthSuccess = { user: { id: number; username: string } };
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

export function isAuthFailure(
  result: AuthSuccess | AuthFailure
): result is AuthFailure {
  return result instanceof NextResponse;
}
