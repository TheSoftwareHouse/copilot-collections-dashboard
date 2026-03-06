/**
 * PostgreSQL database error helpers.
 */

/**
 * Check if an error is a PostgreSQL unique constraint violation (code 23505).
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Record<string, unknown>).code === "23505"
  );
}
