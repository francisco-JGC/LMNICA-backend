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
  BillingByGameOutput,
  BillingByGameRow,
} from '../dtos/billing-by-game.output';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketStatus } from '../../domain/value-objects/ticket-status';
import { TicketEvaluator } from '../services/ticket-evaluator.service';

export interface GetBillingByGameInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  game_id: string;
  ticket_count: string;
  voided_count: string;
  billed: string;
}

@Injectable()
export class GetBillingByGame
  implements UseCase<GetBillingByGameInput, BillingByGameOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(TICKETS_REPOSITORY)
    private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    private readonly evaluator: TicketEvaluator,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetBillingByGameInput,
  ): Promise<BillingByGameOutput> {
    if (input.requesterRole === UserRole.SELLER) return { items: [] };

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        t.game_id::text AS game_id,
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed
      FROM tickets t
      WHERE ($1::uuid IS NULL OR t.sale_point_id = $1::uuid)
        AND ($2::uuid IS NULL OR t.seller_id     = $2::uuid)
        AND ($3::timestamptz IS NULL OR t.created_at >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR t.created_at <  $4::timestamptz)
        AND t.sale_point_id = ANY($5::uuid[])
      GROUP BY t.game_id
      `,
      [
        input.salePointId ?? null,
        input.sellerId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    if (rows.length === 0) return { items: [] };

    const games = await Promise.all(
      rows.map((r) => this.games.findById(r.game_id)),
    );
    const gameById = new Map(
      games
        .filter((g): g is NonNullable<typeof g> => g !== null)
        .map((g) => [g.id, g]),
    );

    // wonPrize por juego: evaluamos tickets `valid` del rango.
    const wonByGame = await this.computeWonByGame({
      salePointId: input.salePointId,
      salePointIds: partnerScope,
      sellerId: input.sellerId,
      from: input.from,
      to: input.to,
    });

    const totalBilled = rows.reduce((sum, r) => sum + Number(r.billed), 0);

    const items: BillingByGameRow[] = rows.map((r) => {
      const game = gameById.get(r.game_id);
      const billed = Number(r.billed);
      const wonPrize = wonByGame.get(r.game_id) ?? 0;
      return {
        gameId: r.game_id,
        gameName: game?.name ?? '—',
        ticketCount: Number(r.ticket_count),
        voidedCount: Number(r.voided_count),
        billed,
        wonPrize,
        net: billed - wonPrize,
        share: totalBilled > 0 ? billed / totalBilled : 0,
      };
    });

    items.sort((a, b) => b.billed - a.billed);
    return { items };
  }

  private async computeWonByGame(filters: {
    salePointId?: string;
    salePointIds: string[];
    sellerId?: string;
    from?: Date;
    to?: Date;
  }): Promise<Map<string, number>> {
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      salePointId: filters.salePointId,
      salePointIds: filters.salePointIds,
      sellerId: filters.sellerId,
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
      const draw = drawByKey.get(`${t.gameId}|${t.drawAt.toISOString()}`) ?? null;
      const ev = this.evaluator.evaluateWith(t, game, draw);
      if (ev.totalPrize > 0) {
        won.set(t.gameId, (won.get(t.gameId) ?? 0) + ev.totalPrize);
      }
    }
    return won;
  }
}
