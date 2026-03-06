import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJobExecution1772225809783 implements MigrationInterface {
    name = 'CreateJobExecution1772225809783'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."job_execution_jobtype_enum" AS ENUM('seat_sync', 'usage_collection')`);
        await queryRunner.query(`CREATE TYPE "public"."job_execution_status_enum" AS ENUM('success', 'failure', 'running')`);
        await queryRunner.query(`CREATE TABLE "job_execution" ("id" SERIAL NOT NULL, "jobType" "public"."job_execution_jobtype_enum" NOT NULL, "status" "public"."job_execution_status_enum" NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "completedAt" TIMESTAMP WITH TIME ZONE, "errorMessage" text, "recordsProcessed" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_81e54343e6d62f09a166d105792" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_job_execution_type_started" ON "job_execution" ("jobType", "startedAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_job_execution_type_started"`);
        await queryRunner.query(`DROP TABLE "job_execution"`);
        await queryRunner.query(`DROP TYPE "public"."job_execution_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."job_execution_jobtype_enum"`);
    }

}
