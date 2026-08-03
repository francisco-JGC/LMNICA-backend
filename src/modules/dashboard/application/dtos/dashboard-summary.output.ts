export interface MonthlySeriesPoint {
  /** ISO first day of the month (YYYY-MM-01). */
  monthStart: string;
  /** Localized month label ("Enero", "Feb", ...). */
  label: string;
  /** Total billed (tickets.total) for that month, excluding voided tickets. */
  billed: number;
  /** Total paid (tickets.paid_prize) for that month. */
  paid: number;
}

export interface GameBreakdownItem {
  gameId: string;
  gameName: string;
  billed: number;
  paid: number;
}

export interface PendingPayoutPreview {
  ticketId: string;
  folio: string;
  gameId: string;
  gameName: string;
  drawAt: string;
  totalPrize: number;
  client: string | null;
}

export interface PendingPayouts {
  count: number;
  totalAmount: number;
  /** Top few most-recent unpaid winners — for a preview on the dashboard. */
  items: PendingPayoutPreview[];
}

export interface RankingItem {
  id: string;
  name: string;
  amount: number;
  ticketCount: number;
}

export interface DashboardSummaryOutput {
  // KPIs del rango solicitado (default = hoy en Managua).
  billed: number;
  paid: number;
  /**
   * Suma de premios ganados por tickets vendidos en el rango — pagados
   * o no. Se evalúa contra los `draw_results` registrados; los tickets
   * cuyo sorteo aún no tiene resultado contribuyen 0.
   */
  won: number;
  /**
   * `billed − won − salaries`. Utilidad real después de descontar
   * premios adeudados a clientes Y salarios de vendedores + encargados.
   */
  profit: number;
  /**
   * Suma de todos los salarios del rango:
   *   Σ (vendedor_facturado × pct_vendedor) + Σ (sucursal_facturada × pct_encargado)
   * Descontados en `profit` porque son costos reales.
   */
  salaries: number;
  tickets: number;
  averageTicket: number;

  // Mismos KPIs para el período equivalente inmediato anterior — usado
  // para calcular deltas de comparación. Si el rango son 3 días, el
  // "prev" son los 3 días previos.
  billedPrev: number;
  paidPrev: number;
  wonPrev: number;
  profitPrev: number;
  salariesPrev: number;
  ticketsPrev: number;

  // Weekly window (last 7 days) + previous week for comparison —
  // independiente del rango seleccionado.
  weeklyBilled: number;
  weeklyBilledPrev: number;

  // Users
  totalUsers: number;

  // Rest — usan el rango también.
  monthlySeries: MonthlySeriesPoint[];
  byGame: GameBreakdownItem[];
  pendingPayouts: PendingPayouts;
  topSellers: RankingItem[];
  topSalePoints: RankingItem[];
}
