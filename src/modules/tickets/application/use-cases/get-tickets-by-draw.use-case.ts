import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  TicketsByDrawItem,
  TicketsByDrawOutput,
} from '../dtos/tickets-by-draw.output';

export interface GetTicketsByDrawInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  gameId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
}

/**
 * Server-side aggregation of tickets grouped by `(game_id, draw_at)`. Feeds
 * the mobile "Totales Sorteos" screen: one row per scheduled draw, showing
 * how much was billed, how many tickets were sold, and (if the result is
 * already registered) the winning number.
 *
 * Sellers can only see their own totals; partners are limited to their
 * sucursales; admins can filter by any seller.
 */
@Injectable()
export class GetTicketsByDraw
  implements UseCase<GetTicketsByDrawInput, TicketsByDrawOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetTicketsByDrawInput,
  ): Promise<TicketsByDrawOutput> {
    // Seller isolation: force sellerId to the requester for role=seller,
    // ignoring anything sent from the client.
    const effectiveSellerId =
      input.requesterRole === UserRole.SELLER
        ? input.requesterId
        : input.sellerId;

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return [];

    const rows = await this.dataSource.query<
      Array<{
        game_id: string;
        draw_at: Date;
        ticket_count: string;
        voided_count: string;
        paid_count: string;
        billed: string;
        paid_prize: string;
        winning_number: string | null;
      }>
    >(
      `
      SELECT
        t.game_id,
        t.draw_at,
        COUNT(*)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_prize,
        dr.winning_number
      FROM tickets t
      LEFT JOIN draw_results dr
        ON dr.game_id = t.game_id AND dr.draw_at = t.draw_at
      WHERE ($1::uuid IS NULL OR t.seller_id     = $1::uuid)
        AND ($2::uuid IS NULL OR t.sale_point_id = $2::uuid)
        AND ($3::uuid IS NULL OR t.game_id       = $3::uuid)
        AND ($4::timestamptz IS NULL OR t.created_at >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR t.created_at <  $5::timestamptz)
        AND t.sale_point_id = ANY($6::uuid[])
      GROUP BY t.game_id, t.draw_at, dr.winning_number
      ORDER BY t.draw_at DESC
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

    return rows.map<TicketsByDrawItem>((r) => ({
      gameId: r.game_id,
      drawAt: new Date(r.draw_at).toISOString(),
      ticketCount: Number(r.ticket_count),
      voidedCount: Number(r.voided_count),
      paidCount: Number(r.paid_count),
      billed: Number(r.billed),
      paidPrize: Number(r.paid_prize),
      winningNumber: r.winning_number,
    }));
  }
}
