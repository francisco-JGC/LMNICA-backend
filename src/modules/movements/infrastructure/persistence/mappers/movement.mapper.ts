import { Movement } from '../../../domain/entities/movement.entity';
import { MovementOrmEntity } from '../entities/movement.orm-entity';

export class MovementMapper {
  static toDomain(orm: MovementOrmEntity): Movement {
    return Movement.restore(orm.id, {
      salePointId: orm.salePointId ?? null,
      type: orm.type,
      amount: orm.amount,
      description: orm.description ?? '',
      occurredAt: orm.occurredAt,
      createdById: orm.createdById ?? null,
      clientRequestId: orm.clientRequestId ?? null,
      sellerId: orm.sellerId ?? null,
      isPrizePayment: orm.isPrizePayment ?? false,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(movement: Movement): MovementOrmEntity {
    const entity = new MovementOrmEntity();
    entity.id = movement.id;
    entity.salePointId = movement.salePointId;
    entity.type = movement.type;
    entity.amount = movement.amount;
    entity.description = movement.description;
    entity.occurredAt = movement.occurredAt;
    entity.createdById = movement.createdById;
    entity.clientRequestId = movement.clientRequestId;
    entity.sellerId = movement.sellerId;
    entity.isPrizePayment = movement.isPrizePayment;
    entity.createdAt = movement.createdAt;
    entity.updatedAt = movement.updatedAt;
    return entity;
  }
}
