import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Habilita que un admin también pueda vender desde la app móvil.
 *
 *   - `mobile_sales_enabled` — flag que el admin activa cuando quiere
 *     poder vender desde la app. Cuando está en `false`, el backend lo
 *     trata como un admin normal (sin acceso al flujo de venta).
 *
 *   - `default_sale_point_id` — a qué sucursal se le imputan las ventas
 *     del admin en modo vendedor. Nullable: hasta que el admin no elige
 *     una sucursal el flag no tiene sentido activo. ON DELETE SET NULL
 *     para que borrar la sucursal no rompa la fila del admin.
 */
export class AddUsersMobileSalesProfile1784100000000 implements MigrationInterface {
  name = 'AddUsersMobileSalesProfile1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "mobile_sales_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "default_sale_point_id" uuid NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_default_sale_point_id" ` +
        `FOREIGN KEY ("default_sale_point_id") REFERENCES "sale_points"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_default_sale_point_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "default_sale_point_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mobile_sales_enabled"`);
  }
}
