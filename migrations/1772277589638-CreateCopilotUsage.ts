import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCopilotUsage1772277589638 implements MigrationInterface {
    name = 'CreateCopilotUsage1772277589638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "copilot_usage" ("id" SERIAL NOT NULL, "seatId" integer NOT NULL, "day" smallint NOT NULL, "month" smallint NOT NULL, "year" smallint NOT NULL, "usageItems" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_copilot_usage_seat_day" UNIQUE ("seatId", "day", "month", "year"), CONSTRAINT "PK_d310fdd37ca31cc6d6a7f23c962" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_copilot_usage_seat_id" ON "copilot_usage" ("seatId") `);
        await queryRunner.query(`CREATE INDEX "IDX_copilot_usage_year_month" ON "copilot_usage" ("year", "month") `);
        await queryRunner.query(`ALTER TABLE "copilot_usage" ADD CONSTRAINT "FK_81ff968d4890e094aafeb576ec4" FOREIGN KEY ("seatId") REFERENCES "copilot_seat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "copilot_usage" DROP CONSTRAINT "FK_81ff968d4890e094aafeb576ec4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_copilot_usage_year_month"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_copilot_usage_seat_id"`);
        await queryRunner.query(`DROP TABLE "copilot_usage"`);
    }

}
