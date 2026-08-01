import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { BUSINESS_TZ } from '../../../../shared/domain/business-time';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { ListWinningTickets } from '../../../tickets/application/use-cases/list-winning-tickets.use-case';
import type {
  DashboardSummaryOutput,
  PendingPayoutPreview,
  RankingItem,
} from '../dtos/dashboard-summary.output';

const MONTHS_IN_SERIES = 7;

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export interface DashboardSummaryInput {
  requesterId: string;
  requesterRole: UserRole;
}

/** Scope of ACTIVE sale_points visible to the requester (never null). */
type SalePointScope = string[];

const EMPTY_SUMMARY: DashboardSummaryOutput = {
  billedToday: 0,
  paidToday: 0,
  profitToday: 0,
  ticketsToday: 0,
  averageTicketToday: 0,
  billedYesterday: 0,
  paidYesterday: 0,
  profitYesterday: 0,
  ticketsYesterday: 0,
  weeklyBilled: 0,
  weeklyBilledPrev: 0,
  totalUsers: 0,
  monthlySeries: [],
  byGame: [],
  pendingPayouts: { count: 0, totalAmount: 0, items: [] },
  topSellers: [],
  topSalePoints: [],
};

/**
 * Aggregates the numbers powering the home dashboard.
 *
 * Everything is scoped by the caller: admins see the whole operation, partners
 * see only their sucursales, and no cross-partner leakage is possible because
 * the scope is derived server-side from the JWT.
 */
