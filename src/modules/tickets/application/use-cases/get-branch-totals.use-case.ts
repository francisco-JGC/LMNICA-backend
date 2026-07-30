import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  BranchTotalsOutput,
  BranchTotalsRow,
} from '../dtos/branch-totals.output';

export interface GetBranchTotalsInput {
  requesterId: string;
  requesterRole: UserRole;
  gameId?: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  sale_point_id: string;
  ticket_count: string;
  voided_count: string;
  paid_count: string;
  billed: string;
  paid_prize: string;
}

/**
 * Aggregate revenue + payouts per sucursal for the "Totales por Sucursal"
 * report. Partners see only their sucursales; admins see everything.
 * A sucursal with zero tickets in the range does NOT appear.
 */
@Injectable()
export class GetBranchTotals
  implements UseCase<GetBranchTotalsInput, BranchTotalsOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetBranchTotalsInput,
  ): Promise<BranchTotalsOutput> {
    // Sellers should never hit this endpoint (role-gated at controller);
    // this is a defense-in-depth guard for the use case.
    if (input.requesterRole === UserRole.SELLER) return { items: [] };

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        t.sale_point_id::text AS sale_point_id,
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_prize
      FROM tickets t
      WHERE ($1::uuid IS NULL OR t.game_id = $1::uuid)
        AND ($2::timestamptz IS NULL OR t.created_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR t.created_at <  $3::timestamptz)
        AND t.sale_point_id = ANY($4::uuid[])
      GROUP BY t.sale_point_id
      `,
      [
        input.gameId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    if (rows.length === 0) return { items: [] };

    // Bulk-resolve sucursal names + owner partner names.
    const salePointIds = rows.map((r) => r.sale_point_id);
    const salePoints = await Promise.all(
      salePointIds.map((id) => this.salePoints.findById(id)),
    );
    const salePointById = new Map(
      salePoints
        .filter((sp): sp is NonNullable<typeof sp> => sp !== null)
        .map((sp) => [sp.id, sp]),
    );

    const partnerIds = Array.from(
      new Set(
        salePoints
          .filter((sp): sp is NonNullable<typeof sp> => sp !== null)
          .map((sp) => sp.ownerPartnerId)
          .filter((id): id is string => id !== null),
      ),
    );
    const partners = await this.users.findByIds(partnerIds);
    const partnerNameById = new Map(partners.map((p) => [p.id, p.name]));

    const items: BranchTotalsRow[] = rows.map((r) => {
      const sp = salePointById.get(r.sale_point_id);
      const billed = Number(r.billed);
      const paidPrize = Number(r.paid_prize);
      return {
        salePointId: r.sale_point_id,
        salePointName: sp?.name ?? '—',
        ownerPartnerId: sp?.ownerPartnerId ?? null,
        ownerPartnerName: sp?.ownerPartnerId
          ? partnerNameById.get(sp.ownerPartnerId) ?? null
          : null,
        ticketCount: Number(r.ticket_count),
        voidedCount: Number(r.voided_count),
        paidCount: Number(r.paid_count),
        billed,
        paidPrize,
        net: billed - paidPrize,
      };
    });

    // Highest revenue first — matches the read order for a Sunday close-out.
    items.sort((a, b) => b.billed - a.billed);
    return { items };
  }
}
