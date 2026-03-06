import { NextResponse } from "next/server";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { executeUsageCollection } from "@/lib/usage-collection";
import { handleRouteError } from "@/lib/api-helpers";

export async function POST() {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const result = await executeUsageCollection();

    if (result.skipped) {
      return NextResponse.json(
        {
          error:
            "Configuration not found. Complete first-run setup before collecting usage data.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      jobExecutionId: result.jobExecutionId,
      status: result.status,
      recordsProcessed: result.recordsProcessed ?? null,
      usersProcessed: result.usersProcessed ?? null,
      usersErrored: result.usersErrored ?? null,
      errorMessage: result.errorMessage ?? null,
    });
  } catch (error) {
    return handleRouteError(error, "POST /api/jobs/usage-collection");
  }
}
