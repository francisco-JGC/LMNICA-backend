import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GamesModule } from '../games/games.module';
import { SaleLimitsByNumberModule } from '../sale-limits-by-number/sale-limits-by-number.module';
import { SalePointsModule } from '../sale-points/sale-points.module';
import { UsersModule } from '../users/users.module';
import { DeleteSaleLimitBySellerNumber } from './application/use-cases/delete-sale-limit-by-seller-number.use-case';
import { ListSaleLimitsBySellerNumber } from './application/use-cases/list-sale-limits-by-seller-number.use-case';
import { UpsertSaleLimitBySellerNumber } from './application/use-cases/upsert-sale-limit-by-seller-number.use-case';
import { SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY } from './domain/repositories/sale-limits-by-seller-number.repository';
import { SaleLimitsBySellerNumberController } from './infrastructure/http/controllers/sale-limits-by-seller-number.controller';
import { SaleLimitBySellerNumberOrmEntity } from './infrastructure/persistence/entities/sale-limit-by-seller-number.orm-entity';
import { TypeOrmSaleLimitsBySellerNumberRepository } from './infrastructure/persistence/repositories/typeorm-sale-limits-by-seller-number.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleLimitBySellerNumberOrmEntity]),
    GamesModule,
    SalePointsModule,
    UsersModule,
    SaleLimitsByNumberModule,
  ],
  controllers: [SaleLimitsBySellerNumberController],
  providers: [
    {
      provide: SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY,
      useClass: TypeOrmSaleLimitsBySellerNumberRepository,
    },
    ListSaleLimitsBySellerNumber,
    UpsertSaleLimitBySellerNumber,
    DeleteSaleLimitBySellerNumber,
  ],
  exports: [SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY],
})
export class SaleLimitsBySellerNumberModule {}
