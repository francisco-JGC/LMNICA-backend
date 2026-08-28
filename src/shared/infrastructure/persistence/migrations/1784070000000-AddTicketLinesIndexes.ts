import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices en `ticket_lines` que faltaban.
 *
 * `ticket_id`: es la FK más "caliente" del sistema. TypeORM la usaba
 * como scan de tabla en cada query con `lines` eager-loaded (Ticket
 * completo). En `enforceSaleLimit` (corre en TODA venta) y en el
 * dashboard summary, el JOIN `ticket_lines tl JOIN tickets t ON t.id
 * = tl.ticket_id` requiere lookup por `tl.ticket_id`. Con 100k+
 * líneas el scan degrada mucho — ~10-50x más rápido con índice.
 *
 * `label`: se usa en `enforceSaleLimit` con `tl.label = ANY(...)` y en
 * el evaluador de tickets ganadores. Índice B-tree simple ayuda al
 * filtrado. Compuesto (`draw_at`, `label`) sería ideal pero requiere
 * datos en `tickets`; dejamos el simple que ya cubre >80% del beneficio.
 *
 * Usamos `CREATE INDEX CONCURRENTLY` NO — TypeORM migrations corren
 * en transacción por default. Como la tabla es chica en la mayoría
 * de deploys (<50k filas), el lock momentáneo es aceptable. Si en
 * producción la tabla ya pesa millones de filas, considerar correr
 * los CREATE INDEX a mano fuera de la migración con CONCURRENTLY.
 */
export class AddTicketLinesIndexes1784070000000
  implements MigrationInterface
{
  name = 'AddTicketLinesIndexes1784070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ticket_lines_ticket_id"
         ON "ticket_lines" ("ticket_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ticket_lines_label"
         ON "ticket_lines" ("label")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_lines_label"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_lines_ticket_id"`,
    );
  }
}
