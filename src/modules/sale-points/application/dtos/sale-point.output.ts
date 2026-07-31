import { SalePoint } from '../../domain/entities/sale-point.entity';

export interface SalePointOutput {
  id: string;
  name: string;
  code: string;
  /** Encargado de la sucursal (nullable). See SalePoint entity. */
  ownerPartnerId: string | null;
  /** Additional partners that can see this sucursal (read-only visibility). */
  assignedPartnerIds: string[];
  /** % semanal que se le paga al encargado sobre las ventas de la sucursal. */
  partnerPaymentPercentage: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const toSalePointOutput = (
  salePoint: SalePoint,
  assignedPartnerIds: string[] = [],
): SalePointOutput => ({
  id: salePoint.id,
  name: salePoint.name,
  code: salePoint.code,
  ownerPartnerId: salePoint.ownerPartnerId,
  assignedPartnerIds,
  partnerPaymentPercentage: salePoint.partnerPaymentPercentage,
  isActive: salePoint.isActive,
  createdAt: salePoint.createdAt,
  updatedAt: salePoint.updatedAt,
});
