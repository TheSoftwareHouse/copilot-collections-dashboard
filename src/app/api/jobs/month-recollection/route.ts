import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import { executeMonthRecollection } from "@/lib/month-recollection";
import { handleRouteError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  try {
    const { searchParams } = request.nextUrl;
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    if (monthParam === null || yearParam === null) {
      return NextResponse.json(
        { error: "Both month and year query parameters are required." },
        { status: 400 },
      );
    }

    const month = parseInt(monthParam, 10);
    const year = parseInt(yearParam, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid month parameter. Must be between 1 and 12." },
        { status: 400 },
      );
    }

    if (isNaN(year) || year < 2020) {
      return NextResponse.json(
        { error: "Invalid year parameter. Must be 2020 or later." },
        { status: 400 },
      );
    }

    // Reject future months — there is no data to recollect
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      return NextResponse.json(
        { error: "Cannot recollect data for future months." },
        { status: 400 },
      );
    }

    const result = await executeMonthRecollection(month, year);

    if (result.skipped) {
      if (result.reason === "no_configuration") {
        return NextResponse.json(
          {
            error:
              "Configuration not found. Complete first-run setup before recollecting usage data.",
          },
          { status: 409 },
        );
      }
      if (result.reason === "already_running") {
        return NextResponse.json(
          {
            error:
              "A month recollection is already running. Please wait for it to complete.",
          },
          { status: 409 },
        );
      }
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
    return handleRouteError(error, "POST /api/jobs/month-recollection");
  }
}
