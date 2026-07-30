import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type { TicketsSummaryOutput } from '../dtos/tickets-summary.output';

export interface GetTicketsSummaryInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  gameId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
}

const EMPTY_RESULT: TicketsSummaryOutput = {
  ticketCount: 0,
  voidedCount: 0,
  paidCount: 0,
  billed: 0,
  paidPrize: 0,
  salary: null,
  paymentPercentage: null,
};

/**
 * Server-side SQL aggregation for the movements screen: returns billed +
 * paid-prize totals + counts for a set of tickets, without transporting
 * hundreds of rows to the client. Sellers can only see their own totals;
 * partners are scoped to their sucursales; admins see everything. When the
 * query is scoped to a single seller, the commission (`salary`) is also
 * computed here using that user's `paymentPercentage`.
 */
@Injectable()
export class GetTicketsSummary
  implements UseCase<GetTicketsSummaryInput, TicketsSummaryOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetTicketsSummaryInput,
  ): Promise<TicketsSummaryOutput> {
    // Sellers cannot spy on other sellers' totals: force the sellerId
    // filter to the requester, ignoring any spoofed value in the query.
    const effectiveSellerId =
      input.requesterRole === UserRole.SELLER
        ? input.requesterId
        : input.sellerId;

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    // Sin sucursales visibles → nada que agregar.
    if (partnerScope.length === 0) return EMPTY_RESULT;

    const rows = await this.dataSource.query<
      Array<{
        ticket_count: string;
        voided_count: string;
        paid_count: string;
        billed: string;
        paid_prize: string;
      }>
    >(
      `
      SELECT
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_prize
      FROM tickets t
      WHERE ($1::uuid IS NULL OR t.seller_id     = $1::uuid)
        AND ($2::uuid IS NULL OR t.sale_point_id = $2::uuid)
        AND ($3::uuid IS NULL OR t.game_id       = $3::uuid)
        AND ($4::timestamptz IS NULL OR t.created_at >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR t.created_at <  $5::timestamptz)
        AND t.sale_point_id = ANY($6::uuid[])
      `,
      [
        effectiveSellerId ?? null,
        input.salePointId ?? null,
        input.gameId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    const row = rows[0];
    const billed = Number(row?.billed ?? 0);

    // Commission only makes sense when we're looking at ONE seller's totals.
    let salary: number | null = null;
    let paymentPercentage: number | null = null;
    if (effectiveSellerId) {
      const seller = await this.users.findById(effectiveSellerId);
      if (
        seller?.paymentPercentage !== null &&
        seller?.paymentPercentage !== undefined
      ) {
        paymentPercentage = seller.paymentPercentage;
        salary = Math.round((billed * paymentPercentage) / 100);
      }
    }

    return {
      ticketCount: Number(row?.ticket_count ?? 0),
      voidedCount: Number(row?.voided_count ?? 0),
      paidCount: Number(row?.paid_count ?? 0),
      billed,
      paidPrize: Number(row?.paid_prize ?? 0),
      salary,
      paymentPercentage,
    };
  }
}
