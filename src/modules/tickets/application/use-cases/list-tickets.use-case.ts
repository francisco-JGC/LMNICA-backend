import { Inject, Injectable } from '@nestjs/common';

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
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import type { TicketStatus } from '../../domain/value-objects/ticket-status';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';
import { TicketEvaluator } from '../services/ticket-evaluator.service';

export interface ListTicketsInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  gameId?: string;
  sellerId?: string;
  status?: TicketStatus;
  from?: Date;
  to?: Date;
  /** "HH:MM" wall clock in Managua tz — filter to draws at this time. */
  drawTime?: string;
  page: number;
  limit: number;
}

export interface ListTicketsOutput {
  items: TicketOutput[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class ListTickets implements UseCase<ListTicketsInput, ListTicketsOutput> {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    private readonly evaluator: TicketEvaluator,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: ListTicketsInput): Promise<ListTicketsOutput> {
    const effectiveSellerId =
      input.requesterRole === UserRole.SELLER
        ? input.requesterId
        : input.sellerId;

    // Partner scoping: admin sees todas las sucursales activas, partner
    // solo las suyas, seller ya se filtró por sellerId arriba. En cualquier
    // caso `accessibleSalePointIds` viene con las sucursales activas.
    const accessibleSalePointIds = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (accessibleSalePointIds.length === 0) {
      return { items: [], page: input.page, limit: input.limit, total: 0 };
    }

    const filters = {
      sellerId: effectiveSellerId,
      salePointId: input.salePointId,
      salePointIds: accessibleSalePointIds,
      gameId: input.gameId,
      status: input.status,
      from: input.from,
      to: input.to,
      drawTime: input.drawTime,
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    };

    const [items, total] = await Promise.all([
      this.tickets.findMany(filters),
      this.tickets.countMany(filters),
    ]);

    // Fetch draw_results de cada (game, drawAt) único para saber si el
    // sorteo ejecutó y evaluar el premio ganado. También cargamos los
    // games para que TicketEvaluator pueda aplicar las reglas específicas
    // del juego (exacto, fácil, premio par).
    const uniquePairs = new Map<string, { gameId: string; drawAt: Date }>();
    for (const ticket of items) {
      const key = `${ticket.gameId}|${ticket.drawAt.toISOString()}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, { gameId: ticket.gameId, drawAt: ticket.drawAt });
      }
    }
    const [drawByKey, gamesAll] = await Promise.all([
      Promise.all(
        Array.from(uniquePairs.entries()).map(async ([key, pair]) => {
          const result = await this.drawResults.findByGameAndDraw(
            pair.gameId,
            pair.drawAt,
          );
          return [key, result] as const;
        }),
      ).then((entries) => new Map(entries)),
      this.games.findAll({ onlyActive: false }),
    ]);
    const gameById = new Map(gamesAll.map((g) => [g.id, g]));

    return {
      items: items.map((ticket) => {
        const key = `${ticket.gameId}|${ticket.drawAt.toISOString()}`;
        const draw = drawByKey.get(key) ?? null;
        const game = gameById.get(ticket.gameId) ?? null;
        const evaluation = this.evaluator.evaluateWith(ticket, game, draw);
        return toTicketOutput(ticket, draw !== null, evaluation.totalPrize);
      }),
      page: input.page,
      limit: input.limit,
      total,
    };
  }
}
