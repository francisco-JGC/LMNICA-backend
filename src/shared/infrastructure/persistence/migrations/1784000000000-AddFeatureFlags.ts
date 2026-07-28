import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla genérica de feature flags administrables desde el admin web.
 * Cada flag es un toggle simple `enabled: boolean`; los use cases que la
 * consultan deciden qué significa (ej. `nightly_lock` gatea el bloqueo
 * nocturno de juegos).
 *
 * Seed inicial: `nightly_lock = true` para preservar el comportamiento
 * actual sin que los admins tengan que activarlo manualmente después de
 * correr la migración.
 */
export class AddFeatureFlags1784000000000 implements MigrationInterface {
  name = 'AddFeatureFlags1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "feature_flags" (
        "key" varchar(60) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "description" varchar(255),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_flags" PRIMARY KEY ("key")
      )`,
    );
    // Seed inicial. Idempotente para que rerunning la migración no rompa.
    await queryRunner.query(
      `INSERT INTO "feature_flags" ("key", "enabled", "description")
       VALUES ('nightly_lock', true,
         'Cierra automáticamente cada juego desde el último sorteo del día hasta las 06:00 AM del día siguiente.')
       ON CONFLICT ("key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "feature_flags"`);
  }
}
