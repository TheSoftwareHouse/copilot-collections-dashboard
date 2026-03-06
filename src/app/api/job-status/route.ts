import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { JobExecutionEntity } from "@/entities/job-execution.entity";
import { JobType } from "@/entities/enums";
import { requireAdmin, isAuthFailure } from "@/lib/api-auth";
import { handleRouteError } from "@/lib/api-helpers";

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthFailure(auth)) return auth;

  try {
    const dataSource = await getDb();
    const repository = dataSource.getRepository(JobExecutionEntity);

    const [seatSync, usageCollection, teamCarryForward, monthRecollection] = await Promise.all(
      [JobType.SEAT_SYNC, JobType.USAGE_COLLECTION, JobType.TEAM_CARRY_FORWARD, JobType.MONTH_RECOLLECTION].map((jobType) =>
        repository.findOne({
          where: { jobType },
          order: { startedAt: "DESC" },
        })
      )
    );

    return NextResponse.json({
      seatSync: seatSync
        ? {
            id: seatSync.id,
            jobType: seatSync.jobType,
            status: seatSync.status,
            startedAt: seatSync.startedAt,
            completedAt: seatSync.completedAt,
            errorMessage: seatSync.errorMessage,
            recordsProcessed: seatSync.recordsProcessed,
          }
        : null,
      usageCollection: usageCollection
        ? {
            id: usageCollection.id,
            jobType: usageCollection.jobType,
            status: usageCollection.status,
            startedAt: usageCollection.startedAt,
            completedAt: usageCollection.completedAt,
            errorMessage: usageCollection.errorMessage,
            recordsProcessed: usageCollection.recordsProcessed,
          }
        : null,
      teamCarryForward: teamCarryForward
        ? {
            id: teamCarryForward.id,
            jobType: teamCarryForward.jobType,
            status: teamCarryForward.status,
            startedAt: teamCarryForward.startedAt,
            completedAt: teamCarryForward.completedAt,
            errorMessage: teamCarryForward.errorMessage,
            recordsProcessed: teamCarryForward.recordsProcessed,
          }
        : null,
      monthRecollection: monthRecollection
        ? {
            id: monthRecollection.id,
            jobType: monthRecollection.jobType,
            status: monthRecollection.status,
            startedAt: monthRecollection.startedAt,
            completedAt: monthRecollection.completedAt,
            errorMessage: monthRecollection.errorMessage,
            recordsProcessed: monthRecollection.recordsProcessed,
          }
        : null,
    });
  } catch (error) {
    return handleRouteError(error, "GET /api/job-status");
  }
}
