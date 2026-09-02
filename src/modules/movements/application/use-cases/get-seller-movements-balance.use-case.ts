import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  SellerMovementsBalanceOutput,
  SellerMovementsBalanceRow,
} from '../dtos/seller-movements-balance.output';

export interface GetSellerMovementsBalanceInput {
  requesterId: string;
  requesterRole: UserRole;
  /** Optional — restrict to sellers of specific sucursales. */
  salePointIds?: string[];
  from?: Date;
  to?: Date;
}

interface RawRow {
  seller_id: string;
  cobros: string;
  credits: string;
  prize_payments: string;
}

@Injectable()
export class GetSellerMovementsBalance
  implements UseCase<GetSellerMovementsBalanceInput, SellerMovementsBalanceOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetSellerMovementsBalanceInput,
  ): Promise<SellerMovementsBalanceOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      const rows = await this.dataSource.query<RawRow[]>(
        `
        SELECT
          m.seller_id,
          COALESCE(SUM(CASE WHEN m.type = 'deposit'    THEN m.amount ELSE 0 END), 0)::bigint AS cobros,
          COALESCE(SUM(CASE WHEN m.type = 'withdrawal' THEN m.amount ELSE 0 END), 0)::bigint AS credits,
          COALESCE(SUM(CASE WHEN m.is_prize_payment = true THEN m.amount ELSE 0 END), 0)::bigint AS prize_payments
        FROM movements m
        WHERE m.seller_id = $1::uuid
          AND ($2::timestamptz IS NULL OR m.occurred_at >= $2::timestamptz)
          AND ($3::timestamptz IS NULL OR m.occurred_at <  $3::timestamptz)
        GROUP BY m.seller_id
        `,
        [input.requesterId, input.from ?? null, input.to ?? null],
      );
      return {
        items: rows.map((r) => ({
          sellerId: r.seller_id,
          cobros: Number(r.cobros),
          credits: Number(r.credits),
          prizePayments: Number(r.prize_payments),
        })),
      };
    }

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    const effectiveScope =
      input.salePointIds && input.salePointIds.length > 0
        ? partnerScope.filter((id) => input.salePointIds!.includes(id))
        : partnerScope;
    if (effectiveScope.length === 0) return { items: [] };

    // Aggregate seller-level movements. We join with users to enforce
    // partner scope: only sellers whose sale_point_id is in the accessible
    // set are included. Sellers with no sale_point_id are excluded by the
    // JOIN (they belong to nobody in scope).
    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        m.seller_id,
        COALESCE(SUM(CASE WHEN m.type = 'deposit'    THEN m.amount ELSE 0 END), 0)::bigint AS cobros,
        COALESCE(SUM(CASE WHEN m.type = 'withdrawal' THEN m.amount ELSE 0 END), 0)::bigint AS credits,
        COALESCE(SUM(CASE WHEN m.is_prize_payment = true THEN m.amount ELSE 0 END), 0)::bigint AS prize_payments
      FROM movements m
      JOIN users u ON u.id = m.seller_id AND u.sale_point_id = ANY($1::uuid[])
      WHERE m.seller_id IS NOT NULL
        AND ($2::timestamptz IS NULL OR m.occurred_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR m.occurred_at <  $3::timestamptz)
      GROUP BY m.seller_id
      `,
      [effectiveScope, input.from ?? null, input.to ?? null],
    );

    const items: SellerMovementsBalanceRow[] = rows.map((r) => ({
      sellerId: r.seller_id,
      cobros: Number(r.cobros),
      credits: Number(r.credits),
      prizePayments: Number(r.prize_payments),
    }));

    return { items };
  }
}
