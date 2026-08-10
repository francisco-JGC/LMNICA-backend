/**
 * One row per sucursal: aggregate revenue + prizes owed. All amounts
 * are in centavos (integer). `net = billed - wonPrize` is what stays
 * with the business after covering all winners of the range.
 */
export interface BranchTotalsRow {
  salePointId: string;
  salePointName: string;
  ownerPartnerId: string | null;
  ownerPartnerName: string | null;
  ticketCount: number;
  voidedCount: number;
  billed: number;
  /**
   * Total premios ganados en el rango (evaluados contra draw_results),
   * pagados o no. Antes se usaba `paidPrize`; ahora el concepto de
   * "pago" desapareció y todo se mide contra los resultados registrados.
   */
  wonPrize: number;
  net: number;
}

export interface BranchTotalsOutput {
  items: BranchTotalsRow[];
}
