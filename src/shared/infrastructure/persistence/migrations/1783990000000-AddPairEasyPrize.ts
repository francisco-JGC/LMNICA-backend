import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the "premio par" concept: a THIRD multiplier for THREE_DIGIT games
 * that applies when a ticket wins by fácil (permutation match) and the
 * winning number has repeated digits (100/010/001, 122, etc.). Configured
 * per game (default) and overridable per sucursal, same pattern as the
 * exact/easy multipliers already in place.
 *
 * `ticket_lines.pair_easy_prize` snapshots the doubled prize at ticket
 * creation time so the evaluator can pick it at draw time without
 * recomputing (mirrors how `prize` already snapshots the base easy prize).
 * Null on non-THREE_DIGIT lines, and null on older tickets from before
 * this rule existed — the evaluator falls back to `prize` when null.
 */
export class AddPairEasyPrize1783990000000 implements MigrationInterface {
  name = 'AddPairEasyPrize1783990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "pair_easy_multiplier" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD CONSTRAINT "CHK_games_pair_easy_positive" ` +
        `CHECK ("pair_easy_multiplier" IS NULL OR "pair_easy_multiplier" >= 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "sale_point_game_prizes" ADD COLUMN "pair_easy_multiplier" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_point_game_prizes" ADD CONSTRAINT "CHK_sale_point_game_prizes_pair_easy_positive" ` +
        `CHECK ("pair_easy_multiplier" IS NULL OR "pair_easy_multiplier" >= 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "ticket_lines" ADD COLUMN "pair_easy_prize" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ticket_lines" DROP COLUMN "pair_easy_prize"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_point_game_prizes" DROP CONSTRAINT "CHK_sale_point_game_prizes_pair_easy_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_point_game_prizes" DROP COLUMN "pair_easy_multiplier"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" DROP CONSTRAINT "CHK_games_pair_easy_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN "pair_easy_multiplier"`,
    );
  }
}
