import { NextResponse } from "next/server";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { executeTeamCarryForward } from "@/lib/team-carry-forward";
import { handleRouteError } from "@/lib/api-helpers";

export async function POST() {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const result = await executeTeamCarryForward();

    if (result.skipped) {
      return NextResponse.json({
        skipped: true,
        reason: result.reason,
      });
    }

    return NextResponse.json({
      skipped: false,
      jobExecutionId: result.jobExecutionId,
      status: result.status,
      recordsProcessed: result.recordsProcessed ?? null,
      errorMessage: result.errorMessage ?? null,
    });
  } catch (error) {
    return handleRouteError(error, "POST /api/jobs/team-carry-forward");
  }
}
