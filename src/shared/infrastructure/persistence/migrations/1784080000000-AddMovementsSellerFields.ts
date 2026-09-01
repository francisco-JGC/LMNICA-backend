import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMovementsSellerFields1784080000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // seller_id: links a movement directly to a seller instead of a sucursal.
    // Seller-level movements (cobros, ajustes, prize payments) have null
    // sale_point_id and non-null seller_id. They are excluded from the
    // per-sucursal balance query automatically (WHERE sale_point_id = ANY(…)
    // never matches NULL).
    await queryRunner.query(`
      ALTER TABLE movements
        ADD COLUMN seller_id UUID NULL
          REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN is_prize_payment BOOLEAN NOT NULL DEFAULT FALSE,
        ALTER COLUMN sale_point_id DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_movements_seller_id
        ON movements (seller_id)
        WHERE seller_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_movements_seller_id`,
    );
    await queryRunner.query(`
      ALTER TABLE movements
        DROP COLUMN seller_id,
        DROP COLUMN is_prize_payment,
        ALTER COLUMN sale_point_id SET NOT NULL
    `);
  }
}
