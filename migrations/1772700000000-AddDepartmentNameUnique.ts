import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentNameUnique1772700000000 implements MigrationInterface {
    name = 'AddDepartmentNameUnique1772700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_department_name" ON "department" ("name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_department_name"`);
    }

}
