import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDashboardMonthlySummary1772284213080 implements MigrationInterface {
    name = 'CreateDashboardMonthlySummary1772284213080'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dashboard_monthly_summary" ("id" SERIAL NOT NULL, "month" smallint NOT NULL, "year" smallint NOT NULL, "totalSeats" integer NOT NULL DEFAULT '0', "activeSeats" integer NOT NULL DEFAULT '0', "totalSpending" numeric(19,4) NOT NULL DEFAULT '0', "modelUsage" jsonb NOT NULL DEFAULT '[]', "mostActiveUsers" jsonb NOT NULL DEFAULT '[]', "leastActiveUsers" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dashboard_monthly_summary_month_year" UNIQUE ("month", "year"), CONSTRAINT "PK_3ecc4880aa096f8a3a9fdd4ee36" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dashboard_monthly_summary"`);
    }

}
