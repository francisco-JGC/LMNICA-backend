import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import type { DrawResult } from '../../../games/domain/entities/draw-result.entity';
import type { Game } from '../../../games/domain/entities/game.entity';
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
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketStatus } from '../../domain/value-objects/ticket-status';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';
import {
  TicketEvaluator,
  type TicketLineEvaluation,
} from '../services/ticket-evaluator.service';

export interface ListWinningTicketsInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  gameId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
  /** "HH:MM" wall clock in Managua — filter to draws at this time. */
  drawTime?: string;
}

export interface WinningTicketOutput {
  ticket: TicketOutput;
  totalPrize: number;
  lines: TicketLineEvaluation[];
}

@Injectable()
export class ListWinningTickets
  implements UseCase<ListWinningTicketsInput, WinningTicketOutput[]>
{
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly results: DrawResultsRepository,
    private readonly evaluator: TicketEvaluator,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: ListWinningTicketsInput,
  ): Promise<WinningTicketOutput[]> {
    const effectiveSellerId =
      input.requesterRole === UserRole.SELLER
        ? input.requesterId
        : input.sellerId;

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return [];

    const items = await this.tickets.findMany({
      sellerId: effectiveSellerId,
      salePointId: input.salePointId,
      salePointIds: partnerScope,
      gameId: input.gameId,
      status: TicketStatus.VALID,
      from: input.from,
      to: input.to,
      drawTime: input.drawTime,
      // Alineado con `GetMovementsBalance.computeWonBySalePoint` y
      // `GetDashboardSummary.loadWonKpis` — cualquier valor menor causaba
      // que la pantalla de "Boletos ganadores" mostrara un total menor
      // al "Pérdida hoy" del dashboard cuando el rango tenía > 1000
      // tickets (ordenado por `createdAt DESC` en `findMany`, se perdían
      // los ganadores más viejos del rango).
      limit: 100_000,
      offset: 0,
    });
    if (items.length === 0) return [];

    // Bulk-load games + draw_results ONCE instead of per-ticket. Previous
    // implementation did 2N sequential DB roundtrips inside the evaluator,
    // which timed out (>15s) as soon as the range held a few hundred tickets.
    const games = await this.games.findAll({ onlyActive: false });
    const gamesById = new Map<string, Game>();
    for (const g of games) gamesById.set(g.id, g);

    let minDraw = items[0].drawAt.getTime();
    let maxDraw = minDraw;
    for (const t of items) {
      const ms = t.drawAt.getTime();
      if (ms < minDraw) minDraw = ms;
      if (ms > maxDraw) maxDraw = ms;
    }
    const drawResults = await this.results.findMany({
      from: new Date(minDraw),
      to: new Date(maxDraw),
    });
    const resultsByKey = new Map<string, DrawResult>();
    for (const r of drawResults) {
      resultsByKey.set(this.resultKey(r.gameId, r.drawAt), r);
    }

    const winners: WinningTicketOutput[] = [];
    for (const ticket of items) {
      const game = gamesById.get(ticket.gameId) ?? null;
      const key = this.resultKey(ticket.gameId, ticket.drawAt);
      const result = resultsByKey.get(key) ?? null;
      const evaluation = this.evaluator.evaluateWith(ticket, game, result);
      if (!evaluation.isWinner) continue;
      winners.push({
        ticket: toTicketOutput(ticket),
        totalPrize: evaluation.totalPrize,
        lines: evaluation.lines,
      });
    }
    return winners;
  }

  private resultKey(gameId: string, drawAt: Date): string {
    return `${gameId}::${drawAt.getTime()}`;
  }
}