@Injectable()
export class GetDashboardSummary
  implements UseCase<DashboardSummaryInput, DashboardSummaryOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    private readonly listWinningTickets: ListWinningTickets,
    private readonly partnerScope: PartnerScopeService,
  ) {}

  async execute(input: DashboardSummaryInput): Promise<DashboardSummaryOutput> {
    const scope = await this.partnerScope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    // Sin sucursales visibles → todo en cero, no queries.
    if (scope.length === 0) return EMPTY_SUMMARY;

    const [
      kpis,
      monthlySeries,
      byGame,
      pendingPayouts,
      topSellers,
      topSalePoints,
    ] = await Promise.all([
      this.loadKpis(scope),
      this.loadMonthlySeries(scope),
      this.loadGameBreakdown(scope),
      this.loadPendingPayouts(input),
      this.loadTopSellers(scope),
      this.loadTopSalePoints(scope),
    ]);
    return {
      ...kpis,
      monthlySeries,
      byGame,
      pendingPayouts,
      topSellers,
      topSalePoints,
    };
  }

  // --- KPIs -----------------------------------------------------------------

  private async loadKpis(scope: SalePointScope): Promise<
    Omit<
      DashboardSummaryOutput,
      | 'monthlySeries'
      | 'byGame'
      | 'pendingPayouts'
      | 'topSellers'
      | 'topSalePoints'
    >
  > {
    const rows = await this.dataSource.query<
      Array<{
        billed_today: string;
        paid_today: string;
        tickets_today: string;
        billed_yesterday: string;
        paid_yesterday: string;
        tickets_yesterday: string;
        weekly_billed: string;
        weekly_billed_prev: string;
        total_users: string;
      }>
    >(
      // All "today" / "yesterday" boundaries are computed in BUSINESS_TZ so
      // the dashboard aligns with schedule cutoffs (which are also wall-clock
      // in that zone). `$2` is the partner scope: NULL means "no filter"
      // (admin); a uuid[] restricts to the caller's sucursales.
      `
      SELECT
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date
          THEN t.total ELSE 0 END), 0)::bigint AS billed_today,
        COALESCE(SUM(CASE
          WHEN t.paid_at IS NOT NULL
           AND (t.paid_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date
          THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_today,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date
          THEN 1 ELSE 0 END), 0)::bigint AS tickets_today,

        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date - 1
          THEN t.total ELSE 0 END), 0)::bigint AS billed_yesterday,
        COALESCE(SUM(CASE
          WHEN t.paid_at IS NOT NULL
           AND (t.paid_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date - 1
          THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_yesterday,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date - 1
          THEN 1 ELSE 0 END), 0)::bigint AS tickets_yesterday,

        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date >= (now() AT TIME ZONE $1)::date - 6
          THEN t.total ELSE 0 END), 0)::bigint AS weekly_billed,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date BETWEEN
                 (now() AT TIME ZONE $1)::date - 13 AND (now() AT TIME ZONE $1)::date - 7
          THEN t.total ELSE 0 END), 0)::bigint AS weekly_billed_prev,

        (
          SELECT COUNT(*) FROM users u
          WHERE u.sale_point_id = ANY($2::uuid[])
        )::bigint AS total_users
      FROM tickets t
      WHERE t.sale_point_id = ANY($2::uuid[])
      `,
      [BUSINESS_TZ, scope],
    );
    const row = rows[0];
    const billedToday = Number(row?.billed_today ?? 0);
    const paidToday = Number(row?.paid_today ?? 0);
    const ticketsToday = Number(row?.tickets_today ?? 0);
    const billedYesterday = Number(row?.billed_yesterday ?? 0);
    const paidYesterday = Number(row?.paid_yesterday ?? 0);
    const ticketsYesterday = Number(row?.tickets_yesterday ?? 0);
    return {
      billedToday,
      paidToday,
      profitToday: billedToday - paidToday,
      ticketsToday,
      averageTicketToday: ticketsToday === 0 ? 0 : Math.round(billedToday / ticketsToday),
      billedYesterday,
      paidYesterday,
      profitYesterday: billedYesterday - paidYesterday,
      ticketsYesterday,
      weeklyBilled: Number(row?.weekly_billed ?? 0),
      weeklyBilledPrev: Number(row?.weekly_billed_prev ?? 0),
      totalUsers: Number(row?.total_users ?? 0),
    };
  }

  // --- Monthly series -------------------------------------------------------

  private async loadMonthlySeries(
    scope: SalePointScope,
  ): Promise<DashboardSummaryOutput['monthlySeries']> {
    const rows = await this.dataSource.query<
      Array<{ month_start: Date; billed: string; paid: string }>
    >(
      `
      WITH months AS (
        SELECT
          (date_trunc('month', now() AT TIME ZONE $1)
            - (n || ' months')::interval)::date AS month_start
        FROM generate_series(0, $2 - 1) AS n
      )
      SELECT
        m.month_start,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date >= m.month_start
           AND (t.created_at AT TIME ZONE $1)::date <  (m.month_start + INTERVAL '1 month')::date
           AND t.sale_point_id = ANY($3::uuid[])
          THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE
          WHEN t.paid_at IS NOT NULL
           AND (t.paid_at AT TIME ZONE $1)::date >= m.month_start
           AND (t.paid_at AT TIME ZONE $1)::date <  (m.month_start + INTERVAL '1 month')::date
           AND t.sale_point_id = ANY($3::uuid[])
          THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid
      FROM months m
      LEFT JOIN tickets t ON true
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
      `,
      [BUSINESS_TZ, MONTHS_IN_SERIES, scope],
    );

    return rows.map((r) => {
      const date = new Date(r.month_start);
      const label = MONTH_LABELS[date.getUTCMonth()] ?? '';
      return {
        monthStart: this.formatMonthStart(date),
        label,
        billed: Number(r.billed),
        paid: Number(r.paid),
      };
    });
  }

  // --- By game --------------------------------------------------------------

  private async loadGameBreakdown(
    scope: SalePointScope,
  ): Promise<DashboardSummaryOutput['byGame']> {
    const rows = await this.dataSource.query<
      Array<{ id: string; name: string; billed: string; paid: string }>
    >(
      `
      SELECT
        g.id,
        g.name,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND (t.created_at AT TIME ZONE $1)::date >= (now() AT TIME ZONE $1)::date - 6
           AND t.sale_point_id = ANY($2::uuid[])
          THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE
          WHEN t.paid_at IS NOT NULL
           AND (t.paid_at AT TIME ZONE $1)::date >= (now() AT TIME ZONE $1)::date - 6
           AND t.sale_point_id = ANY($2::uuid[])
          THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid
      FROM games g
      LEFT JOIN tickets t ON t.game_id = g.id
      GROUP BY g.id, g.name, g.order_index
      ORDER BY g.order_index ASC
      `,
      [BUSINESS_TZ, scope],
    );
    return rows.map((r) => ({
      gameId: r.id,
      gameName: r.name,
      billed: Number(r.billed),
      paid: Number(r.paid),
    }));
  }

  // --- Pending payouts ------------------------------------------------------

  private async loadPendingPayouts(
    caller: DashboardSummaryInput,
  ): Promise<DashboardSummaryOutput['pendingPayouts']> {
    // Reuse the shared evaluator so the matching rules stay in a single
    // place — no duplicated three_digit "F" logic in SQL. Passing the
    // real caller lets ListWinningTickets apply partner scoping.
    const winners = await this.listWinningTickets.execute({
      requesterId: caller.requesterId,
      requesterRole: caller.requesterRole,
      from: new Date(Date.now() - 30 * 24 * 60 * 60_000),
      to: new Date(),
    });
    const unpaid = winners.filter((w) => w.ticket.paidAt === null);
    let total = 0;
    for (const w of unpaid) total += w.totalPrize;

    // Preview: most recent 4 unpaid winners, with game name resolved.
    unpaid.sort(
      (a, b) =>
        new Date(b.ticket.drawAt).getTime() -
        new Date(a.ticket.drawAt).getTime(),
    );
    const preview = unpaid.slice(0, 4);
    const gameIds = Array.from(new Set(preview.map((w) => w.ticket.gameId)));
    const games = await Promise.all(
      gameIds.map((id) => this.games.findById(id)),
    );
    const gameNameById = new Map<string, string>();
    for (const g of games) if (g) gameNameById.set(g.id, g.name);

    const items: PendingPayoutPreview[] = preview.map((w) => ({
      ticketId: w.ticket.id,
      folio: w.ticket.folio,
      gameId: w.ticket.gameId,
      gameName: gameNameById.get(w.ticket.gameId) ?? '—',
      drawAt: new Date(w.ticket.drawAt).toISOString(),
      totalPrize: w.totalPrize,
      client: w.ticket.client,
    }));

    return { count: unpaid.length, totalAmount: total, items };
  }

  // --- Top sellers / sale points --------------------------------------------

  private async loadTopSellers(
    scope: SalePointScope,
  ): Promise<RankingItem[]> {
    const rows = await this.dataSource.query<
      Array<{ id: string; name: string; amount: string; ticket_count: string }>
    >(
      `
      SELECT
        u.id,
        u.name,
        COALESCE(SUM(t.total), 0)::bigint AS amount,
        COUNT(t.id)::bigint AS ticket_count
      FROM users u
      LEFT JOIN tickets t
        ON t.seller_id = u.id
       AND t.status = 'valid'
       AND (t.created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date
       AND t.sale_point_id = ANY($2::uuid[])
      WHERE u.role = 'seller'
        AND u.sale_point_id = ANY($2::uuid[])
      GROUP BY u.id, u.name
      HAVING COALESCE(SUM(t.total), 0) > 0
      ORDER BY amount DESC
      LIMIT 5
      `,
      [BUSINESS_TZ, scope],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      amount: Number(r.amount),
      ticketCount: Number(r.ticket_count),
    }));
  }

  private async loadTopSalePoints(
    scope: SalePointScope,
  ): Promise<RankingItem[]> {
    const rows = await this.dataSource.query<
      Array<{ id: string; name: string; amount: string; ticket_count: string }>
    >(
      `
      SELECT
        sp.id,
        sp.name,
        COALESCE(SUM(t.total), 0)::bigint AS amount,
        COUNT(t.id)::bigint AS ticket_count
      FROM sale_points sp
      LEFT JOIN tickets t
        ON t.sale_point_id = sp.id
       AND t.status = 'valid'
       AND (t.created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date
      WHERE sp.id = ANY($2::uuid[])
      GROUP BY sp.id, sp.name
      HAVING COALESCE(SUM(t.total), 0) > 0
      ORDER BY amount DESC
      LIMIT 5
      `,
      [BUSINESS_TZ, scope],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      amount: Number(r.amount),
      ticketCount: Number(r.ticket_count),
    }));
  }

  // --- Helpers --------------------------------------------------------------

  private formatMonthStart(d: Date): string {
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}-01`;
  }
}
