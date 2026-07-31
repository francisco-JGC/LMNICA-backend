import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nuevo campo `partner_payment_percentage` en sale_points. Representa el %
 * de las ventas semanales de la sucursal que le corresponde al **encargado**
 * (owner_partner) como pago. Nullable = sin pago configurado. Los "socios
 * asignados" no cobran — solo el encargado.
 *
 * Se guarda como smallint (0-100). Semántica y validación en la entidad.
 */
export class AddSalePointPartnerPaymentPercentage1784020000000
  implements MigrationInterface
{
  name = 'AddSalePointPartnerPaymentPercentage1784020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_points" ADD "partner_payment_percentage" smallint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_points" DROP COLUMN "partner_payment_percentage"`,
    );
  }
}
