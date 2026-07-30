import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tope de venta específico por número (label), complementario al `sale_limits`
 * general por (juego, sucursal). Cuando existe una fila acá para un
 * (game, sale_point, label), su `amount` **prevalece** sobre el general
 * del `sale_limits` — así una sucursal puede subir el tope de un número
 * puntual (ej. el 00) sin cambiar el general.
 *
 * Comparte semántica de "por sorteo": cuando el tope se alcanza en el
 * `draw_at` actual, ese número queda bloqueado hasta el siguiente sorteo.
 * El reseteo es automático (basado en `draw_at`), no requiere cron.
 */
export class AddSaleLimitsByNumber1784010000000 implements MigrationInterface {
  name = 'AddSaleLimitsByNumber1784010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sale_limits_by_number" (
        "id" uuid NOT NULL,
        "sale_point_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        "label" varchar(40) NOT NULL,
        "amount" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sale_limits_by_number" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sale_limits_by_number_sale_point_id"
          FOREIGN KEY ("sale_point_id") REFERENCES "sale_points"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sale_limits_by_number_game_id"
          FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_sale_limits_by_number_sp_game_label"
          UNIQUE ("sale_point_id", "game_id", "label"),
        CONSTRAINT "CHK_sale_limits_by_number_amount_positive"
          CHECK ("amount" > 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sale_limits_by_number_sp_game"
        ON "sale_limits_by_number" ("sale_point_id", "game_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_sale_limits_by_number_sp_game"`,
    );
    await queryRunner.query(`DROP TABLE "sale_limits_by_number"`);
  }
}
