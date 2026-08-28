import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nueva columna `client_request_id` en movements — mismo patrón que
 * `tickets.client_request_id`. El cliente (web) genera un UUID v4 al
 * abrir el modal de crear movimiento y lo manda con el POST. Si el
 * usuario tapea "Guardar" dos veces (o hay retry por timeout), el
 * backend detecta el mismo UUID y devuelve el movimiento ya creado en
 * vez de duplicarlo.
 *
 * Índice UNIQUE parcial (WHERE IS NOT NULL) para no colisionar entre
 * los NULL de movimientos legacy (creados antes de este campo o desde
 * flujos que no envían UUID) y para permitir inserts en paralelo sin
 * bloquear por el NULL compartido.
 */
export class AddMovementsClientRequestId1784060000000
  implements MigrationInterface
{
  name = 'AddMovementsClientRequestId1784060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movements" ADD "client_request_id" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_movements_client_request_id"
         ON "movements" ("client_request_id")
         WHERE "client_request_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_movements_client_request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP COLUMN "client_request_id"`,
    );
  }
}
