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
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  TicketsByDrawItem,
  TicketsByDrawOutput,
} from '../dtos/tickets-by-draw.output';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketStatus } from '../../domain/value-objects/ticket-status';
import { TicketEvaluator } from '../services/ticket-evaluator.service';

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
 * how much was billed, how many tickets were sold, y `wonPrize` evaluado
 * contra el `draw_result` (0 si no hay resultado registrado aún).
 */
@Injectable()
export class GetTicketsByDraw
  implements UseCase<GetTicketsByDrawInput, TicketsByDrawOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(TICKETS_REPOSITORY)
    private readonly tickets: TicketsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    private readonly evaluator: TicketEvaluator,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetTicketsByDrawInput,
  ): Promise<TicketsByDrawOutput> {
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
        billed: string;
        winning_number: string | null;
      }>
    >(
      `
      SELECT
        t.game_id,
        t.draw_at,
        COUNT(*)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed,
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

    if (rows.length === 0) return [];

    // wonPrize por (game, drawAt): evaluamos tickets valid del rango.
    const wonByDraw = await this.computeWonByDraw({
      sellerId: effectiveSellerId,
      salePointId: input.salePointId,
      salePointIds: partnerScope,
      gameId: input.gameId,
      from: input.from,
      to: input.to,
    });

    return rows.map<TicketsByDrawItem>((r) => {
      const drawAt = new Date(r.draw_at);
      const key = `${r.game_id}|${drawAt.toISOString()}`;
      return {
        gameId: r.game_id,
        drawAt: drawAt.toISOString(),
        ticketCount: Number(r.ticket_count),
        voidedCount: Number(r.voided_count),
        billed: Number(r.billed),
        wonPrize: wonByDraw.get(key) ?? 0,
        winningNumber: r.winning_number,
      };
    });
  }

  private async computeWonByDraw(filters: {
    sellerId?: string;
    salePointId?: string;
    salePointIds: string[];
    gameId?: string;
    from?: Date;
    to?: Date;
  }): Promise<Map<string, number>> {
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
        won.set(key, (won.get(key) ?? 0) + ev.totalPrize);
      }
    }
    return won;
  }
}
