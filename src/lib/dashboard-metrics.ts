import { getDb } from "@/lib/db";
import { CopilotSeatEntity } from "@/entities/copilot-seat.entity";
import { SEAT_BASE_COST_USD } from "@/lib/constants";
import {
  DashboardMonthlySummaryEntity,
  type ModelUsageEntry,
  type UserActivityEntry,
} from "@/entities/dashboard-monthly-summary.entity";
import { SeatStatus } from "@/entities/enums";

/**
 * Recalculate and upsert dashboard metrics for the given month/year.
 *
 * Aggregates data from `copilot_seat` and `copilot_usage` tables and writes
 * the result into `dashboard_monthly_summary`. Called after successful
 * usage-collection and seat-sync jobs.
 */
export async function refreshDashboardMetrics(
  month: number,
  year: number,
): Promise<void> {
  const dataSource = await getDb();
  const seatRepository = dataSource.getRepository(CopilotSeatEntity);
  const summaryRepository = dataSource.getRepository(
    DashboardMonthlySummaryEntity,
  );

  // 1. Seat counts (current snapshot)
  const totalSeats = await seatRepository.count();
  const activeSeats = await seatRepository.count({
    where: { status: SeatStatus.ACTIVE },
  });

  // 2. Per-model usage: SUM(grossQuantity) and SUM(netAmount) grouped by model
  const modelUsageRows: { model: string; totalRequests: number; totalAmount: number }[] =
    await dataSource.query(
      `SELECT
         item->>'model' AS "model",
         SUM((item->>'grossQuantity')::numeric) AS "totalRequests",
         SUM((item->>'netAmount')::numeric) AS "totalAmount"
       FROM copilot_usage cu,
            jsonb_array_elements(cu."usageItems") AS item
       WHERE cu."month" = $1 AND cu."year" = $2
       GROUP BY item->>'model'
       ORDER BY "totalAmount" DESC`,
      [month, year],
    );

  const modelUsage: ModelUsageEntry[] = modelUsageRows.map((row) => ({
    model: row.model,
    totalRequests: Number(row.totalRequests),
    totalAmount: Number(row.totalAmount),
  }));

  // 3. Most active users: top 5 by SUM(grossQuantity)
  const mostActiveRows: {
    seatId: number;
    githubUsername: string;
    firstName: string | null;
    lastName: string | null;
    totalRequests: number;
    totalSpending: number;
  }[] = await dataSource.query(
    `SELECT
       cs.id AS "seatId",
       cs."githubUsername",
       cs."firstName",
       cs."lastName",
       SUM((item->>'grossQuantity')::numeric) AS "totalRequests",
       SUM((item->>'grossAmount')::numeric) AS "totalSpending"
     FROM copilot_usage cu
     JOIN copilot_seat cs ON cs.id = cu."seatId"
     CROSS JOIN jsonb_array_elements(cu."usageItems") AS item
     WHERE cu."month" = $1 AND cu."year" = $2
     GROUP BY cs.id, cs."githubUsername", cs."firstName", cs."lastName"
     ORDER BY "totalRequests" DESC
     LIMIT 5`,
    [month, year],
  );

  const mostActiveUsers: UserActivityEntry[] = mostActiveRows.map((row) => ({
    seatId: Number(row.seatId),
    githubUsername: row.githubUsername,
    firstName: row.firstName,
    lastName: row.lastName,
    totalRequests: Number(row.totalRequests),
    totalSpending: Number(row.totalSpending),
  }));

  // 4. Least active users: bottom 5 by SUM(grossQuantity) (with any usage)
  const leastActiveRows: {
    seatId: number;
    githubUsername: string;
    firstName: string | null;
    lastName: string | null;
    totalRequests: number;
    totalSpending: number;
  }[] = await dataSource.query(
    `SELECT
       cs.id AS "seatId",
       cs."githubUsername",
       cs."firstName",
       cs."lastName",
       SUM((item->>'grossQuantity')::numeric) AS "totalRequests",
       SUM((item->>'grossAmount')::numeric) AS "totalSpending"
     FROM copilot_usage cu
     JOIN copilot_seat cs ON cs.id = cu."seatId"
     CROSS JOIN jsonb_array_elements(cu."usageItems") AS item
     WHERE cu."month" = $1 AND cu."year" = $2
     GROUP BY cs.id, cs."githubUsername", cs."firstName", cs."lastName"
     ORDER BY "totalRequests" ASC
     LIMIT 5`,
    [month, year],
  );

  const leastActiveUsers: UserActivityEntry[] = leastActiveRows.map((row) => ({
    seatId: Number(row.seatId),
    githubUsername: row.githubUsername,
    firstName: row.firstName,
    lastName: row.lastName,
    totalRequests: Number(row.totalRequests),
    totalSpending: Number(row.totalSpending),
  }));

  // 5. Spending + premium request metrics (single scan)
  const aggregateResult: {
    netPremiumSpending: string | null;
    totalPremiumRequests: string | null;
    includedPremiumRequestsUsed: string | null;
  }[] = await dataSource.query(
    `SELECT
       COALESCE(SUM((item->>'netAmount')::numeric), 0)        AS "netPremiumSpending",
       COALESCE(SUM((item->>'grossQuantity')::numeric), 0)    AS "totalPremiumRequests",
       COALESCE(SUM((item->>'discountQuantity')::numeric), 0) AS "includedPremiumRequestsUsed"
     FROM copilot_usage cu,
          jsonb_array_elements(cu."usageItems") AS item
     WHERE cu."month" = $1 AND cu."year" = $2`,
    [month, year],
  );

  const netPremiumSpending = Number(aggregateResult[0]?.netPremiumSpending ?? 0);
  const totalPremiumRequests = Math.round(Number(aggregateResult[0]?.totalPremiumRequests ?? 0));
  const includedPremiumRequestsUsed = Math.round(Number(aggregateResult[0]?.includedPremiumRequestsUsed ?? 0));

  // Seat base cost: per active seat per month
  const seatBaseCost = activeSeats * SEAT_BASE_COST_USD;

  // Total spending = paid premium requests + seat license cost
  const totalSpending = netPremiumSpending + seatBaseCost;

  // 6. Upsert into dashboard_monthly_summary
  await summaryRepository
    .createQueryBuilder()
    .insert()
    .into(DashboardMonthlySummaryEntity)
    .values({
      month,
      year,
      totalSeats,
      activeSeats,
      totalSpending,
      seatBaseCost,
      totalPremiumRequests,
      includedPremiumRequestsUsed,
      modelUsage,
      mostActiveUsers,
      leastActiveUsers,
    })
    .orUpdate(
      [
        "totalSeats",
        "activeSeats",
        "totalSpending",
        "seatBaseCost",
        "totalPremiumRequests",
        "includedPremiumRequestsUsed",
        "modelUsage",
        "mostActiveUsers",
        "leastActiveUsers",
        "updatedAt",
      ],
      ["month", "year"],
    )
    .execute();

  console.log(`Dashboard metrics refreshed for ${month}/${year}`);
}
