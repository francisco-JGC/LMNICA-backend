/**
 * Kinds of cash movements tracked at a sucursal. Ticket sales and prize
 * payouts are NOT stored here — they're derived from the `tickets` table.
 * These types cover the manual/operational money flow that lives outside
 * the ticket lifecycle.
 */
export enum MovementType {
  /** Operational cost paid out (rent, wages, supplies). Subtracts from cash. */
  EXPENSE = 'expense',
  /** Cash added to the sucursal — top-ups, bank withdrawals coming in. Adds. */
  DEPOSIT = 'deposit',
  /** Cash removed from the sucursal — deposits to bank, transfers out. Subtracts. */
  WITHDRAWAL = 'withdrawal',
  /** Cash counted at start of day. Baseline for the day's flow. */
  OPENING = 'opening',
  /** Cash counted at end of day. Reconciles against expected. */
  CLOSING = 'closing',
  /** Manual reconciliation entry (positive or negative — sign lives in a note). */
  ADJUSTMENT = 'adjustment',
}

/**
 * Sign of each type in the cash-balance formula:
 * `net = sum(inflows) - sum(outflows)`. Opening/closing don't contribute to
 * net directly — they're informational bookkeeping markers. Adjustment uses
 * the signed amount directly: positive = adds to net, negative = subtracts.
 */
export const MOVEMENT_SIGN: Record<MovementType, 1 | -1 | 0> = {
  [MovementType.EXPENSE]: -1,
  [MovementType.DEPOSIT]: +1,
  [MovementType.WITHDRAWAL]: -1,
  [MovementType.OPENING]: 0,
  [MovementType.CLOSING]: 0,
  [MovementType.ADJUSTMENT]: +1,
};
