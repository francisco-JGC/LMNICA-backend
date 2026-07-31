export interface CreateSalePointInput {
  name: string;
  code: string;
  /**
   * Optional partner (socio) that will own this sucursal. When null the
   * main admin/owner is the direct operator and the sucursal is only
   * visible to admins.
   */
  ownerPartnerId?: string | null;
  /** % semanal al encargado. Ver SalePoint entity. */
  partnerPaymentPercentage?: number | null;
}
