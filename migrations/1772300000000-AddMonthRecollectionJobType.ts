import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMonthRecollectionJobType1772300000000 implements MigrationInterface {
    name = 'AddMonthRecollectionJobType1772300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."job_execution_jobtype_enum" ADD VALUE IF NOT EXISTS 'month_recollection'`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing a value from an enum type.
        // To fully revert, the enum would need to be recreated without the value,
        // which requires recreating the column. This is intentionally left as a no-op
        // because dropping the value is not worth the risk of data loss.
        console.warn(
            'Cannot remove enum value "month_recollection" from job_execution_jobtype_enum. ' +
            'PostgreSQL does not support DROP VALUE from enums. Manual intervention required if rollback is needed.'
        );
    }

}
