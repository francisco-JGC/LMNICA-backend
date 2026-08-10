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
import { TicketEvaluator } from '../../../tickets/application/services/ticket-evaluator.service';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../../tickets/domain/repositories/tickets.repository';
import { TicketStatus } from '../../../tickets/domain/value-objects/ticket-status';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  MovementsBalanceOutput,
  MovementsBalanceRow,
} from '../dtos/movements-balance.output';

export interface GetMovementsBalanceInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  sale_point_id: string;
  billed: string;
  deposits: string;
  withdrawals: string;
  expenses: string;
}

/**
 * Combines ticket cash flow (sales − prizes) with manually-registered
 * movements (deposits, withdrawals, expenses) into a per-sucursal balance.
 * A single SQL round-trip using a UNION ALL keeps this cheap even as
 * volume grows.
 */
@Injectable()
export class GetMovementsBalance
  implements UseCase<GetMovementsBalanceInput, MovementsBalanceOutput>
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
    private readonly scope: PartnerScopeService,
    private readonly evaluator: TicketEvaluator,
  ) {}

  async execute(
    input: GetMovementsBalanceInput,
  ): Promise<MovementsBalanceOutput> {
    if (input.requesterRole === UserRole.SELLER) return { items: [] };

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    // Pull the six numeric buckets in one query. A UNION ALL is used so
    // sucursales without tickets can still show up because they have
    // movements (or vice versa), and both sides share the same filters.
    const rows = await this.dataSource.query<RawRow[]>(
      `
      WITH
        ticket_flow AS (
          SELECT
            t.sale_point_id::text AS sale_point_id,
            COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed
          FROM tickets t
          WHERE ($1::uuid IS NULL OR t.sale_point_id = $1::uuid)
            AND ($2::timestamptz IS NULL OR t.created_at >= $2::timestamptz)
            AND ($3::timestamptz IS NULL OR t.created_at <  $3::timestamptz)
            AND t.sale_point_id = ANY($4::uuid[])
          GROUP BY t.sale_point_id
        ),
        movement_flow AS (
          SELECT
            m.sale_point_id::text AS sale_point_id,
            COALESCE(SUM(CASE WHEN m.type = 'deposit'    THEN m.amount ELSE 0 END), 0)::bigint AS deposits,
            COALESCE(SUM(CASE WHEN m.type = 'withdrawal' THEN m.amount ELSE 0 END), 0)::bigint AS withdrawals,
            COALESCE(SUM(CASE WHEN m.type = 'expense'    THEN m.amount ELSE 0 END), 0)::bigint AS expenses
          FROM movements m
          WHERE ($1::uuid IS NULL OR m.sale_point_id = $1::uuid)
            AND ($2::timestamptz IS NULL OR m.occurred_at >= $2::timestamptz)
            AND ($3::timestamptz IS NULL OR m.occurred_at <  $3::timestamptz)
            AND m.sale_point_id = ANY($4::uuid[])
          GROUP BY m.sale_point_id
        )
      SELECT
        COALESCE(tf.sale_point_id, mf.sale_point_id) AS sale_point_id,
        COALESCE(tf.billed, 0)::bigint      AS billed,
        COALESCE(mf.deposits, 0)::bigint    AS deposits,
        COALESCE(mf.withdrawals, 0)::bigint AS withdrawals,
        COALESCE(mf.expenses, 0)::bigint    AS expenses
      FROM ticket_flow tf
      FULL OUTER JOIN movement_flow mf ON mf.sale_point_id = tf.sale_point_id
      `,
      [
        input.salePointId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    if (rows.length === 0) return { items: [] };

    // Compute wonPrize per sucursal — evaluamos todos los tickets del rango
    // contra sus draw results (paid o no) usando el TicketEvaluator. La
    // lógica de match (exacto/fácil/premio par) vive en el evaluator, así
    // no la duplicamos en SQL.
    const wonBySalePoint = await this.computeWonBySalePoint({
      salePointId: input.salePointId,
      salePointIds: partnerScope,
      from: input.from,
      to: input.to,
    });

    // Bulk-resolve sucursal + partner names.
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
    const partnerById = new Map(partners.map((p) => [p.id, p]));

    const items: MovementsBalanceRow[] = rows.map((r) => {
      const sp = salePointById.get(r.sale_point_id);
      const billed = Number(r.billed);
      const wonPrize = wonBySalePoint.get(r.sale_point_id) ?? 0;
      const deposits = Number(r.deposits);
      const withdrawals = Number(r.withdrawals);
      const expenses = Number(r.expenses);
      // Salario del encargado: % configurado a nivel sucursal, aplicado
      // sobre lo facturado en el rango. El % vive en la sucursal (no en
      // el usuario) porque hay sucursales que las opera directamente el
      // owner sin encargado asignado y el cálculo igual sirve.
      const owner = sp?.ownerPartnerId
        ? partnerById.get(sp.ownerPartnerId) ?? null
        : null;
      const pct = sp?.partnerPaymentPercentage ?? null;
      const partnerSalary =
        pct !== null ? Math.round((billed * pct) / 100) : null;
      // Net usa `wonPrize` (deuda total con ganadores) + descuenta el
      // salario del encargado — ambos son costos reales que reducen el
      // dinero que efectivamente le queda al owner de la operación.
      const net =
        billed -
        wonPrize -
        (partnerSalary ?? 0) +
        deposits -
        withdrawals -
        expenses;
      return {
        salePointId: r.sale_point_id,
        salePointName: sp?.name ?? '—',
        ownerPartnerId: sp?.ownerPartnerId ?? null,
        ownerPartnerName: owner?.name ?? null,
        ownerPartnerPhone: owner?.phone ?? null,
        partnerPaymentPercentage: pct,
        partnerSalary,
        billed,
        wonPrize,
        deposits,
        withdrawals,
        expenses,
        net,
      };
    });

    items.sort((a, b) => b.net - a.net);
    return { items };
  }

  /**
   * Evalúa todos los tickets válidos del rango contra sus draw results y
   * devuelve `salePointId -> totalWonPrize`. Un ticket sin draw registrado
   * (sorteo aún no ocurrido o resultado no cargado) contribuye 0 —
   * `TicketEvaluator.evaluateWith` lo devuelve como pending.
   *
   * Batch strategy:
   *   1. fetch tickets (con lines cargadas).
   *   2. fetch all draws entre min(drawAt) y max(drawAt) — un solo query.
   *   3. fetch todos los juegos (~15 filas, cache-friendly).
   *   4. iterate y evaluate en TS.
   */
  private async computeWonBySalePoint(filters: {
    salePointId?: string;
    salePointIds?: string[];
    from?: Date;
    to?: Date;
  }): Promise<Map<string, number>> {
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      salePointId: filters.salePointId,
      salePointIds: filters.salePointIds,
      from: filters.from,
      to: filters.to,
      // Reporting query: no paginamos. En la práctica un reporte típico
      // (día/semana/mes) es cientos-miles de tickets, no millones.
      limit: 100_000,
      offset: 0,
    });
    if (tickets.length === 0) return new Map();

    // Rango de drawAts (independiente del range de created_at porque un
    // ticket creado el lunes puede apuntar al sorteo del jueves).
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
