import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  DRAW_RESULTS_REPOSITORY,
  type DrawResultsRepository,
} from '../../../games/domain/repositories/draw-results.repository';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketStatus } from '../../domain/value-objects/ticket-status';
import { TicketEvaluator } from '../services/ticket-evaluator.service';
import type {
  SellerReportOutput,
  SellerReportRow,
} from '../dtos/seller-report.output';

export interface GetSellerReportInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  seller_id: string;
  ticket_count: string;
  voided_count: string;
  paid_count: string;
  billed: string;
  paid_prize: string;
}

/**
 * Per-seller aggregates for the "Reporte Diario del Vendedor" page:
 * how much each seller billed, how much was paid out on their winning
 * tickets, how much they SHOULD pay (wonPrize includes unpaid winnings),
 * and their weekly commission based on `paymentPercentage`.
 */
@Injectable()
export class GetSellerReport
  implements UseCase<GetSellerReportInput, SellerReportOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(TICKETS_REPOSITORY)
    private readonly tickets: TicketsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    private readonly scope: PartnerScopeService,
    private readonly evaluator: TicketEvaluator,
  ) {}

  async execute(
    input: GetSellerReportInput,
  ): Promise<SellerReportOutput> {
    // Sellers can only see their own row.
    const effectiveSellerId =
      input.requesterRole === UserRole.SELLER
        ? input.requesterId
        : input.sellerId;

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope !== null && partnerScope.length === 0) {
      return { items: [] };
    }

    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        t.seller_id::text AS seller_id,
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_prize
      FROM tickets t
      WHERE ($1::uuid IS NULL OR t.seller_id     = $1::uuid)
        AND ($2::uuid IS NULL OR t.sale_point_id = $2::uuid)
        AND ($3::timestamptz IS NULL OR t.created_at >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR t.created_at <  $4::timestamptz)
        AND ($5::uuid[] IS NULL OR t.sale_point_id = ANY($5::uuid[]))
      GROUP BY t.seller_id
      `,
      [
        effectiveSellerId ?? null,
        input.salePointId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    if (rows.length === 0) return { items: [] };

    // wonPrize (paid o no) por vendedor — evaluamos los tickets contra
    // sus resultados. Ver `GetMovementsBalance.computeWonBySalePoint`.
    const wonBySeller = await this.computeWonBySeller({
      sellerId: effectiveSellerId,
      salePointId: input.salePointId,
      salePointIds: partnerScope ?? undefined,
      from: input.from,
      to: input.to,
    });

    // Resolve seller info in one round trip to compute names and salaries.
    const sellerIds = rows.map((r) => r.seller_id);
    const sellers = await this.users.findByIds(sellerIds);
    const sellerById = new Map(sellers.map((s) => [s.id, s]));

    const items: SellerReportRow[] = rows.map((r) => {
      const seller = sellerById.get(r.seller_id);
      const billed = Number(r.billed);
      const pct = seller?.paymentPercentage ?? null;
      const salary = pct !== null ? Math.round((billed * pct) / 100) : null;
      return {
        sellerId: r.seller_id,
        sellerName: seller?.name ?? '—',
        ticketCount: Number(r.ticket_count),
        voidedCount: Number(r.voided_count),
        paidCount: Number(r.paid_count),
        billed,
        paidPrize: Number(r.paid_prize),
        wonPrize: wonBySeller.get(r.seller_id) ?? 0,
        paymentPercentage: pct,
        salary,
      };
    });

    // Sort by billed desc — highest earners first, matches how you read
    // payroll during a Sunday close-out.
    items.sort((a, b) => b.billed - a.billed);

    return { items };
  }

  /**
   * Evalúa tickets del rango y devuelve `sellerId -> totalWonPrize`.
   * Mismo approach que `GetMovementsBalance.computeWonBySalePoint`.
   */
  private async computeWonBySeller(filters: {
    sellerId?: string;
    salePointId?: string;
    salePointIds?: string[];
    from?: Date;
    to?: Date;
  }): Promise<Map<string, number>> {
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      sellerId: filters.sellerId,
      salePointId: filters.salePointId,
      salePointIds: filters.salePointIds,
      from: filters.from,
      to: filters.to,
      limit: 100_000,
      offset: 0,
    });
    if (tickets.length === 0) return new Map();

    let minDrawAt = tickets[0].drawAt;
    let maxDrawAt = tickets[0].drawAt;
    for (const t of tickets) {
      if (t.drawAt < minDrawAt) minDrawAt = t.drawAt;
      if (t.drawAt > maxDrawAt) maxDrawAt = t.drawAt;
    }

    const [draws, gamesAll] = await Promise.all([
      this.drawResults.findMany({ from: minDrawAt, to: maxDrawAt }),
      this.games.findAll({ onlyActive: false }),
    ]);
    const drawByKey = new Map(
      draws.map((d) => [`${d.gameId}|${d.drawAt.toISOString()}`, d]),
    );
    const gameById = new Map(gamesAll.map((g) => [g.id, g]));

    const won = new Map<string, number>();
    for (const t of tickets) {
      const game = gameById.get(t.gameId) ?? null;
      const key = `${t.gameId}|${t.drawAt.toISOString()}`;
      const draw = drawByKey.get(key) ?? null;
      const ev = this.evaluator.evaluateWith(t, game, draw);
      if (ev.totalPrize > 0) {
        won.set(t.sellerId, (won.get(t.sellerId) ?? 0) + ev.totalPrize);
      }
    }
    return won;
  }
}
