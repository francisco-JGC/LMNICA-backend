import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalePointAssignedPartners1783980000000
  implements MigrationInterface
{
  name = 'AddSalePointAssignedPartners1783980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // N:M between sucursales and partner users. The encargado (ownerPartnerId)
    // stays on `sale_points`; this table only tracks additional socios that
    // need read visibility on the sucursal (dashboards, reports). Membership
    // is administered by admins.
    await queryRunner.query(
      `CREATE TABLE "sale_point_assigned_partners" (
        "sale_point_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "assigned_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sale_point_assigned_partners"
          PRIMARY KEY ("sale_point_id", "user_id"),
        CONSTRAINT "FK_sale_point_assigned_partners_sale_point_id"
          FOREIGN KEY ("sale_point_id") REFERENCES "sale_points"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sale_point_assigned_partners_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sale_point_assigned_partners_user_id"
        ON "sale_point_assigned_partners" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_sale_point_assigned_partners_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "sale_point_assigned_partners"`);
  }
}
