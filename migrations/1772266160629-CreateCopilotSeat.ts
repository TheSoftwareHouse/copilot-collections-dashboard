import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCopilotSeat1772266160629 implements MigrationInterface {
    name = 'CreateCopilotSeat1772266160629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."copilot_seat_status_enum" AS ENUM('active', 'inactive')`);
        await queryRunner.query(`CREATE TABLE "copilot_seat" ("id" SERIAL NOT NULL, "githubUsername" character varying(255) NOT NULL, "githubUserId" integer NOT NULL, "status" "public"."copilot_seat_status_enum" NOT NULL DEFAULT 'active', "firstName" character varying(255), "lastName" character varying(255), "department" character varying(255), "assignedAt" TIMESTAMP WITH TIME ZONE, "lastActivityAt" TIMESTAMP WITH TIME ZONE, "lastActivityEditor" character varying(255), "planType" character varying(50), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7fa48b4f2c7de3e43e8133cd407" UNIQUE ("githubUsername"), CONSTRAINT "PK_bd8f2c7e6ae8a05004094cea444" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_copilot_seat_status" ON "copilot_seat" ("status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_copilot_seat_status"`);
        await queryRunner.query(`DROP TABLE "copilot_seat"`);
        await queryRunner.query(`DROP TYPE "public"."copilot_seat_status_enum"`);
    }

}
