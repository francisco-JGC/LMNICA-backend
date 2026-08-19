import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill del default `pair_easy_multiplier = 200` para el juego Juega 3.
 *
 * `1783990000000-AddPairEasyPrize` sólo agregó la columna (todos NULL).
 * `SeedInitialGames` la carga con 200, pero ese seed únicamente corre en
 * instalaciones nuevas (`existing === 0`). En las bases ya migradas el
 * default quedó NULL, así que:
 *   - El campo "Par" en la UI de premios por juego aparecía vacío.
 *   - El backend no exponía default → el mobile no podía re-escalar el
 *     premio par (200x) cuando no había override por sucursal.
 *
 * Este backfill sólo toca filas donde la columna sigue NULL, así que es
 * idempotente y respeta cualquier configuración manual previa.
 */
export class BackfillJuega3PairEasyDefault1784050000000
  implements MigrationInterface
{
  name = 'BackfillJuega3PairEasyDefault1784050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "games" SET "pair_easy_multiplier" = 200 ` +
        `WHERE "slug" = 'juega3' AND "pair_easy_multiplier" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No revert — el default 200 es el valor canónico definido por el
    // seed. Si alguien necesita quitarlo se hace desde la UI (override
    // en null vuelve al default, y hoy 200 ES el default).
  }
}
