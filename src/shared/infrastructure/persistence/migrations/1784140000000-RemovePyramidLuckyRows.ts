import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limpia las filas `kind='pyramid'` de `lucky_dailies`.
 *
 * La Pirámide de la Suerte pasó a calcularse en el cliente como función
 * pura de la fecha (fila base = dígitos de DDMMYYYY), así que el backend
 * ya no la genera ni la sirve: se eliminaron `PyramidGenerator`, el valor
 * `PYRAMID` del enum `LuckyKind` y su rama en el job diario.
 *
 * Estas filas quedaron huérfanas y además eran ENGAÑOSAS: su payload se
 * generaba con `randomInt`, sin ninguna relación con la fecha a la que
 * estaban asociadas. Conservarlas solo invita a que alguien las lea
 * creyendo que son históricos válidos.
 */
export class RemovePyramidLuckyRows1784140000000 implements MigrationInterface {
  name = 'RemovePyramidLuckyRows1784140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "lucky_dailies" WHERE "kind" = 'pyramid'`,
    );
  }

  public async down(): Promise<void> {
    // Intencionalmente vacío. El contenido borrado era aleatorio y no
    // reproducible, así que no hay nada fiel que restaurar; recrear filas
    // inventadas sería peor que no tenerlas. La pantalla no depende de
    // esta tabla, así que revertir no rompe nada.
  }
}
