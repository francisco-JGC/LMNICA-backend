import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alta del juego "Juga 4" (4 dígitos) en loteria.
 *
 * No alcanza con agregarlo a `SeedInitialGames`: ese seed solo corre
 * cuando la tabla está vacía (`if (existing > 0) return 0`), así que en
 * una base ya poblada nunca se ejecutaría. Esta migración lo inserta en
 * los ambientes existentes; el seed cubre las instalaciones nuevas.
 *
 * Idempotente por el `ON CONFLICT (slug)`: si el juego ya fue creado a
 * mano desde `POST /games`, la migración no lo duplica ni lo pisa.
 *
 * El `WHERE EXISTS (SELECT 1 FROM games)` NO es decorativo. Sin él, en una
 * base nueva esta migración corre antes del seed y deja a `juga4` como
 * único juego; después `SeedInitialGames` ve `count() > 0`, se da por
 * cumplido y NUNCA crea los otros 13. La instalación queda con un solo
 * juego. Insertando solo cuando ya hay juegos, cada camino hace su parte:
 * base existente → la migración; base nueva → el seed, que ya incluye
 * Juga 4.
 *
 * Juga 4 se ubica antes de Multi Sorteo, que por convención va último en
 * la grilla, así que se corre el `order_index` de ese.
 */
export class AddJuga4Game1784130000000 implements MigrationInterface {
  name = 'AddJuga4Game1784130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "games" SET "order_index" = 14 WHERE "slug" = 'multisorteo'`,
    );
    await queryRunner.query(
      `INSERT INTO "games"
         ("id", "slug", "name", "type", "exact_multiplier", "easy_multiplier",
          "pair_easy_multiplier", "image_path", "order_index", "is_active")
       SELECT gen_random_uuid(), 'juga4', 'Juga 4', 'four_digit', 6000, NULL,
              NULL, 'assets/images/games/juga4.webp', 13, true
        WHERE EXISTS (SELECT 1 FROM "games")
       ON CONFLICT ("slug") DO NOTHING`,
    );

    // Horarios: los mismos que el DEFAULT_SCHEDULE de SeedInitialSchedules
    // (11:00, 15:00, 21:00 todos los días + 18:00 sábado y domingo), que es
    // lo que tiene Combo, el otro juego de 4 dígitos. Sin horarios activos
    // `ResolveNextDraw` lanza "Game has no active draw schedules" y el juego
    // aparece en la grilla pero no se puede vender.
    //
    // `NOT EXISTS` en vez de `ON CONFLICT` porque la tabla no tiene índice
    // único sobre (game_id, draw_time, day_of_week). Sembramos solo si el
    // juego todavía no tiene ningún horario, así re-ejecutar no duplica.
    await queryRunner.query(
      `INSERT INTO "draw_schedules"
         ("id", "game_id", "day_of_week", "draw_time", "cutoff_minutes", "is_active")
       SELECT gen_random_uuid(), g."id", s."day_of_week", s."draw_time", 2, true
         FROM "games" g
        CROSS JOIN (VALUES
            (NULL::smallint, '11:00'),
            (NULL::smallint, '15:00'),
            (NULL::smallint, '21:00'),
            (6::smallint,    '18:00'),
            (0::smallint,    '18:00')
          ) AS s("day_of_week", "draw_time")
        WHERE g."slug" = 'juga4'
          AND NOT EXISTS (
            SELECT 1 FROM "draw_schedules" d WHERE d."game_id" = g."id"
          )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo se borra si no quedó nada colgando. `tickets` y `draw_results`
    // tienen FK con onDelete RESTRICT: el DELETE fallaría, y perder boletos
    // o resultados para revertir una migración no es aceptable. Los
    // horarios no se chequean porque su FK es CASCADE y se van solos.
    await queryRunner.query(
      `DELETE FROM "games"
        WHERE "slug" = 'juga4'
          AND NOT EXISTS (
            SELECT 1 FROM "tickets" t WHERE t."game_id" = "games"."id"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "draw_results" r WHERE r."game_id" = "games"."id"
          )`,
    );
    await queryRunner.query(
      `UPDATE "games" SET "order_index" = 13 WHERE "slug" = 'multisorteo'`,
    );
  }
}
