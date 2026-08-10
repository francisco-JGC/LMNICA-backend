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
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  BranchTotalsOutput,
  BranchTotalsRow,
} from '../dtos/branch-totals.output';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketStatus } from '../../domain/value-objects/ticket-status';
import { TicketEvaluator } from '../services/ticket-evaluator.service';

export interface GetBranchTotalsInput {
  requesterId: string;
  requesterRole: UserRole;
  gameId?: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  sale_point_id: string;
  ticket_count: string;
  voided_count: string;
  billed: string;
}

/**
 * Aggregate revenue + payouts per sucursal for the "Totales por Sucursal"
 * report. Partners see only their sucursales; admins see everything.
 * A sucursal with zero tickets in the range does NOT appear.
 */
@Injectable()
export class GetBranchTotals
  implements UseCase<GetBranchTotalsInput, BranchTotalsOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
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
    input: GetBranchTotalsInput,
  ): Promise<BranchTotalsOutput> {
    // Sellers should never hit this endpoint (role-gated at controller);
    // this is a defense-in-depth guard for the use case.
    if (input.requesterRole === UserRole.SELLER) return { items: [] };

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        t.sale_point_id::text AS sale_point_id,
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed
      FROM tickets t
      WHERE ($1::uuid IS NULL OR t.game_id = $1::uuid)
        AND ($2::timestamptz IS NULL OR t.created_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR t.created_at <  $3::timestamptz)
        AND t.sale_point_id = ANY($4::uuid[])
      GROUP BY t.sale_point_id
      `,
      [
        input.gameId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    if (rows.length === 0) return { items: [] };

    // Computo wonPrize por sucursal evaluando cada ticket válido contra
    // su draw_result. Reemplaza el viejo paidPrize (que dependía de que
    // alguien marcara el ticket como pagado; ese concepto se eliminó).
    const wonBySalePoint = await this.computeWonBySalePoint({
      gameId: input.gameId,
      salePointIds: partnerScope,
      from: input.from,
      to: input.to,
    });

    // Bulk-resolve sucursal names + owner partner names.
    const salePointIds = rows.map((r) => r.sale_point_id);
    const salePoints = await Promise.all(
      salePointIds.map((id) => this.salePoints.findById(id)),
    );
    const salePointById = new Map(
      salePoints
        .filter((sp): sp is NonNullable<typeof sp> => sp !== null)
        .map((sp) => [sp.id, sp]),
    );

    const partnerIds = Array.from(
      new Set(
        salePoints
          .filter((sp): sp is NonNullable<typeof sp> => sp !== null)
          .map((sp) => sp.ownerPartnerId)
          .filter((id): id is string => id !== null),
      ),
    );
    const partners = await this.users.findByIds(partnerIds);
    const partnerNameById = new Map(partners.map((p) => [p.id, p.name]));

    const items: BranchTotalsRow[] = rows.map((r) => {
      const sp = salePointById.get(r.sale_point_id);
      const billed = Number(r.billed);
      const wonPrize = wonBySalePoint.get(r.sale_point_id) ?? 0;
      return {
        salePointId: r.sale_point_id,
        salePointName: sp?.name ?? '—',
        ownerPartnerId: sp?.ownerPartnerId ?? null,
        ownerPartnerName: sp?.ownerPartnerId
          ? partnerNameById.get(sp.ownerPartnerId) ?? null
          : null,
        ticketCount: Number(r.ticket_count),
        voidedCount: Number(r.voided_count),
        billed,
        wonPrize,
        net: billed - wonPrize,
      };
    });

    // Highest revenue first — matches the read order for a Sunday close-out.
    items.sort((a, b) => b.billed - a.billed);
    return { items };
  }

  /**
   * Evalúa tickets `valid` del rango contra sus draw_results y devuelve
   * `salePointId -> totalWonPrize`. Un ticket sin sorteo resuelto aún
   * contribuye 0. Mismo patrón que `GetMovementsBalance.computeWonBySalePoint`.
   */
  private async computeWonBySalePoint(filters: {
    gameId?: string;
    salePointIds: string[];
    from?: Date;
    to?: Date;
  }): Promise<Map<string, number>> {
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      gameId: filters.gameId,
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
        won.set(t.salePointId, (won.get(t.salePointId) ?? 0) + ev.totalPrize);
      }
    }
    return won;
  }
}
