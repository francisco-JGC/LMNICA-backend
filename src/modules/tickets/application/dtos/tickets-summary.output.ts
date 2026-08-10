/**
 * Aggregated totals for a set of tickets. Every amount is in centavos
 * (integer), same units as `tickets.total`.
 */
export interface TicketsSummaryOutput {
  /** Number of `valid` tickets in the range (not counting voided). */
  ticketCount: number;
  /** Number of tickets marked as voided in the range. */
  voidedCount: number;
  /** Sum of `tickets.total` for `valid` tickets — i.e., collected billing. */
  billed: number;
  /**
   * Total ganado por los tickets del rango, evaluado contra los
   * `draw_results` registrados. Reemplaza el viejo `paidPrize` (que
   * dependía del flag `paid_at`, ya eliminado).
   */
  wonPrize: number;
  /**
   * Seller commission: `billed * paymentPercentage / 100`, rounded. Only
   * present when the query is scoped to a single seller and that user has
   * a `paymentPercentage` configured; otherwise `null`.
   */
  salary: number | null;
  /** The rate that produced `salary`. Null when `salary` is null. */
  paymentPercentage: number | null;
}
