import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookTokenToUser1724103600000 implements MigrationInterface {
  name = 'AddWebhookTokenToUser1724103600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add webhookToken column (nullable, unique) to user table
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "webhookToken" character varying UNIQUE
    `);

    // Back-fill existing users with a unique UUID so they can use the feature immediately
    await queryRunner.query(`
      UPDATE "user"
      SET "webhookToken" = gen_random_uuid()::varchar
      WHERE "webhookToken" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "webhookToken"`);
  }
}
