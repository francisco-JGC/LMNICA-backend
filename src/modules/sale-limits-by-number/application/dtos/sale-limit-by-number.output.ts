import type { SaleLimitByNumber } from '../../domain/entities/sale-limit-by-number.entity';

export interface SaleLimitByNumberOutput {
  id: string;
  salePointId: string;
  gameId: string;
  label: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const toSaleLimitByNumberOutput = (
  entity: SaleLimitByNumber,
): SaleLimitByNumberOutput => ({
  id: entity.id,
  salePointId: entity.salePointId,
  gameId: entity.gameId,
  label: entity.label,
  amount: entity.amount,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});
