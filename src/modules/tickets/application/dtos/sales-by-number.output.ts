export interface SalesByNumberItem {
  /** ID del juego al que pertenece esta apuesta. */
  gameId: string;
  /** Nombre del juego (para render sin lookup extra en el cliente). */
  gameName: string;
  /**
   * "Número" apostado (label crudo). Formato depende del juego:
   *  - regular: `"42"`
   *  - threeDigit: `"123"` o `"123 (F)"` para fácil
   *  - fourDigit: `"1234"`
   *  - date: `"05-08"` (día-mes)
   */
  label: string;
  /** Cuántas veces se vendió este número (líneas en tickets válidos). */
  ticketCount: number;
  /** Monto total apostado a este número. */
  totalAmount: number;
}

export interface SalesByNumberOutput {
  items: SalesByNumberItem[];
}
