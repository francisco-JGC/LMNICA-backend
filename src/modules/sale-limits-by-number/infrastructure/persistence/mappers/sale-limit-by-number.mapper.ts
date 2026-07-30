import { SaleLimitByNumber } from '../../../domain/entities/sale-limit-by-number.entity';
import { SaleLimitByNumberOrmEntity } from '../entities/sale-limit-by-number.orm-entity';

export class SaleLimitByNumberMapper {
  static toDomain(orm: SaleLimitByNumberOrmEntity): SaleLimitByNumber {
    return SaleLimitByNumber.restore(orm.id, {
      salePointId: orm.salePointId,
      gameId: orm.gameId,
      label: orm.label,
      amount: orm.amount,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(entity: SaleLimitByNumber): SaleLimitByNumberOrmEntity {
    const orm = new SaleLimitByNumberOrmEntity();
    orm.id = entity.id;
    orm.salePointId = entity.salePointId;
    orm.gameId = entity.gameId;
    orm.label = entity.label;
    orm.amount = entity.amount;
    orm.createdAt = entity.createdAt;
    orm.updatedAt = entity.updatedAt;
    return orm;
  }
}
