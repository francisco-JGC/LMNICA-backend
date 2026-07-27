export interface CreateTicketLineInput {
  label: string;
  amount: number;
  prize: number;
  /**
   * Optional snapshot of the "premio par" prize for this line — used only
   * for THREE_DIGIT fácil lines when the sucursal has a pair-easy multiplier
   * configured. Older clients that don't send this field just leave the
   * column null and the rule is a no-op for that ticket.
   */
  pairEasyPrize?: number | null;
  subGameId?: string | null;
  subGameName?: string | null;
}

export interface CreateTicketApplicationInput {
  gameId: string;
  salePointId: string;
  sellerId: string;
  client: string | null;
  lines: CreateTicketLineInput[];
  drawAt?: Date;
}
