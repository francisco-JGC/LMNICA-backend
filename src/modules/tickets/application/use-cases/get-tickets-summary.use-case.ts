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
import type { TicketsSummaryOutput } from '../dtos/tickets-summary.output';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketStatus } from '../../domain/value-objects/ticket-status';
import { TicketEvaluator } from '../services/ticket-evaluator.service';

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
  billed: 0,
  wonPrize: 0,
  salary: null,
  paymentPercentage: null,
};

/**
 * Server-side aggregation for the movements screen: returns billed +
 * ganado por clientes + counts para un set de tickets. Sellers ven solo
 * sus propios totales; partners están scoped a sus sucursales; admins ven
 * todo. `wonPrize` se evalúa contra los `draw_results` (no depende de
 * ningún flag "pagado", ese concepto fue eliminado).
 */
@Injectable()
export class GetTicketsSummary
  implements UseCase<GetTicketsSummaryInput, TicketsSummaryOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(TICKETS_REPOSITORY)
    private readonly tickets: TicketsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    private readonly evaluator: TicketEvaluator,
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
    if (partnerScope.length === 0) return EMPTY_RESULT;

    const rows = await this.dataSource.query<
      Array<{
        ticket_count: string;
        voided_count: string;
        billed: string;
      }>
    >(
      `
      SELECT
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed
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

    // wonPrize: fetch tickets del rango y evaluarlos contra sus draw_results.
    const wonPrize = await this.computeWonPrize({
      sellerId: effectiveSellerId,
      salePointId: input.salePointId,
      salePointIds: partnerScope,
      gameId: input.gameId,
      from: input.from,
      to: input.to,
    });

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
      billed,
      wonPrize,
      salary,
      paymentPercentage,
    };
  }

  private async computeWonPrize(filters: {
    sellerId?: string;
    salePointId?: string;
    salePointIds: string[];
    gameId?: string;
    from?: Date;
    to?: Date;
  }): Promise<number> {
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      sellerId: filters.sellerId,
      salePointId: filters.salePointId,
      salePointIds: filters.salePointIds,
      gameId: filters.gameId,
      from: filters.from,
      to: filters.to,
      limit: 100_000,
      offset: 0,
    });
    if (tickets.length === 0) return 0;

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

    let total = 0;
    for (const t of tickets) {
      const game = gameById.get(t.gameId) ?? null;
      const draw = drawByKey.get(`${t.gameId}|${t.drawAt.toISOString()}`) ?? null;
      const ev = this.evaluator.evaluateWith(t, game, draw);
      total += ev.totalPrize;
    }
    return total;
  }
}
