import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInstallationIdToGitHubApp1773100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "github_app" ADD COLUMN IF NOT EXISTS "installationId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "github_app" DROP COLUMN "installationId"`,
    );
  }
}
