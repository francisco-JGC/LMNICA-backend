import { SaleLimitBySellerNumber } from '../../../domain/entities/sale-limit-by-seller-number.entity';
import { SaleLimitBySellerNumberOrmEntity } from '../entities/sale-limit-by-seller-number.orm-entity';

export class SaleLimitBySellerNumberMapper {
  static toDomain(
    orm: SaleLimitBySellerNumberOrmEntity,
  ): SaleLimitBySellerNumber {
    return SaleLimitBySellerNumber.restore(orm.id, {
      salePointId: orm.salePointId,
      sellerId: orm.sellerId,
      gameId: orm.gameId,
      label: orm.label,
      amount: orm.amount,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(
    entity: SaleLimitBySellerNumber,
  ): SaleLimitBySellerNumberOrmEntity {
    const orm = new SaleLimitBySellerNumberOrmEntity();
    orm.id = entity.id;
    orm.salePointId = entity.salePointId;
    orm.sellerId = entity.sellerId;
    orm.gameId = entity.gameId;
    orm.label = entity.label;
    orm.amount = entity.amount;
    orm.createdAt = entity.createdAt;
    orm.updatedAt = entity.updatedAt;
    return orm;
  }
}
