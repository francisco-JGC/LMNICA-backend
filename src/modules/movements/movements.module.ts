import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GamesModule } from '../games/games.module';
import { SalePointsModule } from '../sale-points/sale-points.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { CreateMovement } from './application/use-cases/create-movement.use-case';
import { DeleteMovement } from './application/use-cases/delete-movement.use-case';
import { GetBranchFlow } from './application/use-cases/get-branch-flow.use-case';
import { GetMovementsBalance } from './application/use-cases/get-movements-balance.use-case';
import { ListMovements } from './application/use-cases/list-movements.use-case';
import { MOVEMENTS_REPOSITORY } from './domain/repositories/movements.repository';
import { MovementsController } from './infrastructure/http/controllers/movements.controller';
import { MovementOrmEntity } from './infrastructure/persistence/entities/movement.orm-entity';
import { TypeOrmMovementsRepository } from './infrastructure/persistence/repositories/typeorm-movements.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovementOrmEntity]),
    SalePointsModule,
    UsersModule,
    GamesModule,
    TicketsModule,
  ],
  controllers: [MovementsController],
  providers: [
    { provide: MOVEMENTS_REPOSITORY, useClass: TypeOrmMovementsRepository },
    CreateMovement,
    ListMovements,
    DeleteMovement,
    GetMovementsBalance,
    GetBranchFlow,
  ],
  exports: [MOVEMENTS_REPOSITORY],
})
export class MovementsModule {}
