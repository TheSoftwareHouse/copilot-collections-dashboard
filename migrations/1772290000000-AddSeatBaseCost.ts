import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSeatBaseCost1772290000000 implements MigrationInterface {
    name = 'AddSeatBaseCost1772290000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dashboard_monthly_summary" ADD "seatBaseCost" numeric(19,4) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dashboard_monthly_summary" DROP COLUMN "seatBaseCost"`);
    }

}
