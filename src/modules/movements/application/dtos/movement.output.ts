import { Movement } from '../../domain/entities/movement.entity';
import { MovementType } from '../../domain/value-objects/movement-type';

export interface MovementOutput {
  id: string;
  salePointId: string | null;
  sellerId: string | null;
  sellerName: string | null;
  isPrizePayment: boolean;
  type: MovementType;
  amount: number;
  description: string;
  occurredAt: Date;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toMovementOutput = (
  movement: Movement,
  sellerName: string | null = null,
  createdByName: string | null = null,
): MovementOutput => ({
  id: movement.id,
  salePointId: movement.salePointId,
  sellerId: movement.sellerId,
  sellerName,
  isPrizePayment: movement.isPrizePayment,
  type: movement.type,
  amount: movement.amount,
  description: movement.description,
  occurredAt: movement.occurredAt,
  createdById: movement.createdById,
  createdByName,
  createdAt: movement.createdAt,
  updatedAt: movement.updatedAt,
});
