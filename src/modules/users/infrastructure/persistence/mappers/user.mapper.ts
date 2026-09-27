import { User } from '../../../domain/entities/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';

export class UserMapper {
  static toDomain(orm: UserOrmEntity): User {
    return User.restore(orm.id, {
      username: orm.username,
      hashedPassword: orm.hashedPassword,
      name: orm.name,
      role: orm.role,
      isActive: orm.isActive,
      phone: orm.phone ?? null,
      address: orm.address ?? null,
      nationalId: orm.nationalId ?? null,
      paymentPercentage: orm.paymentPercentage ?? null,
      salePointId: orm.salePointId ?? null,
      mobileSalesEnabled: orm.mobileSalesEnabled ?? false,
      defaultSalePointId: orm.defaultSalePointId ?? null,
      createdById: orm.createdById ?? null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(user: User): UserOrmEntity {
    const entity = new UserOrmEntity();
    entity.id = user.id;
    entity.username = user.username;
    entity.hashedPassword = user.hashedPassword;
    entity.name = user.name;
    entity.role = user.role;
    entity.isActive = user.isActive;
    entity.phone = user.phone;
    entity.address = user.address;
    entity.nationalId = user.nationalId;
    entity.paymentPercentage = user.paymentPercentage;
    entity.salePointId = user.salePointId;
    entity.mobileSalesEnabled = user.mobileSalesEnabled;
    entity.defaultSalePointId = user.defaultSalePointId;
    entity.createdById = user.createdById;
    entity.createdAt = user.createdAt;
    entity.updatedAt = user.updatedAt;
    return entity;
  }
}
