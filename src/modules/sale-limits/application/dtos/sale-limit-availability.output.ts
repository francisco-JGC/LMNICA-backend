/**
 * How much room is left per number for a `(game, sucursal, drawAt)`.
 * Mobile uses this to render the number picker with "queda C$X" hints
 * and to grey out numbers that are already full.
 *
 * - `limit`: the configured cap in centavos, or `null` if no limit is set
 *   (any bet passes). Both cases keep the same shape so the client doesn't
 *   need special handling.
 * - `usage`: sold-so-far per `label` in the current draw. Labels not in the
 *   map have zero usage. Only VALID tickets count (voided ones freed the cap).
 */
export interface SaleLimitAvailabilityOutput {
  limit: number | null;
  maxPerTicket: number | null;
  usage: Record<string, number>;
}
