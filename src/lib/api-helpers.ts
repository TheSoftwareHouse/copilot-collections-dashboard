import { NextResponse } from "next/server";
import { isUniqueViolation } from "@/lib/db-errors";
import { NotFoundError } from "@/lib/errors";
import type { z } from "zod";

/**
 * Escape special characters in a SQL LIKE/ILIKE pattern.
 * Handles: backslash, percent, and underscore.
 */
export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Parse and validate JSON body from a request.
 * Returns the parsed body or a 400 NextResponse on failure.
 */
export async function parseJsonBody(
  request: Request,
): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}

/**
 * Type guard for checking if parseJsonBody returned an error response.
 */
export function isJsonParseError(
  result: unknown | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Parse a string ID parameter to a positive integer.
 * Returns the parsed number or null if invalid.
 */
export function parseEntityId(idParam: string): number | null {
  const id = Number(idParam);
  if (Number.isNaN(id) || !Number.isInteger(id) || id < 1) return null;
  return id;
}

/**
 * Parse month and year from URL search params with defaults from the current date.
 */
export function parseMonthYearParams(searchParams: URLSearchParams): {
  month: number;
  year: number;
} {
  const now = new Date();
  const defaultMonth = now.getUTCMonth() + 1;
  const defaultYear = now.getUTCFullYear();

  let month = parseInt(searchParams.get("month") ?? "", 10);
  if (isNaN(month) || month < 1 || month > 12) month = defaultMonth;

  let year = parseInt(searchParams.get("year") ?? "", 10);
  if (isNaN(year) || year < 2020) year = defaultYear;

  return { month, year };
}

/**
 * Get the current month and year in UTC.
 */
export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

/**
 * Return a standardised 400 response for an invalid entity ID.
 */
export function invalidIdResponse(entityName: string): NextResponse {
  return NextResponse.json(
    { error: `Invalid ${entityName} ID` },
    { status: 400 },
  );
}

/**
 * Parse JSON body from a request and validate it against a Zod schema.
 * Returns the validated data or a 400 NextResponse on failure.
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | NextResponse> {
  const body = await parseJsonBody(request);
  if (isJsonParseError(body)) return body;

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  return { data: result.data };
}

/**
 * Type guard to check if a validateBody result is an error response.
 */
export function isValidationError<T>(
  result: { data: T } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Shared error handler for API route catch blocks.
 * Handles NotFoundError, unique constraint violations, and generic errors.
 */
export function handleRouteError(
  error: unknown,
  routeName: string,
  options?: { uniqueViolationMessage?: string },
): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (options?.uniqueViolationMessage && isUniqueViolation(error)) {
    return NextResponse.json(
      { error: options.uniqueViolationMessage },
      { status: 409 },
    );
  }
  console.error(`${routeName} failed:`, error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  );
}
