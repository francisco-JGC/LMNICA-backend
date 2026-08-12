import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nueva columna `client_request_id` en tickets — UUID generado por el
 * cliente para dedupear reintentos. El cliente genera un UUID v4 al
 * comenzar el flujo de venta y lo manda en cada intento (incluyendo
 * reintentos automáticos por timeout / 401-refresh). El backend, antes
 * de crear un ticket nuevo, hace lookup por este campo: si ya existe,
 * devuelve el ticket previo en lugar de crear un duplicado.
 *
 * Índice UNIQUE parcial (WHERE IS NOT NULL) para que los tickets viejos
 * sin este campo no rompan la constraint, y para no bloquear inserts en
 * paralelo por el mismo NULL.
 */
export class AddTicketsClientRequestId1784030000000
  implements MigrationInterface
{
  name = 'AddTicketsClientRequestId1784030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tickets" ADD "client_request_id" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tickets_client_request_id"
         ON "tickets" ("client_request_id")
         WHERE "client_request_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tickets_client_request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN "client_request_id"`,
    );
  }
}
