import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDepartmentTable1772500000000 implements MigrationInterface {
    name = 'CreateDepartmentTable1772500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "department" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_department" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "copilot_seat" ADD "departmentId" integer`);
        await queryRunner.query(`CREATE INDEX "IDX_copilot_seat_department" ON "copilot_seat"("departmentId")`);
        await queryRunner.query(`ALTER TABLE "copilot_seat" ADD CONSTRAINT "FK_copilot_seat_department" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "copilot_seat" DROP CONSTRAINT "FK_copilot_seat_department"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_copilot_seat_department"`);
        await queryRunner.query(`ALTER TABLE "copilot_seat" DROP COLUMN "departmentId"`);
        await queryRunner.query(`DROP TABLE "department"`);
    }

}
