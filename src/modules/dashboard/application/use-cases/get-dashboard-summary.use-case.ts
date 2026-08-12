import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { BUSINESS_TZ } from '../../../../shared/domain/business-time';
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
import { TicketEvaluator } from '../../../tickets/application/services/ticket-evaluator.service';
import { ListWinningTickets } from '../../../tickets/application/use-cases/list-winning-tickets.use-case';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../../tickets/domain/repositories/tickets.repository';
import { TicketStatus } from '../../../tickets/domain/value-objects/ticket-status';
import type {
  DashboardSummaryOutput,
  RecentWinnerPreview,
  RankingItem,
} from '../dtos/dashboard-summary.output';

const MONTHS_IN_SERIES = 7;

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

/** Managua es UTC-6 fijo (sin DST). Ver `BusinessTime` helper. */
const BUSINESS_TZ_OFFSET_HOURS = -6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DashboardSummaryInput {
  requesterId: string;
  requesterRole: UserRole;
  /** Inicio del rango a resumir (inclusive). Default = medianoche de hoy en Managua. */
  from?: Date;
  /** Fin del rango a resumir (exclusive-ish, inclusivo hasta 23:59:59). Default = fin del día de hoy. */
  to?: Date;
}

/** Scope of ACTIVE sale_points visible to the requester (never null). */
type SalePointScope = string[];

/**
 * Rango efectivo resuelto: [from, to) para la ventana pedida y su
 * equivalente previo inmediato para calcular deltas.
 */
interface Ranges {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

const EMPTY_SUMMARY: DashboardSummaryOutput = {
  billed: 0,
  won: 0,
  profit: 0,
  tickets: 0,
  averageTicket: 0,
  billedPrev: 0,
  wonPrev: 0,
  profitPrev: 0,
  ticketsPrev: 0,
  weeklyBilled: 0,
  weeklyBilledPrev: 0,
  totalUsers: 0,
  monthlySeries: [],
  byGame: [],
  recentWinners: { count: 0, totalAmount: 0, items: [] },
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
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    private readonly evaluator: TicketEvaluator,
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

    const ranges = this.resolveRanges(input.from, input.to);

    const [
      kpis,
      wonKpis,
      monthlySeries,
      byGame,
      recentWinners,
      topSellers,
      topSalePoints,
    ] = await Promise.all([
      this.loadKpis(scope, ranges),
      this.loadWonKpis(scope, ranges),
      this.loadMonthlySeries(scope),
      this.loadGameBreakdown(scope, ranges),
      this.loadRecentWinners(input),
      this.loadTopSellers(scope, ranges),
      this.loadTopSalePoints(scope, ranges),
    ]);
    // Utilidad = facturado − pérdida. Deliberadamente NO incluye salarios
    // ni movements manuales — el dashboard muestra la ganancia bruta antes
    // de operativos y ajustes de caja. El "Restante" (post-operativos) vive
    // en la pantalla de Cálculo de movimiento como métrica separada.
    const profit = kpis.billed - wonKpis.won;
    const profitPrev = kpis.billedPrev - wonKpis.wonPrev;

    return {
      ...kpis,
      ...wonKpis,
      profit,
      profitPrev,
      monthlySeries,
      byGame,
      recentWinners,
      topSellers,
      topSalePoints,
    };
  }

  // --- Ranges ---------------------------------------------------------------

