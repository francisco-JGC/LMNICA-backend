/**
 * One row per seller: their aggregate totals over the requested date range,
 * plus the computed commission (`salary = billed × paymentPercentage / 100`).
 * Amounts are in centavos (integer), same as `tickets.total`.
 */
export interface SellerReportRow {
  sellerId: string;
  sellerName: string;
  /** Teléfono del vendedor para compartir el reporte por WhatsApp. */
  sellerPhone: string | null;
  ticketCount: number;
  voidedCount: number;
  paidCount: number;
  billed: number;
  paidPrize: number;
  /**
   * Total ganado por los tickets del vendedor en el rango, esté pagado o
   * no (evaluado contra `draw_results.winning_number`). "Lo que debería
   * entregar" en la UI. Tickets sin sorteo resuelto contribuyen 0.
   */
  wonPrize: number;
  paymentPercentage: number | null;
  /**
   * `Math.round(billed * paymentPercentage / 100)` when the seller has a
   * configured percentage; `null` otherwise (payroll can't be computed).
   */
  salary: number | null;
}

export interface SellerReportOutput {
  items: SellerReportRow[];
}
