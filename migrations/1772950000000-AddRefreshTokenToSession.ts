import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokenToSession1772950000000 implements MigrationInterface {
    name = 'AddRefreshTokenToSession1772950000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session" ADD "refreshToken" TEXT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "refreshToken"`);
    }

}
