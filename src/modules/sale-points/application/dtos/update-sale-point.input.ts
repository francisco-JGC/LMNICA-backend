export interface UpdateSalePointInput {
  id: string;
  name?: string;
  code?: string;
  /**
   * `undefined` leaves the current owner untouched. `null` clears the
   * owning partner (sucursal returns to admin-only visibility). A UUID
   * assigns a new partner.
   */
  ownerPartnerId?: string | null;
  /**
   * `undefined` = deja el valor actual. `null` = borra la config
   * (encargado no cobra). Un entero 0-100 = nuevo %.
   */
  partnerPaymentPercentage?: number | null;
}
