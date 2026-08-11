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
  salaries: 0,
  deposits: 0,
  withdrawals: 0,
  expenses: 0,
  tickets: 0,
  averageTicket: 0,
  billedPrev: 0,
  wonPrev: 0,
  profitPrev: 0,
  salariesPrev: 0,
  depositsPrev: 0,
  withdrawalsPrev: 0,
  expensesPrev: 0,
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
      salariesKpis,
      movementsKpis,
      monthlySeries,
      byGame,
      recentWinners,
      topSellers,
      topSalePoints,
    ] = await Promise.all([
      this.loadKpis(scope, ranges),
      this.loadWonKpis(input, ranges),
      this.loadSalariesTotal(scope, ranges),
      this.loadMovementsFlow(scope, ranges),
      this.loadMonthlySeries(scope),
      this.loadGameBreakdown(scope, ranges),
      this.loadRecentWinners(input),
      this.loadTopSellers(scope, ranges),
      this.loadTopSalePoints(scope, ranges),
    ]);
    // Utilidad = facturado − pérdida − salarios + depósitos − retiros − gastos.
    // Es la MISMA fórmula que el "Restante neto" del Cálculo de movimiento
    // para garantizar que ambas pantallas muestren el mismo número.
    const profit =
      kpis.billed -
      wonKpis.won -
      salariesKpis.salaries +
      movementsKpis.deposits -
      movementsKpis.withdrawals -
      movementsKpis.expenses;
    const profitPrev =
      kpis.billedPrev -
      wonKpis.wonPrev -
      salariesKpis.salariesPrev +
      movementsKpis.depositsPrev -
      movementsKpis.withdrawalsPrev -
      movementsKpis.expensesPrev;

    return {
      ...kpis,
      ...wonKpis,
      ...salariesKpis,
      ...movementsKpis,
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
   * rango previo para la comparación. Reutiliza `ListWinningTickets`
   * para no duplicar la lógica de evaluación (exacto / fácil / premio
   * par); pedimos una sola vez la unión de ambos rangos y hacemos el
   * split en memoria por `createdAt`.
   */
  private async loadWonKpis(
    caller: DashboardSummaryInput,
    ranges: Ranges,
  ): Promise<{ won: number; wonPrev: number }> {
    const winners = await this.listWinningTickets.execute({
      requesterId: caller.requesterId,
      requesterRole: caller.requesterRole,
      from: ranges.prevFrom,
      to: ranges.to,
    });

    let won = 0;
    let wonPrev = 0;
    for (const w of winners) {
      const createdAt = new Date(w.ticket.createdAt);
      if (createdAt >= ranges.from && createdAt < ranges.to) {
        won += w.totalPrize;
      } else if (createdAt >= ranges.prevFrom && createdAt < ranges.prevTo) {
        wonPrev += w.totalPrize;
      }
    }
    return { won, wonPrev };
  }

  // --- Salaries -------------------------------------------------------------

  /**
   * Salarios totales del rango: SOLO comisiones del encargado sobre las
   * ventas de cada sucursal. Se descuentan del `profit` porque son
   * costos reales del operativo.
   *
   * NO incluye comisiones de vendedores — esas son costo interno de
   * cada sucursal frente a su encargado, no del owner global; mostrarlas
   * acá distorsionaría la utilidad general.
   *
   * Fuente del %: `sale_points.partner_payment_percentage`. Aplica
   * aunque la sucursal no tenga socio asignado como encargado — el %
   * es política de la sucursal, no del usuario que la opera.
   */
  private async loadSalariesTotal(
    scope: SalePointScope,
    ranges: Ranges,
  ): Promise<{ salaries: number; salariesPrev: number }> {
    const rows = await this.dataSource.query<
      Array<{
        encargado_salaries: string;
        encargado_salaries_prev: string;
      }>
    >(
      `
      WITH
        -- Sucursales en scope con % configurado.
        sucursales_pct AS (
          SELECT sp.id, sp.partner_payment_percentage AS pct
          FROM sale_points sp
          WHERE sp.id = ANY($1::uuid[])
            AND sp.partner_payment_percentage IS NOT NULL
        ),
        -- Facturado por sucursal (rango y prev), un solo scan.
        sucursal_billed AS (
          SELECT
            t.sale_point_id AS id,
            SUM(CASE
              WHEN t.created_at >= $2::timestamptz AND t.created_at < $3::timestamptz
              THEN t.total ELSE 0
            END)::bigint AS billed,
            SUM(CASE
              WHEN t.created_at >= $4::timestamptz AND t.created_at < $5::timestamptz
              THEN t.total ELSE 0
            END)::bigint AS billed_prev
          FROM tickets t
          WHERE t.status = 'valid'
            AND t.sale_point_id = ANY($1::uuid[])
            AND t.created_at >= $4::timestamptz
            AND t.created_at < $3::timestamptz
          GROUP BY t.sale_point_id
        )
      SELECT
        COALESCE((
          SELECT SUM(ROUND(sb.billed * s.pct / 100.0))
          FROM sucursales_pct s JOIN sucursal_billed sb ON sb.id = s.id
        ), 0)::bigint AS encargado_salaries,
        COALESCE((
          SELECT SUM(ROUND(sb.billed_prev * s.pct / 100.0))
          FROM sucursales_pct s JOIN sucursal_billed sb ON sb.id = s.id
        ), 0)::bigint AS encargado_salaries_prev
      `,
      [scope, ranges.from, ranges.to, ranges.prevFrom, ranges.prevTo],
    );
    const row = rows[0];
    const salaries = Number(row?.encargado_salaries ?? 0);
    const salariesPrev = Number(row?.encargado_salaries_prev ?? 0);
    return { salaries, salariesPrev };
  }

  // --- Movements (deposits / withdrawals / expenses) -----------------------

  /**
   * Agrega los movimientos manuales del rango — usa la misma tabla y las
   * mismas categorías que `GetMovementsBalance`, garantizando que la
   * "Utilidad" del dashboard reconcilie con el "Restante neto" que se ve
   * en Cálculo de movimiento.
   *
   * Un único query agrega rango actual + rango previo (para el delta).
   */
  private async loadMovementsFlow(
    scope: SalePointScope,
    ranges: Ranges,
  ): Promise<{
    deposits: number;
    withdrawals: number;
    expenses: number;
    depositsPrev: number;
    withdrawalsPrev: number;
    expensesPrev: number;
  }> {
    const rows = await this.dataSource.query<
      Array<{
        deposits: string;
        withdrawals: string;
        expenses: string;
        deposits_prev: string;
        withdrawals_prev: string;
        expenses_prev: string;
      }>
    >(
      `
      SELECT
        COALESCE(SUM(CASE
          WHEN m.type = 'deposit'
           AND m.occurred_at >= $2::timestamptz AND m.occurred_at < $3::timestamptz
          THEN m.amount ELSE 0 END), 0)::bigint AS deposits,
        COALESCE(SUM(CASE
          WHEN m.type = 'withdrawal'
           AND m.occurred_at >= $2::timestamptz AND m.occurred_at < $3::timestamptz
          THEN m.amount ELSE 0 END), 0)::bigint AS withdrawals,
        COALESCE(SUM(CASE
          WHEN m.type = 'expense'
           AND m.occurred_at >= $2::timestamptz AND m.occurred_at < $3::timestamptz
          THEN m.amount ELSE 0 END), 0)::bigint AS expenses,

        COALESCE(SUM(CASE
          WHEN m.type = 'deposit'
           AND m.occurred_at >= $4::timestamptz AND m.occurred_at < $5::timestamptz
          THEN m.amount ELSE 0 END), 0)::bigint AS deposits_prev,
        COALESCE(SUM(CASE
          WHEN m.type = 'withdrawal'
           AND m.occurred_at >= $4::timestamptz AND m.occurred_at < $5::timestamptz
          THEN m.amount ELSE 0 END), 0)::bigint AS withdrawals_prev,
        COALESCE(SUM(CASE
          WHEN m.type = 'expense'
           AND m.occurred_at >= $4::timestamptz AND m.occurred_at < $5::timestamptz
          THEN m.amount ELSE 0 END), 0)::bigint AS expenses_prev
      FROM movements m
      WHERE m.sale_point_id = ANY($1::uuid[])
        AND m.occurred_at >= $4::timestamptz
        AND m.occurred_at <  $3::timestamptz
      `,
      [scope, ranges.from, ranges.to, ranges.prevFrom, ranges.prevTo],
    );
    const row = rows[0];
    return {
      deposits: Number(row?.deposits ?? 0),
      withdrawals: Number(row?.withdrawals ?? 0),
      expenses: Number(row?.expenses ?? 0),
      depositsPrev: Number(row?.deposits_prev ?? 0),
      withdrawalsPrev: Number(row?.withdrawals_prev ?? 0),
      expensesPrev: Number(row?.expenses_prev ?? 0),
    };
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
      | 'salaries'
      | 'salariesPrev'
      | 'deposits'
      | 'depositsPrev'
      | 'withdrawals'
      | 'withdrawalsPrev'
      | 'expenses'
      | 'expensesPrev'
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
    // `execute()` como `billed - won - salaries` una vez que
    // `loadWonKpis` y `loadSalariesTotal` resuelven.
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
          THEN t.total ELSE 0 END), 0)::bigint AS billed
      FROM months m
      LEFT JOIN tickets t ON true
      GROUP BY m.month_start
      ORDER BY m.month_start ASC
      `,
      [BUSINESS_TZ, MONTHS_IN_SERIES, scope],
    );

    // `won` requeriría evaluar tickets de 7 meses contra sus draw_results
    // (caro para el dashboard). Por ahora devolvemos 0 — el chart solo
    // mostraría "Facturado" como serie principal. Si se necesita "Ganado"
    // acá, hay que agregar bulk evaluation con TicketEvaluator.
    return rows.map((r) => {
      const date = new Date(r.month_start);
      const label = MONTH_LABELS[date.getUTCMonth()] ?? '';
      return {
        monthStart: this.formatMonthStart(date),
        label,
        billed: Number(r.billed),
        won: 0,
      };
    });
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
