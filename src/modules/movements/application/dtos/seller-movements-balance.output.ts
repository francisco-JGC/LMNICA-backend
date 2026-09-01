/**
 * Per-seller movement totals for the requested range.
 *
 * cobros    = SUM of DEPOSIT movements (admin received money from seller)
 * credits   = SUM of WITHDRAWAL movements (admin gave money to seller)
 * prizePayments = SUM of movements flagged as prize payments
 *
 * These are overlapping: a prize payment movement is counted both in
 * cobros/credits (by type) AND in prizePayments (by flag).
 */
export interface SellerMovementsBalanceRow {
  sellerId: string;
  cobros: number;
  credits: number;
  prizePayments: number;
}

export interface SellerMovementsBalanceOutput {
  items: SellerMovementsBalanceRow[];
}
