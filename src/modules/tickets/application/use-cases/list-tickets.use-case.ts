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
import { TicketStatus } from '../../domain/value-objects/ticket-status';
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
  /** Búsqueda por folio (prefix) o cliente (anywhere), case-insensitive. */
  search?: string;
}

export interface ListTicketsOutput {
  items: TicketOutput[];
  /** Cantidad total de items devueltos (mismo que `items.length`). */
  total: number;
  /** Suma de `total` (facturado) de todos los items válidos. */
  totalBilled: number;
  /** Suma de `wonPrize` (evaluado contra draw_results) de todos los items. */
  totalWonPrize: number;
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
    // solo las suyas, seller ya se filtró por sellerId arriba.
    const accessibleSalePointIds = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (accessibleSalePointIds.length === 0) {
      return { items: [], total: 0, totalBilled: 0, totalWonPrize: 0 };
    }

    // Sin paginación: devolvemos TODO el rango filtrado. El cap interno de
    // 100k es defensivo — en operaciones reales ni el vendedor más
    // productivo llega a decenas de miles de tickets en un rango razonable.
    // Antes paginábamos con LIMIT en SQL y el cliente sumaba localmente,
    // pero eso hacía que "Facturas" y "Boletos ganadores" reportaran
    // números distintos cuando había más tickets que el limit.
    //
    // Cuando llega `search` (folio o cliente), ignoramos el rango de fechas
    // y el `drawTime`: un folio es único a nivel sistema y el vendedor
    // busca ese boleto sin importar cuándo se emitió. Sin este bypass, un
    // folio de días previos nunca aparecía porque el default from/to es
    // "hoy". Mantenemos el resto de filtros (sucursal/juego/status/scope)
    // como AND para no romper el partner-scoping.
    const searchTerm = input.search?.trim();
    const isSearching = searchTerm !== undefined && searchTerm.length > 0;
    const tickets = await this.tickets.findMany({
      sellerId: effectiveSellerId,
      salePointId: input.salePointId,
      salePointIds: accessibleSalePointIds,
      gameId: input.gameId,
      status: input.status,
      from: isSearching ? undefined : input.from,
      to: isSearching ? undefined : input.to,
      drawTime: isSearching ? undefined : input.drawTime,
      search: isSearching ? searchTerm : undefined,
      limit: 100_000,
      offset: 0,
    });
    if (tickets.length === 0) {
      return { items: [], total: 0, totalBilled: 0, totalWonPrize: 0 };
    }

    // Bulk load: draws únicos + games. Un solo pass sobre el set completo.
    const uniquePairs = new Map<string, { gameId: string; drawAt: Date }>();
    for (const ticket of tickets) {
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

    // Evaluate cada ticket una sola vez: acumulamos totales y armamos los
    // items del response en el mismo loop.
    //
    // TICKETS ANULADOS:
    //   - Aparecen en `items` (para que la UI los muestre con su marca de
    //     "anulado" en la lista).
    //   - NO cuentan en `totalBilled` — un ticket anulado no es una venta.
    //   - NO cuentan en `totalWonPrize` — un ticket anulado no paga premio
    //     aunque hubiera "ganado", porque fue anulado antes o después.
    //   - El campo `wonPrize` del item anulado se fuerza a 0 (no exponemos
    //     el "premio hipotético" que hubiera pagado si no se anulaba —
    //     es información confusa).
    //
    // Con estas reglas el resultado de este endpoint concilia 1:1 con
    // `/tickets/winners` (que filtra VALID en el query) para el mismo
    // rango + filtros + scope.
    let totalBilled = 0;
    let totalWonPrize = 0;
    const items: TicketOutput[] = [];
    for (const ticket of tickets) {
      const isValid = ticket.status === TicketStatus.VALID;
      const key = `${ticket.gameId}|${ticket.drawAt.toISOString()}`;
      const draw = drawByKey.get(key) ?? null;
      const game = gameById.get(ticket.gameId) ?? null;
      const evaluation = this.evaluator.evaluateWith(ticket, game, draw);
      const wonForItem = isValid ? evaluation.totalPrize : 0;
      if (isValid) {
        totalBilled += ticket.total;
        if (evaluation.totalPrize > 0) totalWonPrize += evaluation.totalPrize;
      }
      items.push(toTicketOutput(ticket, draw !== null, wonForItem));
    }

    return {
      items,
      total: items.length,
      totalBilled,
      totalWonPrize,
    };
  }
}
