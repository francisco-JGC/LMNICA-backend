import { SaleLimit } from '../../domain/entities/sale-limit.entity';

export interface SaleLimitOutput {
  id: string;
  gameId: string;
  salePointId: string;
  amount: number;
  maxPerTicket: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toSaleLimitOutput = (limit: SaleLimit): SaleLimitOutput => ({
  id: limit.id,
  gameId: limit.gameId,
  salePointId: limit.salePointId,
  amount: limit.amount,
  maxPerTicket: limit.maxPerTicket,
  createdAt: limit.createdAt,
  updatedAt: limit.updatedAt,
});
