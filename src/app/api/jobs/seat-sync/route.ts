import { NextResponse } from "next/server";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { executeSeatSync } from "@/lib/seat-sync";
import { handleRouteError } from "@/lib/api-helpers";

export async function POST() {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const result = await executeSeatSync();

    if (result.skipped) {
      return NextResponse.json(
        {
          error:
            "Configuration not found. Complete first-run setup before syncing.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      jobExecutionId: result.jobExecutionId,
      status: result.status,
      recordsProcessed: result.recordsProcessed ?? null,
      recordsDeactivated: result.recordsDeactivated ?? null,
      errorMessage: result.errorMessage ?? null,
    });
  } catch (error) {
    return handleRouteError(error, "POST /api/jobs/seat-sync");
  }
}
