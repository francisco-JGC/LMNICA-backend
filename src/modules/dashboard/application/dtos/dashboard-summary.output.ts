export interface GameBreakdownItem {
  gameId: string;
  gameName: string;
  billed: number;
  /** Ganado en el rango (evaluado contra draw_results). */
  won: number;
}

export interface RecentWinnerPreview {
  ticketId: string;
  folio: string;
  gameId: string;
  gameName: string;
  drawAt: string;
  totalPrize: number;
  client: string | null;
}

export interface RecentWinners {
  count: number;
  totalAmount: number;
  /** Últimos ganadores del panorama de 30 días — preview para el dashboard. */
  items: RecentWinnerPreview[];
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
  /**
   * Suma de premios ganados por tickets vendidos en el rango. Se evalúa
   * contra los `draw_results` registrados; los tickets cuyo sorteo aún
   * no tiene resultado contribuyen 0.
   */
  won: number;
  /**
   * Utilidad bruta = `billed − won`. Deliberadamente NO incluye salarios
   * ni movements manuales — refleja la ganancia bruta antes de operativos.
   * El "Restante neto" (post-operativos) se ve en Cálculo de movimiento.
   */
  profit: number;
  tickets: number;
  averageTicket: number;

  // Mismos KPIs para el período equivalente inmediato anterior — usado
  // para calcular deltas de comparación. Si el rango son 3 días, el
  // "prev" son los 3 días previos.
  billedPrev: number;
  wonPrev: number;
  profitPrev: number;
  ticketsPrev: number;

  // Weekly window (last 7 days) + previous week for comparison —
  // independiente del rango seleccionado.
  weeklyBilled: number;
  weeklyBilledPrev: number;

  // Users
  totalUsers: number;

  // Rest — usan el rango también.
  byGame: GameBreakdownItem[];
  /**
   * Ganadores recientes (últimos 30 días, no filtrado por el rango del
   * dashboard). Antes se llamaba `pendingPayouts` y solo mostraba los
   * unpaid — con la eliminación del concepto "pagado" ahora muestra
   * todos los ganadores del período.
   */
  recentWinners: RecentWinners;
  topSellers: RankingItem[];
  topSalePoints: RankingItem[];
}
