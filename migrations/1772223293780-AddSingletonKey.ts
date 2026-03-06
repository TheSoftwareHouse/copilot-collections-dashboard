import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSingletonKey1772223293780 implements MigrationInterface {
    name = 'AddSingletonKey1772223293780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "configuration" ADD "singletonKey" character varying(10) NOT NULL DEFAULT 'GLOBAL'`);
        await queryRunner.query(`ALTER TABLE "configuration" ADD CONSTRAINT "UQ_18247c77bb98c454f370f108a9f" UNIQUE ("singletonKey")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "configuration" DROP CONSTRAINT "UQ_18247c77bb98c454f370f108a9f"`);
        await queryRunner.query(`ALTER TABLE "configuration" DROP COLUMN "singletonKey"`);
    }

}
