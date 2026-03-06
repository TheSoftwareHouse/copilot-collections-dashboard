import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, isAuthFailure } from "@/lib/api-auth";
import { getPremiumAllowance } from "@/lib/get-premium-allowance";
import { handleRouteError, escapeLikePattern } from "@/lib/api-helpers";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthFailure(auth)) return auth;

  try {
    const { searchParams } = request.nextUrl;

    const now = new Date();
    const defaultMonth = now.getUTCMonth() + 1;
    const defaultYear = now.getUTCFullYear();

    let month = parseInt(searchParams.get("month") ?? "", 10);
    if (isNaN(month) || month < 1 || month > 12) month = defaultMonth;

    let year = parseInt(searchParams.get("year") ?? "", 10);
    if (isNaN(year) || year < 2020) year = defaultYear;

    let page = parseInt(searchParams.get("page") ?? "", 10);
    if (isNaN(page) || page < 1) page = DEFAULT_PAGE;

    let pageSize = parseInt(searchParams.get("pageSize") ?? "", 10);
    if (isNaN(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

    const searchParam = (searchParams.get("search") ?? "").trim();

    const dataSource = await getDb();
    const premiumRequestsPerSeat = await getPremiumAllowance();

    // Build optional search filter
    if (searchParam) {
      const escaped = escapeLikePattern(searchParam);
      const likePattern = `%${escaped}%`;

      const searchJoin = `
       JOIN copilot_seat cs_filter ON cs_filter.id = cu."seatId"`;
      const searchWhere = `
         AND (cs_filter."githubUsername" ILIKE $3
              OR cs_filter."firstName" ILIKE $3
              OR cs_filter."lastName" ILIKE $3)`;

      // Count query with search filter
      const countResult: { count: string }[] = await dataSource.query(
        `SELECT COUNT(DISTINCT cu."seatId") AS "count"
         FROM copilot_usage cu${searchJoin}
         WHERE cu."month" = $1 AND cu."year" = $2${searchWhere}`,
        [month, year, likePattern],
      );

      const total = parseInt(countResult[0]?.count ?? "0", 10);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const offset = (page - 1) * pageSize;

      if (total === 0) {
        return NextResponse.json({
          seats: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
          month,
          year,
          premiumRequestsPerSeat,
        });
      }

      // Main query with search filter
      const rows: {
        seatId: number;
        githubUsername: string;
        firstName: string | null;
        lastName: string | null;
        department: string | null;
        totalRequests: string;
        totalGrossAmount: string;
        totalNetAmount: string;
        models: string;
      }[] = await dataSource.query(
        `WITH seat_models AS (
           SELECT
             cu."seatId",
             item->>'model' AS model,
             SUM((item->>'grossQuantity')::numeric) AS requests,
             SUM((item->>'grossAmount')::numeric) AS "grossAmount",
             SUM((item->>'netAmount')::numeric) AS "netAmount"
           FROM copilot_usage cu${searchJoin},
                jsonb_array_elements(cu."usageItems") AS item
           WHERE cu."month" = $1 AND cu."year" = $2${searchWhere}
           GROUP BY cu."seatId", item->>'model'
         ),
         seat_totals AS (
           SELECT
             sm."seatId",
             SUM(sm.requests) AS "totalRequests",
             SUM(sm."grossAmount") AS "totalGrossAmount",
             SUM(sm."netAmount") AS "totalNetAmount",
             jsonb_agg(
               jsonb_build_object(
                 'model', sm.model,
                 'requests', sm.requests,
                 'grossAmount', sm."grossAmount",
                 'netAmount', sm."netAmount"
               ) ORDER BY sm.requests DESC
             ) AS models
           FROM seat_models sm
           GROUP BY sm."seatId"
         )
         SELECT
           st."seatId",
           cs."githubUsername",
           cs."firstName",
           cs."lastName",
           cs."department",
           st."totalRequests",
           st."totalGrossAmount",
           st."totalNetAmount",
           st.models::text AS models
         FROM seat_totals st
         JOIN copilot_seat cs ON cs.id = st."seatId"
         ORDER BY st."totalRequests" DESC
         LIMIT $4 OFFSET $5`,
        [month, year, likePattern, pageSize, offset],
      );

      const seats = rows.map((row) => ({
        seatId: row.seatId,
        githubUsername: row.githubUsername,
        firstName: row.firstName,
        lastName: row.lastName,
        department: row.department,
        totalRequests: Number(row.totalRequests),
        totalGrossAmount: Number(row.totalGrossAmount),
        totalNetAmount: Number(row.totalNetAmount),
        models: (JSON.parse(row.models) as { model: string; requests: number; grossAmount: number; netAmount: number }[]).map((m) => ({
          model: m.model,
          requests: Number(m.requests),
          grossAmount: Number(m.grossAmount),
          netAmount: Number(m.netAmount),
        })),
      }));

      return NextResponse.json({
        seats,
        total,
        page,
        pageSize,
        totalPages,
        month,
        year,
        premiumRequestsPerSeat,
      });
    }

    // No search — existing logic unchanged

    // Count distinct seats with usage for this month/year
    const countResult: { count: string }[] = await dataSource.query(
      `SELECT COUNT(DISTINCT cu."seatId") AS "count"
       FROM copilot_usage cu
       WHERE cu."month" = $1 AND cu."year" = $2`,
      [month, year],
    );

    const total = parseInt(countResult[0]?.count ?? "0", 10);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    if (total === 0) {
      return NextResponse.json({
        seats: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
        month,
        year,
      });
    }

    // Aggregate per-seat per-model usage, then roll up to per-seat totals
    const rows: {
      seatId: number;
      githubUsername: string;
      firstName: string | null;
      lastName: string | null;
      department: string | null;
      totalRequests: string;
      totalGrossAmount: string;
      totalNetAmount: string;
      models: string;
    }[] = await dataSource.query(
      `WITH seat_models AS (
         SELECT
           cu."seatId",
           item->>'model' AS model,
           SUM((item->>'grossQuantity')::numeric) AS requests,
           SUM((item->>'grossAmount')::numeric) AS "grossAmount",
           SUM((item->>'netAmount')::numeric) AS "netAmount"
         FROM copilot_usage cu,
              jsonb_array_elements(cu."usageItems") AS item
         WHERE cu."month" = $1 AND cu."year" = $2
         GROUP BY cu."seatId", item->>'model'
       ),
       seat_totals AS (
         SELECT
           sm."seatId",
           SUM(sm.requests) AS "totalRequests",
           SUM(sm."grossAmount") AS "totalGrossAmount",
           SUM(sm."netAmount") AS "totalNetAmount",
           jsonb_agg(
             jsonb_build_object(
               'model', sm.model,
               'requests', sm.requests,
               'grossAmount', sm."grossAmount",
               'netAmount', sm."netAmount"
             ) ORDER BY sm.requests DESC
           ) AS models
         FROM seat_models sm
         GROUP BY sm."seatId"
       )
       SELECT
         st."seatId",
         cs."githubUsername",
         cs."firstName",
         cs."lastName",
         cs."department",
         st."totalRequests",
         st."totalGrossAmount",
         st."totalNetAmount",
         st.models::text AS models
       FROM seat_totals st
       JOIN copilot_seat cs ON cs.id = st."seatId"
       ORDER BY st."totalRequests" DESC
       LIMIT $3 OFFSET $4`,
      [month, year, pageSize, offset],
    );

    const seats = rows.map((row) => ({
      seatId: row.seatId,
      githubUsername: row.githubUsername,
      firstName: row.firstName,
      lastName: row.lastName,
      department: row.department,
      totalRequests: Number(row.totalRequests),
      totalGrossAmount: Number(row.totalGrossAmount),
      totalNetAmount: Number(row.totalNetAmount),
      models: (JSON.parse(row.models) as { model: string; requests: number; grossAmount: number; netAmount: number }[]).map((m) => ({
        model: m.model,
        requests: Number(m.requests),
        grossAmount: Number(m.grossAmount),
        netAmount: Number(m.netAmount),
      })),
    }));

    return NextResponse.json({
      seats,
      total,
      page,
      pageSize,
      totalPages,
      month,
      year,
      premiumRequestsPerSeat,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/usage/seats");
  }
}
