import { MigrationInterface, QueryRunner } from "typeorm";

export class DropRedundantSessionTokenIndex1772231511094 implements MigrationInterface {
    name = 'DropRedundantSessionTokenIndex1772231511094'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_session_token"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_session_token" ON "session" ("token") `);
    }

}
