import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleLimitsMaxPerTicket1784110000000
  implements MigrationInterface
{
  name = 'AddSaleLimitsMaxPerTicket1784110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_limits" ADD COLUMN "max_per_ticket" integer NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_limits" DROP COLUMN "max_per_ticket"`,
    );
  }
}
