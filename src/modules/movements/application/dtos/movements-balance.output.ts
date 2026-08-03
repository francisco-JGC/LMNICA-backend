/**
 * Cash balance per sucursal combining ticket flow (sales - prizes -
 * encargado salary) with manually-registered movements (expenses,
 * deposits, withdrawals). All amounts in centavos.
 *
 * Formula:
 *   net = billed - wonPrize - partnerSalary + deposits - withdrawals - expenses
 *
 * `wonPrize` es la deuda total con los ganadores (esté pagado o no).
 * `paidPrize` es informacional: cuánto ya salió efectivamente de caja.
 * `partnerSalary` es el salario del encargado según el % configurado;
 * es un costo real y se descuenta del net.
 */
export interface MovementsBalanceRow {
  salePointId: string;
  salePointName: string;
  ownerPartnerId: string | null;
  ownerPartnerName: string | null;
  /** Teléfono del encargado para compartir el reporte por WhatsApp. */
  ownerPartnerPhone: string | null;
  /**
   * % semanal configurado en la sucursal para el encargado
   * (`sale_points.partner_payment_percentage`). `null` = sin % configurado
   * o sin encargado asignado.
   */
  partnerPaymentPercentage: number | null;
  /**
   * Salario del encargado según el % configurado sobre las ventas de la
   * sucursal en el rango: `Math.round(billed * partnerPaymentPercentage / 100)`.
   * `null` cuando no hay encargado o no hay % configurado.
   */
  partnerSalary: number | null;
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
  /**
   * Final cash balance for the range:
   *   billed - wonPrize - partnerSalary + deposits - withdrawals - expenses
   */
  net: number;
}

export interface MovementsBalanceOutput {
  items: MovementsBalanceRow[];
}
