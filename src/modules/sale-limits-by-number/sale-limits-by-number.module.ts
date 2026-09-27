import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GamesModule } from '../games/games.module';
import { SalePointsModule } from '../sale-points/sale-points.module';
import { UsersModule } from '../users/users.module';
import { DeleteSaleLimitByNumber } from './application/use-cases/delete-sale-limit-by-number.use-case';
import { GetMinAmountsByNumber } from './application/use-cases/get-min-amounts-by-number.use-case';
import { ListSaleLimitsByNumber } from './application/use-cases/list-sale-limits-by-number.use-case';
import { UpsertSaleLimitByNumber } from './application/use-cases/upsert-sale-limit-by-number.use-case';
import { SALE_LIMITS_BY_NUMBER_REPOSITORY } from './domain/repositories/sale-limits-by-number.repository';
import { SaleLimitsByNumberController } from './infrastructure/http/controllers/sale-limits-by-number.controller';
import { SaleLimitByNumberOrmEntity } from './infrastructure/persistence/entities/sale-limit-by-number.orm-entity';
import { TypeOrmSaleLimitsByNumberRepository } from './infrastructure/persistence/repositories/typeorm-sale-limits-by-number.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleLimitByNumberOrmEntity]),
    GamesModule,
    SalePointsModule,
    UsersModule,
  ],
  controllers: [SaleLimitsByNumberController],
  providers: [
    {
      provide: SALE_LIMITS_BY_NUMBER_REPOSITORY,
      useClass: TypeOrmSaleLimitsByNumberRepository,
    },
    ListSaleLimitsByNumber,
    UpsertSaleLimitByNumber,
    DeleteSaleLimitByNumber,
    GetMinAmountsByNumber,
  ],
  exports: [SALE_LIMITS_BY_NUMBER_REPOSITORY],
})
export class SaleLimitsByNumberModule {}
