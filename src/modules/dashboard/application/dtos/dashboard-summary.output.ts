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
  // Today
  billedToday: number;
  paidToday: number;
  profitToday: number;
  ticketsToday: number;
  averageTicketToday: number;

  // Yesterday (for delta calculations)
  billedYesterday: number;
  paidYesterday: number;
  profitYesterday: number;
  ticketsYesterday: number;

  // Weekly window (last 7 days) + previous week for comparison.
  weeklyBilled: number;
  weeklyBilledPrev: number;

  // Users
  totalUsers: number;

  // Rest
  monthlySeries: MonthlySeriesPoint[];
  byGame: GameBreakdownItem[];
  pendingPayouts: PendingPayouts;
  topSellers: RankingItem[];
  topSalePoints: RankingItem[];
}
