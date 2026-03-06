import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGitHubApp1773000000000 implements MigrationInterface {
    name = 'CreateGitHubApp1773000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "github_app" (
                "id" SERIAL NOT NULL,
                "singletonKey" character varying(10) NOT NULL DEFAULT 'GLOBAL',
                "appId" integer NOT NULL,
                "appSlug" character varying(255) NOT NULL,
                "appName" character varying(255) NOT NULL,
                "privateKeyEncrypted" text NOT NULL,
                "webhookSecretEncrypted" text NOT NULL,
                "clientId" character varying(255) NOT NULL,
                "clientSecretEncrypted" text NOT NULL,
                "htmlUrl" character varying(500) NOT NULL,
                "ownerId" integer NOT NULL,
                "ownerLogin" character varying(255) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_github_app_singleton" UNIQUE ("singletonKey"),
                CONSTRAINT "PK_github_app" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "github_app"`);
    }
}
