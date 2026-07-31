import { SalePoint } from '../../../domain/entities/sale-point.entity';
import { SalePointOrmEntity } from '../entities/sale-point.orm-entity';

export class SalePointMapper {
  static toDomain(orm: SalePointOrmEntity): SalePoint {
    return SalePoint.restore(orm.id, {
      name: orm.name,
      code: orm.code,
      ownerPartnerId: orm.ownerPartnerId,
      partnerPaymentPercentage: orm.partnerPaymentPercentage,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(salePoint: SalePoint): SalePointOrmEntity {
    const entity = new SalePointOrmEntity();
    entity.id = salePoint.id;
    entity.name = salePoint.name;
    entity.code = salePoint.code;
    entity.ownerPartnerId = salePoint.ownerPartnerId;
    entity.partnerPaymentPercentage = salePoint.partnerPaymentPercentage;
    entity.isActive = salePoint.isActive;
    entity.createdAt = salePoint.createdAt;
    entity.updatedAt = salePoint.updatedAt;
    return entity;
  }
}
