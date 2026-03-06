import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTeamTables1772400000000 implements MigrationInterface {
    name = 'CreateTeamTables1772400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "team" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_team" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "team_member_snapshot" ("id" SERIAL NOT NULL, "teamId" integer NOT NULL, "seatId" integer NOT NULL, "month" smallint NOT NULL, "year" smallint NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_team_member_snapshot" UNIQUE ("teamId", "seatId", "month", "year"), CONSTRAINT "PK_team_member_snapshot" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_team_member_snapshot_team_month" ON "team_member_snapshot" ("teamId", "month", "year")`);
        await queryRunner.query(`CREATE INDEX "IDX_team_member_snapshot_seat" ON "team_member_snapshot" ("seatId")`);
        await queryRunner.query(`ALTER TABLE "team_member_snapshot" ADD CONSTRAINT "FK_team_member_snapshot_team" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_member_snapshot" ADD CONSTRAINT "FK_team_member_snapshot_seat" FOREIGN KEY ("seatId") REFERENCES "copilot_seat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "team_member_snapshot" DROP CONSTRAINT "FK_team_member_snapshot_seat"`);
        await queryRunner.query(`ALTER TABLE "team_member_snapshot" DROP CONSTRAINT "FK_team_member_snapshot_team"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_team_member_snapshot_seat"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_team_member_snapshot_team_month"`);
        await queryRunner.query(`DROP TABLE "team_member_snapshot"`);
        await queryRunner.query(`DROP TABLE "team"`);
    }

}
