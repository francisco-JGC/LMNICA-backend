import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nueva tabla `sale_limits_by_seller_number`: permite al partner (encargado
 * de sucursal) repartir el tope de un número entre sus vendedores.
 *
 * Ejemplo: admin configura tope de C$100 para la sucursal en el número
 * "03" del juego Diaria. El partner reparte esa cuota entre sus vendedores:
 * seller1 = 50, seller2 = 25, seller3 = 25. Suma ≤ tope.
 *
 * Semántica al vender:
 *   1. Si el vendedor tiene cuota específica → chequea contra su cuota.
 *   2. Siempre chequea el tope global de la sucursal (más restrictivo gana).
 *   3. Vendedores sin cuota específica venden contra el "pool sobrante"
 *      del tope de sucursal (tope − suma de cuotas explícitas).
 *
 * UNIQUE (seller_id, game_id, label): un vendedor solo puede tener una
 * cuota por (juego, número). Índice adicional por (sale_point_id, game_id,
 * label) para el bulk lookup al vender.
 */
export class AddSaleLimitsBySellerNumber1784040000000
  implements MigrationInterface
{
  name = 'AddSaleLimitsBySellerNumber1784040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sale_limits_by_seller_number" (
        "id" uuid NOT NULL,
        "sale_point_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "game_id" uuid NOT NULL,
        "label" varchar(40) NOT NULL,
        "amount" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sale_limits_by_seller_number" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_slbsn_seller_game_label" UNIQUE ("seller_id", "game_id", "label"),
        CONSTRAINT "FK_slbsn_sale_point"
          FOREIGN KEY ("sale_point_id") REFERENCES "sale_points"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_slbsn_seller"
          FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_slbsn_game"
          FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_slbsn_sp_game_label" ON "sale_limits_by_seller_number" ("sale_point_id", "game_id", "label")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_slbsn_seller" ON "sale_limits_by_seller_number" ("seller_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sale_limits_by_seller_number"`);
  }
}
