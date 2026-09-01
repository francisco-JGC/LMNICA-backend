import { Movement } from '../../domain/entities/movement.entity';
import { MovementType } from '../../domain/value-objects/movement-type';

export interface MovementOutput {
  id: string;
  salePointId: string | null;
  sellerId: string | null;
  isPrizePayment: boolean;
  type: MovementType;
  amount: number;
  description: string;
  occurredAt: Date;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toMovementOutput = (movement: Movement): MovementOutput => ({
  id: movement.id,
  salePointId: movement.salePointId,
  sellerId: movement.sellerId,
  isPrizePayment: movement.isPrizePayment,
  type: movement.type,
  amount: movement.amount,
  description: movement.description,
  occurredAt: movement.occurredAt,
  createdById: movement.createdById,
  createdAt: movement.createdAt,
  updatedAt: movement.updatedAt,
});
