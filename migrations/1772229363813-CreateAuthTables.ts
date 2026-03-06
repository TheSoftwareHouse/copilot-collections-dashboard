import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthTables1772229363813 implements MigrationInterface {
    name = 'CreateAuthTables1772229363813'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "app_user" ("id" SERIAL NOT NULL, "username" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c480e576dd71729addbc2d51b67" UNIQUE ("username"), CONSTRAINT "PK_22a5c4a3d9b2fb8e4e73fc4ada1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "session" ("id" SERIAL NOT NULL, "token" character varying(64) NOT NULL, "userId" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_232f8e85d7633bd6ddfad421696" UNIQUE ("token"), CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_session_token" ON "session" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_session_userId" ON "session" ("userId") `);
        await queryRunner.query(`ALTER TABLE "session" ADD CONSTRAINT "FK_session_userId" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session" DROP CONSTRAINT "FK_session_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_session_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_session_token"`);
        await queryRunner.query(`DROP TABLE "session"`);
        await queryRunner.query(`DROP TABLE "app_user"`);
    }

}
