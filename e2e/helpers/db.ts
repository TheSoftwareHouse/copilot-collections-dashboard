import { Client } from "pg";

/**
 * Connection string for the test database.
 * All E2E tests and helpers must use this URL to avoid touching the main database.
 */
export const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ||
  "postgres://postgres:postgres@localhost:5432/copilot_dashboard_test";

/**
 * Create and return a connected pg Client pointing at the test database.
 * Caller is responsible for calling `client.end()` when finished.
 */
export async function getClient(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  return client;
}
