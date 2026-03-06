import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { UserEntity } from "@/entities/user.entity";
import { SessionEntity } from "@/entities/session.entity";
import { getAuthMethod } from "@/lib/auth-config";
import { isUniqueViolation } from "@/lib/db-errors";
import { UserRole } from "@/entities/enums";

const BCRYPT_ROUNDS = 10;

export const SESSION_COOKIE_NAME = "session_token";

export function getSessionTimeoutSeconds(): number {
  const hours = parseInt(process.env.SESSION_TIMEOUT_HOURS || "24", 10);
  return hours * 60 * 60;
}

function getSessionTimeoutMs(): number {
  return getSessionTimeoutSeconds() * 1000;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  userId: number,
  refreshToken?: string | null,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + getSessionTimeoutMs());

  const dataSource = await getDb();
  const sessionRepo = dataSource.getRepository(SessionEntity);
  await sessionRepo.save({
    token,
    userId,
    expiresAt,
    refreshToken: refreshToken ?? null,
  });

  return token;
}

export async function getSession(): Promise<{
  user: { id: number; username: string; role: string };
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const dataSource = await getDb();
  const sessionRepo = dataSource.getRepository(SessionEntity);

  // Query without expiresAt filter — we handle expiry ourselves to allow refresh
  const session = await sessionRepo.findOne({ where: { token } });

  if (!session) {
    return null;
  }

  const isExpired = session.expiresAt.getTime() <= Date.now();

  if (isExpired) {
    // Attempt silent Azure token refresh if applicable
    if (
      session.refreshToken &&
      getAuthMethod() === "azure"
    ) {
      const { refreshAzureSession } = await import("@/lib/azure-auth");
      const refreshed = await refreshAzureSession(
        session.id,
        session.refreshToken,
      );

      if (!refreshed) {
        return null; // Session was destroyed by refreshAzureSession
      }

      // Re-query the now-refreshed session
      const refreshedSession = await sessionRepo.findOne({
        where: { id: session.id },
      });
      if (!refreshedSession) {
        return null;
      }

      const userRepo = dataSource.getRepository(UserEntity);
      const user = await userRepo.findOne({
        where: { id: refreshedSession.userId },
      });
      if (!user) {
        return null;
      }

      return { user: { id: user.id, username: user.username, role: user.role } };
    }

    // No refresh token or not Azure mode — destroy expired session
    await sessionRepo.delete(session.id);
    return null;
  }

  const userRepo = dataSource.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { id: session.userId } });
  if (!user) {
    return null;
  }

  // Sliding window: refresh expiry on each valid access
  session.expiresAt = new Date(Date.now() + getSessionTimeoutMs());
  await sessionRepo.save(session);

  return { user: { id: user.id, username: user.username, role: user.role } };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return;
  }

  const dataSource = await getDb();
  const sessionRepo = dataSource.getRepository(SessionEntity);
  await sessionRepo.delete({ token });
}

export async function seedDefaultAdmin(): Promise<void> {
  const username = process.env.DEFAULT_ADMIN_USERNAME;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      "seedDefaultAdmin: DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD env vars are not set. Skipping admin seed.",
    );
    return;
  }

  const dataSource = await getDb();
  const userRepo = dataSource.getRepository(UserEntity);

  const existingAdmin = await userRepo.findOne({ where: { username } });

  if (existingAdmin) {
    if (existingAdmin.role !== UserRole.ADMIN) {
      await userRepo.update(existingAdmin.id, { role: UserRole.ADMIN });
    }
    return;
  }

  const userCount = await userRepo.count();
  if (userCount > 0) {
    return;
  }

  const passwordHash = await hashPassword(password);
  try {
    await userRepo.save({ username, passwordHash, role: UserRole.ADMIN });
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }
}
