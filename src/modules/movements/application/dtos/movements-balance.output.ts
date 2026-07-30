/**
 * Cash balance per sucursal combining ticket flow (sales - prizes) with
 * manually-registered movements (expenses, deposits, withdrawals). All
 * amounts in centavos.
 *
 * Formula:
 *   net = billed - wonPrize + deposits - withdrawals - expenses
 *
 * `wonPrize` es la deuda total con los ganadores (esté pagado o no).
 * `paidPrize` es informacional: cuánto ya salió efectivamente de caja.
 */
export interface MovementsBalanceRow {
  salePointId: string;
  salePointName: string;
  ownerPartnerId: string | null;
  ownerPartnerName: string | null;
  /** Sum of `tickets.total` for `valid` tickets. */
  billed: number;
  /** Sum of `tickets.paid_prize` for tickets marked as paid. Informacional. */
  paidPrize: number;
  /**
   * Total ganado por los tickets del rango, esté pagado o no. Se evalúa
   * contra `draw_results.winning_number` respetando la lógica del juego
   * (exacto, fácil, premio par). Tickets sin resultado registrado aún no
   * contribuyen (quedan "pending").
   */
  wonPrize: number;
  /** Sum of `movements.amount` where type='deposit'. */
  deposits: number;
  /** Sum of `movements.amount` where type='withdrawal'. */
  withdrawals: number;
  /** Sum of `movements.amount` where type='expense'. */
  expenses: number;
  /** Final cash balance for the range: billed - wonPrize + net_movements. */
  net: number;
}

export interface MovementsBalanceOutput {
  items: MovementsBalanceRow[];
}
