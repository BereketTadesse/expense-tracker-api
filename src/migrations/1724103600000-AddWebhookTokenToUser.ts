import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookTokenToUser1724103600000 implements MigrationInterface {
  name = 'AddWebhookTokenToUser1724103600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "webhookToken" character varying UNIQUE
    `);

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
