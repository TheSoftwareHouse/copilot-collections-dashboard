import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPremiumRequestsPerSeat1772800000000 implements MigrationInterface {
    name = 'AddPremiumRequestsPerSeat1772800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "configuration" ADD "premiumRequestsPerSeat" integer NOT NULL DEFAULT 300`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "configuration" DROP COLUMN "premiumRequestsPerSeat"`);
    }

}
