import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleLimitsByNumberMinAmount1784120000000
  implements MigrationInterface
{
  name = 'AddSaleLimitsByNumberMinAmount1784120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_limits_by_number" ADD COLUMN "min_amount" integer NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_limits_by_number" DROP COLUMN "min_amount"`,
    );
  }
}
