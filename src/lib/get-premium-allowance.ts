import { getDb } from "@/lib/db";
import { ConfigurationEntity } from "@/entities/configuration.entity";
import { PREMIUM_REQUESTS_PER_SEAT } from "@/lib/constants";

/** Cache TTL in milliseconds (60 seconds). */
const CACHE_TTL_MS = 60_000;

let cachedValue: number | null = null;
let cachedAt = 0;

/**
 * Read the configured premium request allowance per seat from the
 * Configuration table. Falls back to the PREMIUM_REQUESTS_PER_SEAT constant
 * (300) when no configuration row exists or the field is not set.
 *
 * The result is cached in memory for up to 60 seconds to avoid hitting the
 * database on every API request. Call {@link invalidatePremiumAllowanceCache}
 * after updating the configuration.
 */
export async function getPremiumAllowance(): Promise<number> {
  const now = Date.now();
  if (cachedValue !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedValue;
  }

  try {
    const dataSource = await getDb();
    const repository = dataSource.getRepository(ConfigurationEntity);
    const config = await repository.findOne({ where: {} });

    if (config != null && config.premiumRequestsPerSeat != null) {
      cachedValue = config.premiumRequestsPerSeat;
      cachedAt = now;
      return cachedValue;
    }
  } catch {
    // Graceful fallback — configuration table may not exist yet during
    // initial migrations or when the database is not ready.
  }

  cachedValue = PREMIUM_REQUESTS_PER_SEAT;
  cachedAt = now;
  return cachedValue;
}

/**
 * Invalidate the in-memory cache so the next call to
 * {@link getPremiumAllowance} re-reads from the database.
 */
export function invalidatePremiumAllowanceCache(): void {
  cachedValue = null;
  cachedAt = 0;
}
