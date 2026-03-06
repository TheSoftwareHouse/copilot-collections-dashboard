import { MigrationInterface, QueryRunner } from "typeorm";

export class InitConfiguration1772221226048 implements MigrationInterface {
    name = 'InitConfiguration1772221226048'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."configuration_apimode_enum" AS ENUM('organisation', 'enterprise')`);
        await queryRunner.query(`CREATE TABLE "configuration" ("id" SERIAL NOT NULL, "apiMode" "public"."configuration_apimode_enum" NOT NULL, "entityName" character varying(255) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_03bad512915052d2342358f0d8b" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "configuration"`);
        await queryRunner.query(`DROP TYPE "public"."configuration_apimode_enum"`);
    }

}
