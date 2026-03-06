import cron from "node-cron";

/**
 * Default: daily at midnight UTC.
 * Override with SYNC_CRON_SCHEDULE (any valid cron expression)
 * or the legacy SYNC_INTERVAL_HOURS / SEAT_SYNC_INTERVAL_HOURS env vars.
 */
const DEFAULT_CRON = "0 0 * * *";

/**
 * Convert a whole-number hours value to a cron expression.
 * Examples: 24 → "0 0 * * *", 6 → "0 *​/6 * * *", 1 → "0 * * * *"
 */
function hoursToCron(hours: number): string | null {
  if (!Number.isInteger(hours) || hours <= 0 || hours > 24) return null;
  if (hours === 24) return "0 0 * * *";
  return `0 */${hours} * * *`;
}

function resolveCronSchedule(): string {
  // Prefer explicit cron expression
  const explicit = process.env.SYNC_CRON_SCHEDULE;
  if (explicit) {
    if (!cron.validate(explicit)) {
      console.error(`Invalid SYNC_CRON_SCHEDULE: "${explicit}". Falling back to default.`);
      return DEFAULT_CRON;
    }
    return explicit;
  }

  // Legacy: convert SYNC_INTERVAL_HOURS / SEAT_SYNC_INTERVAL_HOURS to cron
  const legacyRaw =
    process.env.SYNC_INTERVAL_HOURS || process.env.SEAT_SYNC_INTERVAL_HOURS;
  if (legacyRaw) {
    const hours = parseFloat(legacyRaw);
    const converted = hoursToCron(hours);
    if (converted) return converted;
    console.warn(
      `Cannot convert SYNC_INTERVAL_HOURS="${legacyRaw}" to cron. ` +
        `Use SYNC_CRON_SCHEDULE instead. Falling back to default.`,
    );
  }

  return DEFAULT_CRON;
}

export async function register() {
  console.log("Registering instrumentation...");
  console.log(`Runtime: ${process.env.NEXT_RUNTIME || "undefined"}`);
  console.log(`Schedule: ${process.env.SYNC_CRON_SCHEDULE || "not set"}`);
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Validate auth configuration early — fail fast on invalid config
  const { validateAuthConfig, getAuthMethod } = await import(
    "@/lib/auth-config"
  );
  validateAuthConfig();
  console.log(`Authentication method: ${getAuthMethod()}`);

  // Warn early if ENCRYPTION_KEY is missing — the app can start without it
  // (e.g. during migration period), but GitHub App credential storage will fail.
  if (!process.env.ENCRYPTION_KEY) {
    console.warn(
      "⚠ ENCRYPTION_KEY is not set. GitHub App credential storage will not work.",
    );
  }

  const seatSyncEnabled = process.env.SEAT_SYNC_ENABLED !== "false";
  const usageCollectionEnabled =
    process.env.USAGE_COLLECTION_ENABLED !== "false";

  if (!seatSyncEnabled && !usageCollectionEnabled) {
    console.log("All sync schedulers disabled");
    return;
  }

  const schedule = resolveCronSchedule();

  const runSyncCycle = async () => {
    console.log("Starting scheduled sync cycle");
    // Step 0: Team carry-forward (always runs; self-guards via idempotency check)
    try {
      const { executeTeamCarryForward } = await import(
        "@/lib/team-carry-forward"
      );
      const carryResult = await executeTeamCarryForward();
      if (carryResult.skipped) {
        console.log(`Team carry-forward skipped: ${carryResult.reason}`);
      }
    } catch (error) {
      console.error("Scheduled team carry-forward failed:", error);
    }

    // Step 1: Seat sync (if enabled)
    let seatSyncSucceeded = false;
    if (seatSyncEnabled) {
      try {
        const { executeSeatSync } = await import("@/lib/seat-sync");
        const result = await executeSeatSync();
        // "success" matches JobStatus.SUCCESS — avoiding top-level entity import
        seatSyncSucceeded = !result.skipped && result.status === "success";
      } catch (error) {
        console.error("Scheduled seat sync failed:", error);
      }
    } else {
      // If seat sync is disabled, don't block usage collection
      seatSyncSucceeded = true;
    }

    // Step 2: Usage collection (if enabled, and only after successful seat sync)
    if (usageCollectionEnabled) {
      if (seatSyncSucceeded) {
        try {
          const { executeUsageCollection } = await import(
            "@/lib/usage-collection"
          );
          await executeUsageCollection();
        } catch (error) {
          console.error("Scheduled usage collection failed:", error);
        }
      } else {
        console.warn(
          "Usage collection skipped: seat sync did not complete successfully",
        );
      }
    }
  };

  console.log(`Sync scheduler starting (cron: "${schedule}")`);
  cron.schedule(schedule, runSyncCycle, { timezone: "UTC" });

  // Either startup flag triggers the whole sequential cycle
  // (seat sync → usage collection), not just the individual job.
  const runOnStartup =
    process.env.SEAT_SYNC_RUN_ON_STARTUP === "true" ||
    process.env.USAGE_COLLECTION_RUN_ON_STARTUP === "true";

  if (runOnStartup) {
    console.log("Sync on startup enabled — scheduling initial cycle in 10s");
    setTimeout(runSyncCycle, 10_000);
  }
}
