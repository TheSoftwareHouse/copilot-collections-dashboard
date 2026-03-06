import type { Page } from "@playwright/test";
import { getClient } from "./db";

/**
 * Seed a test user directly in the database with a bcrypt-hashed password.
 */
export async function seedTestUser(
  username: string,
  password: string
): Promise<void> {
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.hash(password, 10);
  const client = await getClient();
  await client.query(
    `INSERT INTO app_user ("username", "passwordHash") VALUES ($1, $2)
     ON CONFLICT ("username") DO NOTHING`,
    [username, hash]
  );
  await client.end();
}

/**
 * Log in via the API and set the session cookie on the page context.
 */
export async function loginViaApi(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { username, password },
  });
  if (response.status() !== 200) {
    throw new Error(
      `Login failed with status ${response.status()}: ${await response.text()}`
    );
  }
}

/**
 * Clear all auth-related data (sessions and users) from the database.
 */
export async function clearAuthData(): Promise<void> {
  const client = await getClient();
  await client.query("DELETE FROM session");
  await client.query("DELETE FROM app_user");
  await client.end();
}
