import type { SaleLimitBySellerNumber } from '../../domain/entities/sale-limit-by-seller-number.entity';

export interface SaleLimitBySellerNumberOutput {
  id: string;
  salePointId: string;
  sellerId: string;
  gameId: string;
  label: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toSaleLimitBySellerNumberOutput = (
  entity: SaleLimitBySellerNumber,
): SaleLimitBySellerNumberOutput => ({
  id: entity.id,
  salePointId: entity.salePointId,
  sellerId: entity.sellerId,
  gameId: entity.gameId,
  label: entity.label,
  amount: entity.amount,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});
