import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { SALE_POINTS_REPOSITORY } from './domain/repositories/sale-points.repository';
import { CreateSalePoint } from './application/use-cases/create-sale-point.use-case';
import { ListAllSalePoints } from './application/use-cases/list-all-sale-points.use-case';
import { ListSalePointsForUser } from './application/use-cases/list-sale-points-for-user.use-case';
import { PartnerScopeService } from './application/services/partner-scope.service';
import { SetAssignedPartners } from './application/use-cases/set-assigned-partners.use-case';
import { ToggleSalePoint } from './application/use-cases/toggle-sale-point.use-case';
import { UpdateSalePoint } from './application/use-cases/update-sale-point.use-case';
import { SalePointsController } from './infrastructure/http/controllers/sale-points.controller';
import { SalePointAssignedPartnerOrmEntity } from './infrastructure/persistence/entities/sale-point-assigned-partner.orm-entity';
import { SalePointOrmEntity } from './infrastructure/persistence/entities/sale-point.orm-entity';
import { TypeOrmSalePointsRepository } from './infrastructure/persistence/repositories/typeorm-sale-points.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalePointOrmEntity,
      SalePointAssignedPartnerOrmEntity,
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [SalePointsController],
  providers: [
    { provide: SALE_POINTS_REPOSITORY, useClass: TypeOrmSalePointsRepository },
    CreateSalePoint,
    ListAllSalePoints,
    ListSalePointsForUser,
    PartnerScopeService,
    SetAssignedPartners,
    ToggleSalePoint,
    UpdateSalePoint,
  ],
  exports: [
    SALE_POINTS_REPOSITORY,
    ListSalePointsForUser,
    PartnerScopeService,
  ],
})
export class SalePointsModule {}
