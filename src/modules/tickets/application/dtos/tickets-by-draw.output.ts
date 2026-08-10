/**
 * Per-draw aggregate. One row per (game, drawAt) that had at least one
 * ticket in the requested window.
 */
export interface TicketsByDrawItem {
  gameId: string;
  drawAt: string;
  ticketCount: number;
  voidedCount: number;
  billed: number;
  /**
   * Total ganado por los tickets del sorteo (evaluado contra el
   * draw_result). 0 si el sorteo aún no tiene resultado registrado.
   */
  wonPrize: number;
  /** Winning number if the draw already has a registered result. */
  winningNumber: string | null;
}

export type TicketsByDrawOutput = TicketsByDrawItem[];