  /**
   * Resuelve el rango pedido a límites concretos y calcula el período
   * equivalente inmediato anterior. Sin `from`/`to` → hoy en Managua
   * (00:00 a 24:00). El "prev" se computa como una ventana de la misma
   * duración terminando justo antes de `from`.
   *
   * Ejemplos:
   *  - Solo hoy (1 día): prev = ayer.
   *  - 3 días: prev = los 3 días previos.
   *  - 15 días: prev = los 15 días previos.
   *
   * `from` se ancla al inicio del día de Managua para que un rango como
   * "del 1 al 5" cubra completo el día 5 aunque el cliente mande
   * `2026-01-05T00:00:00-06:00` con la ambigüedad exclusive/inclusive.
   */
  private resolveRanges(from: Date | undefined, to: Date | undefined): Ranges {
    if (from === undefined || to === undefined) {
      const { todayStart, todayEnd, yesterdayStart } = this.todayBoundaries();
      return {
        from: todayStart,
        to: todayEnd,
        prevFrom: yesterdayStart,
        prevTo: todayStart,
      };
    }
    // `to` inclusivo → sumamos 1ms para tener un límite exclusivo. Si el
    // cliente ya mandó fin de día (`23:59:59.999`), 1ms extra da el
    // inicio del día siguiente, que es exactamente lo que queremos.
    const inclusiveTo = new Date(to.getTime() + 1);
    const durationMs = inclusiveTo.getTime() - from.getTime();
    const prevTo = new Date(from.getTime());
    const prevFrom = new Date(from.getTime() - durationMs);
    return {
      from,
      to: inclusiveTo,
      prevFrom,
      prevTo,
    };
  }

  private todayBoundaries(): {
    todayStart: Date;
    todayEnd: Date;
    yesterdayStart: Date;
  } {
    const offsetMs = BUSINESS_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const nowBiz = new Date(Date.now() + offsetMs);
    const y = nowBiz.getUTCFullYear();
    const m = nowBiz.getUTCMonth();
    const d = nowBiz.getUTCDate();
    // Managua midnight = UTC medianoche del mismo día − offset (que es
    // negativo, así que resta = suma 6h en UTC).
    const managuaMidnightUtcMs = (day: number) =>
      Date.UTC(y, m, day) - offsetMs;
    return {
      todayStart: new Date(managuaMidnightUtcMs(d)),
      todayEnd: new Date(managuaMidnightUtcMs(d + 1)),
      yesterdayStart: new Date(managuaMidnightUtcMs(d - 1)),
    };
  }

  // --- Won-by-clients KPIs --------------------------------------------------

