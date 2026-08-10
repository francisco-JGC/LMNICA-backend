/**
 * One row per game: how much was wagered on it and how much was paid out.
 * Amounts in centavos (integer). `share` is a fraction 0..1 that lets the
 * UI render % contribution without recomputing totals.
 */
export interface BillingByGameRow {
  gameId: string;
  gameName: string;
  ticketCount: number;
  voidedCount: number;
  billed: number;
  /**
   * Total ganado por tickets en el rango (evaluado contra draw_results).
   * Reemplaza el viejo `paidPrize` (dependía del flag paid, ya eliminado).
   */
  wonPrize: number;
  net: number;
  /** `billed / totalBilled` — 0 when `totalBilled` is zero. */
  share: number;
}

export interface BillingByGameOutput {
  items: BillingByGameRow[];
}
