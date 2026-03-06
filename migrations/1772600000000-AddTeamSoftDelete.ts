import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeamSoftDelete1772600000000 implements MigrationInterface {
    name = 'AddTeamSoftDelete1772600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "team" ADD "deletedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_team_name_active" ON "team" ("name") WHERE "deletedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_team_name_active"`);
        await queryRunner.query(`ALTER TABLE "team" DROP COLUMN "deletedAt"`);
    }

}
