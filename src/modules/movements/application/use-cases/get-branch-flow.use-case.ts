import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  DRAW_RESULTS_REPOSITORY,
  type DrawResultsRepository,
} from '../../../games/domain/repositories/draw-results.repository';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { TicketEvaluator } from '../../../tickets/application/services/ticket-evaluator.service';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../../tickets/domain/repositories/tickets.repository';
import { TicketStatus } from '../../../tickets/domain/value-objects/ticket-status';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type { MovementType } from '../../domain/value-objects/movement-type';
import type {
  BranchFlowItem,
  BranchFlowKind,
  BranchFlowOutput,
} from '../dtos/branch-flow.output';

export interface GetBranchFlowInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  kind: BranchFlowKind;
  at: Date;
  amount: string;
  folio: string | null;
  movement_type: MovementType | null;
  description: string;
  ref_id: string;
}

/**
 * Chronological, per-sucursal timeline combining ticket sales, evaluated
 * prize payouts and manually-registered movements. Prizes are computed via
 * TicketEvaluator (same logic as billing/branch-totals) filtered by draw_at
 * in the requested range, so the timeline shows when prizes were actually
 * awarded (at draw time), not based on the deprecated paid_at flag.
 */
@Injectable()
export class GetBranchFlow
  implements UseCase<GetBranchFlowInput, BranchFlowOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(TICKETS_REPOSITORY)
    private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    @Inject(GAMES_REPOSITORY)
    private readonly games: GamesRepository,
    private readonly evaluator: TicketEvaluator,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: GetBranchFlowInput): Promise<BranchFlowOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException(
        'Los vendedores no ven el flujo de sucursal',
      );
    }
    if (!input.salePointId) {
      throw new ValidationError('salePointId es obligatorio');
    }

    // Verify the sucursal exists and the caller can see it.
    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    // Ticket sales + movements in one SQL round-trip.
    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        'ticket_sale'::text AS kind,
        t.created_at        AS at,
        t.total::bigint     AS amount,
        t.folio             AS folio,
        NULL::text          AS movement_type,
        ''::text            AS description,
        t.id::text          AS ref_id
      FROM tickets t
      WHERE t.sale_point_id = $1::uuid
        AND t.status = 'valid'
        AND ($2::timestamptz IS NULL OR t.created_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR t.created_at <  $3::timestamptz)

      UNION ALL

      SELECT
        'movement'::text    AS kind,
        m.occurred_at       AS at,
        m.amount::bigint    AS amount,
        NULL::text          AS folio,
        m.type::text        AS movement_type,
        m.description       AS description,
        m.id::text          AS ref_id
      FROM movements m
      WHERE m.sale_point_id = $1::uuid
        AND ($2::timestamptz IS NULL OR m.occurred_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR m.occurred_at <  $3::timestamptz)

      ORDER BY at ASC
      `,
      [input.salePointId, input.from ?? null, input.to ?? null],
    );

    const sqlItems: BranchFlowItem[] = rows.map((r) => ({
      kind: r.kind,
      at: r.at,
      amount: Number(r.amount),
      folio: r.folio,
      movementType: r.movement_type,
      description: r.description ?? '',
      refId: r.ref_id,
    }));

    // Prize events: tickets with draw_at in range, evaluated against results.
    const prizeItems = await this.computePrizeEvents(
      input.salePointId,
      input.from,
      input.to,
    );

    // Merge and re-sort chronologically (both sources are internally sorted).
    const items = [...sqlItems, ...prizeItems].sort(
      (a, b) => (a.at as Date).getTime() - (b.at as Date).getTime(),
    );

    return { items };
  }

  /**
   * Evaluates winning tickets whose draw_at falls in [from, to). Returns one
   * prize_payout BranchFlowItem per winning ticket, timestamped at draw_at.
   */
  private async computePrizeEvents(
    salePointId: string,
    from?: Date,
    to?: Date,
  ): Promise<BranchFlowItem[]> {
    const ticketList = await this.tickets.findMany({
      status: TicketStatus.VALID,
      salePointId,
      drawFrom: from,
      drawTo: to,
      limit: 100_000,
      offset: 0,
    });
    if (ticketList.length === 0) return [];

    let minDrawAt = ticketList[0].drawAt;
    let maxDrawAt = ticketList[0].drawAt;
    for (const t of ticketList) {
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

    const items: BranchFlowItem[] = [];
    for (const t of ticketList) {
      const game = gameById.get(t.gameId) ?? null;
      const draw = drawByKey.get(`${t.gameId}|${t.drawAt.toISOString()}`) ?? null;
      const ev = this.evaluator.evaluateWith(t, game, draw);
      if (ev.totalPrize > 0) {
        items.push({
          kind: 'prize_payout',
          at: t.drawAt,
          amount: ev.totalPrize,
          folio: t.folio,
          movementType: null,
          description: game?.name ?? '',
          refId: t.id,
        });
      }
    }
    return items;
  }
}