  /**
   * Suma de premios ganados por tickets vendidos en el rango — y en el
   * rango previo para la comparación.
   *
   * Replica exactamente la lógica de `GetMovementsBalance.computeWonBySalePoint`
   * (mismo `tickets.findMany` con límite alto + `TicketEvaluator.evaluateWith`
   * contra draw_results) para que el "Pérdida hoy" del dashboard sea el
   * mismo número que el "Premios ganados" del Cálculo de movimiento.
   *
   * Antes usábamos `ListWinningTickets` que trae con `limit: 1000` — si el
   * rango tenía > 1000 tickets el dashboard subcontaba (bug real observado
   * con 1817 tickets en un día). Acá usamos `100_000` como el balance.
   *
   * Los tickets con sorteos aún no ejecutados contribuyen 0 (el evaluator
   * los devuelve como pendientes) — así solo se cuentan premios de los
   * sorteos que ya cayeron, en línea con el modelo actual sin "pagado".
   */
  private async loadWonKpis(
    scope: SalePointScope,
    ranges: Ranges,
  ): Promise<{ won: number; wonPrev: number }> {
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      salePointIds: scope,
      from: ranges.prevFrom,
      to: ranges.to,
      limit: 100_000,
      offset: 0,
    });
    if (tickets.length === 0) return { won: 0, wonPrev: 0 };

    let minDrawMs = tickets[0].drawAt.getTime();
    let maxDrawMs = minDrawMs;
    for (const t of tickets) {
      const ms = t.drawAt.getTime();
      if (ms < minDrawMs) minDrawMs = ms;
      if (ms > maxDrawMs) maxDrawMs = ms;
    }

    const [draws, gamesAll] = await Promise.all([
      this.drawResults.findMany({
        from: new Date(minDrawMs),
        to: new Date(maxDrawMs),
      }),
      this.games.findAll({ onlyActive: false }),
    ]);
    const drawByKey = new Map(
      draws.map((d) => [`${d.gameId}|${d.drawAt.toISOString()}`, d]),
    );
    const gameById = new Map(gamesAll.map((g) => [g.id, g]));

    let won = 0;
    let wonPrev = 0;
    for (const t of tickets) {
      const game = gameById.get(t.gameId) ?? null;
      const key = `${t.gameId}|${t.drawAt.toISOString()}`;
      const draw = drawByKey.get(key) ?? null;
      const ev = this.evaluator.evaluateWith(t, game, draw);
      if (ev.totalPrize <= 0) continue;
      const createdAt = t.createdAt;
      if (createdAt >= ranges.from && createdAt < ranges.to) {
        won += ev.totalPrize;
      } else if (
        createdAt >= ranges.prevFrom &&
        createdAt < ranges.prevTo
      ) {
        wonPrev += ev.totalPrize;
      }
    }
    return { won, wonPrev };
  }

  // --- KPIs -----------------------------------------------------------------

  private async loadKpis(
    scope: SalePointScope,
    ranges: Ranges,
  ): Promise<
    Omit<
      DashboardSummaryOutput,
      | 'won'
      | 'wonPrev'
      | 'profit'
      | 'profitPrev'
      | 'monthlySeries'
      | 'byGame'
      | 'recentWinners'
      | 'topSellers'
      | 'topSalePoints'
    >
  > {
    // La ventana semanal es fija: últimos 7 días vs los 7 previos.
    // No depende del rango que eligió el usuario — es su propia métrica.
    const rows = await this.dataSource.query<
      Array<{
        billed: string;
        tickets: string;
        billed_prev: string;
        tickets_prev: string;
        weekly_billed: string;
        weekly_billed_prev: string;
        total_users: string;
      }>
    >(
      `
      SELECT
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND t.created_at >= $3::timestamptz AND t.created_at < $4::timestamptz
          THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND t.created_at >= $3::timestamptz AND t.created_at < $4::timestamptz
          THEN 1 ELSE 0 END), 0)::bigint AS tickets,

        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND t.created_at >= $5::timestamptz AND t.created_at < $6::timestamptz
          THEN t.total ELSE 0 END), 0)::bigint AS billed_prev,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND t.created_at >= $5::timestamptz AND t.created_at < $6::timestamptz
          THEN 1 ELSE 0 END), 0)::bigint AS tickets_prev,

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
      [BUSINESS_TZ, scope, ranges.from, ranges.to, ranges.prevFrom, ranges.prevTo],
    );
    const row = rows[0];
    const billed = Number(row?.billed ?? 0);
    const tickets = Number(row?.tickets ?? 0);
    const billedPrev = Number(row?.billed_prev ?? 0);
    const ticketsPrev = Number(row?.tickets_prev ?? 0);
    // `profit` / `profitPrev` NO se calculan acá — se computan en
    // `execute()` como `billed - won` una vez que `loadWonKpis` resuelve.
    return {
      billed,
      tickets,
      averageTicket: tickets === 0 ? 0 : Math.round(billed / tickets),
      billedPrev,
      ticketsPrev,
      weeklyBilled: Number(row?.weekly_billed ?? 0),
      weeklyBilledPrev: Number(row?.weekly_billed_prev ?? 0),
      totalUsers: Number(row?.total_users ?? 0),
    };
  }

  // --- Monthly series -------------------------------------------------------

  private async loadMonthlySeries(
    scope: SalePointScope,
  ): Promise<DashboardSummaryOutput['monthlySeries']> {
    // Serie histórica — no depende del rango elegido. Muestra siempre
    // los últimos N meses para dar contexto al KPI del rango.
    //
    // Corre en paralelo: (1) query SQL de facturado por mes, (2) bulk
    // fetch + evaluación de tickets para computar el `won` por mes.
    const [billedRows, wonByMonth] = await Promise.all([
      this.loadMonthlyBilled(scope),
      this.loadMonthlyWon(scope),
    ]);

    return billedRows.map((r) => {
      const date = new Date(r.month_start);
      const label = MONTH_LABELS[date.getUTCMonth()] ?? '';
      const monthStart = this.formatMonthStart(date);
      return {
        monthStart,
        label,
        billed: Number(r.billed),
        won: wonByMonth.get(monthStart) ?? 0,
      };
    });
  }

  private async loadMonthlyBilled(
    scope: SalePointScope,
  ): Promise<Array<{ month_start: Date; billed: string }>> {
    return this.dataSource.query<Array<{ month_start: Date; billed: string }>>(
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
          THEN t.total ELSE 0 END), 0)::bigint AS billed
      FROM months m
      LEFT JOIN tickets t ON true
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
      `,
      [BUSINESS_TZ, MONTHS_IN_SERIES, scope],
    );
  }

  /**
   * Evalúa todos los tickets válidos de los últimos N meses contra sus
   * draw_results y agrupa el `totalPrize` por mes (biz-tz) del `createdAt`.
   * Mismo enfoque que `loadWonKpis` — bulk fetch + evaluator loop — para
   * garantizar consistencia entre las métricas del rango y la serie
   * histórica.
   *
   * Nota de perf: para operaciones grandes (~2000 tickets/día → 420k en 7
   * meses) usamos `limit: 500_000`. Si en el futuro se supera, hay que
   * dividir en queries por mes con Promise.all.
   */
  private async loadMonthlyWon(
    scope: SalePointScope,
  ): Promise<Map<string, number>> {
    const rangeStart = this.monthStartInBiz(MONTHS_IN_SERIES - 1);
    const tickets = await this.tickets.findMany({
      status: TicketStatus.VALID,
      salePointIds: scope,
      from: rangeStart,
      // Sin `to` → todo el histórico hasta hoy. Un ticket cuyo sorteo
      // aún no ocurrió contribuye 0 al totalPrize (evaluator lo devuelve
      // como pendiente).
      limit: 500_000,
      offset: 0,
    });
    if (tickets.length === 0) return new Map();

    let minDrawMs = tickets[0].drawAt.getTime();
    let maxDrawMs = minDrawMs;
    for (const t of tickets) {
      const ms = t.drawAt.getTime();
      if (ms < minDrawMs) minDrawMs = ms;
      if (ms > maxDrawMs) maxDrawMs = ms;
    }

    const [draws, gamesAll] = await Promise.all([
      this.drawResults.findMany({
        from: new Date(minDrawMs),
        to: new Date(maxDrawMs),
      }),
      this.games.findAll({ onlyActive: false }),
    ]);
    const drawByKey = new Map(
      draws.map((d) => [`${d.gameId}|${d.drawAt.toISOString()}`, d]),
    );
    const gameById = new Map(gamesAll.map((g) => [g.id, g]));

    const wonByMonth = new Map<string, number>();
    for (const t of tickets) {
      const game = gameById.get(t.gameId) ?? null;
      const key = `${t.gameId}|${t.drawAt.toISOString()}`;
      const draw = drawByKey.get(key) ?? null;
      const ev = this.evaluator.evaluateWith(t, game, draw);
      if (ev.totalPrize <= 0) continue;
      const monthKey = this.monthKeyInBiz(t.createdAt);
      wonByMonth.set(monthKey, (wonByMonth.get(monthKey) ?? 0) + ev.totalPrize);
    }
    return wonByMonth;
  }

  /**
   * Devuelve el 1° del mes en Managua (como Date UTC) para el mes actual
   * menos `monthsBack`. Ejemplo: monthsBack=0 → 2026-08-01 00:00 Managua,
   * monthsBack=6 → 2026-02-01 00:00 Managua.
   */
  private monthStartInBiz(monthsBack: number): Date {
    const offsetMs = BUSINESS_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const nowBiz = new Date(Date.now() + offsetMs);
    const y = nowBiz.getUTCFullYear();
    const m = nowBiz.getUTCMonth();
    return new Date(Date.UTC(y, m - monthsBack, 1) - offsetMs);
  }

  /**
   * Bucket "YYYY-MM-01" del `createdAt` en biz timezone. Coincide con la
   * clave que produce `formatMonthStart(row.month_start)` en el SQL query
   * de facturado, así el `won` se ancla al mismo mes.
   */
  private monthKeyInBiz(date: Date): string {
    const offsetMs = BUSINESS_TZ_OFFSET_HOURS * 60 * 60 * 1000;
    const bizDate = new Date(date.getTime() + offsetMs);
    const y = bizDate.getUTCFullYear();
    const m = (bizDate.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}-01`;
  }

  // --- By game --------------------------------------------------------------

  private async loadGameBreakdown(
    scope: SalePointScope,
    ranges: Ranges,
  ): Promise<DashboardSummaryOutput['byGame']> {
    const rows = await this.dataSource.query<
      Array<{ id: string; name: string; billed: string }>
    >(
      `
      SELECT
        g.id,
        g.name,
        COALESCE(SUM(CASE
          WHEN t.status = 'valid'
           AND t.created_at >= $2::timestamptz AND t.created_at < $3::timestamptz
           AND t.sale_point_id = ANY($1::uuid[])
          THEN t.total ELSE 0 END), 0)::bigint AS billed
      FROM games g
      LEFT JOIN tickets t ON t.game_id = g.id
      GROUP BY g.id, g.name, g.order_index
      ORDER BY g.order_index ASC
      `,
      [scope, ranges.from, ranges.to],
    );
    // `won` acá también quedaría por evaluar contra draws — como el
    // dashboard usa esto solo para el chart "Facturación por juego",
    // dejamos 0 y no distorsiona el gráfico principal.
    return rows.map((r) => ({
      gameId: r.id,
      gameName: r.name,
      billed: Number(r.billed),
      won: 0,
    }));
  }

  // --- Recent winners -------------------------------------------------------

  private async loadRecentWinners(
    caller: DashboardSummaryInput,
  ): Promise<DashboardSummaryOutput['recentWinners']> {
    // Panorama de ganadores recientes → NO se filtra por el rango
    // seleccionado. Siempre miramos los últimos 30 días. Antes acá se
    // filtraba `paidAt === null` para mostrar solo "pendientes de pago";
    // con la eliminación del concepto de pago, ahora se listan todos.
    const winners = await this.listWinningTickets.execute({
      requesterId: caller.requesterId,
      requesterRole: caller.requesterRole,
      from: new Date(Date.now() - 30 * MS_PER_DAY),
      to: new Date(),
    });

    let total = 0;
    for (const w of winners) total += w.totalPrize;

    winners.sort(
      (a, b) =>
        new Date(b.ticket.drawAt).getTime() -
        new Date(a.ticket.drawAt).getTime(),
    );
    const preview = winners.slice(0, 4);
    const gameIds = Array.from(new Set(preview.map((w) => w.ticket.gameId)));
    const games = await Promise.all(
      gameIds.map((id) => this.games.findById(id)),
    );
    const gameNameById = new Map<string, string>();
    for (const g of games) if (g) gameNameById.set(g.id, g.name);

    const items: RecentWinnerPreview[] = preview.map((w) => ({
      ticketId: w.ticket.id,
      folio: w.ticket.folio,
      gameId: w.ticket.gameId,
      gameName: gameNameById.get(w.ticket.gameId) ?? '—',
      drawAt: new Date(w.ticket.drawAt).toISOString(),
      totalPrize: w.totalPrize,
      client: w.ticket.client,
    }));

    return { count: winners.length, totalAmount: total, items };
  }

  // --- Top sellers / sale points --------------------------------------------

  private async loadTopSellers(
    scope: SalePointScope,
    ranges: Ranges,
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
       AND t.created_at >= $2::timestamptz AND t.created_at < $3::timestamptz
       AND t.sale_point_id = ANY($1::uuid[])
      WHERE u.role = 'seller'
        AND u.sale_point_id = ANY($1::uuid[])
      GROUP BY u.id, u.name
      HAVING COALESCE(SUM(t.total), 0) > 0
      ORDER BY amount DESC
      LIMIT 5
      `,
      [scope, ranges.from, ranges.to],
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
    ranges: Ranges,
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
       AND t.created_at >= $2::timestamptz AND t.created_at < $3::timestamptz
      WHERE sp.id = ANY($1::uuid[])
      GROUP BY sp.id, sp.name
      HAVING COALESCE(SUM(t.total), 0) > 0
      ORDER BY amount DESC
      LIMIT 5
      `,
      [scope, ranges.from, ranges.to],
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
