import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPremiumRequestMetrics1772286855609 implements MigrationInterface {
    name = 'AddPremiumRequestMetrics1772286855609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dashboard_monthly_summary" ADD "totalPremiumRequests" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "dashboard_monthly_summary" ADD "includedPremiumRequestsUsed" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dashboard_monthly_summary" DROP COLUMN "includedPremiumRequestsUsed"`);
        await queryRunner.query(`ALTER TABLE "dashboard_monthly_summary" DROP COLUMN "totalPremiumRequests"`);
    }

}
