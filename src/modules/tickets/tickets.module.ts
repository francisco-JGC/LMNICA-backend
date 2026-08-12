import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { GamesModule } from '../games/games.module';
import { SaleLimitsModule } from '../sale-limits/sale-limits.module';
import { SaleLimitsByNumberModule } from '../sale-limits-by-number/sale-limits-by-number.module';
import { SalePointsModule } from '../sale-points/sale-points.module';
import { UsersModule } from '../users/users.module';
import { FOLIO_GENERATOR } from './application/ports/folio-generator.port';
import { TicketEvaluator } from './application/services/ticket-evaluator.service';
import { CreateTicket } from './application/use-cases/create-ticket.use-case';
import { EvaluateTicketById } from './application/use-cases/evaluate-ticket-by-id.use-case';
import { FindTicketByFolio } from './application/use-cases/find-ticket-by-folio.use-case';
import { FindTicketById } from './application/use-cases/find-ticket-by-id.use-case';
import { FindTicketByIdForScan } from './application/use-cases/find-ticket-by-id-for-scan.use-case';
import { GetBillingByGame } from './application/use-cases/get-billing-by-game.use-case';
import { GetBranchTotals } from './application/use-cases/get-branch-totals.use-case';
import { GetSalesByNumber } from './application/use-cases/get-sales-by-number.use-case';
import { GetSellerReport } from './application/use-cases/get-seller-report.use-case';
import { GetTicketsByDraw } from './application/use-cases/get-tickets-by-draw.use-case';
import { GetTicketsSummary } from './application/use-cases/get-tickets-summary.use-case';
import { ListTickets } from './application/use-cases/list-tickets.use-case';
import { ListWinningTickets } from './application/use-cases/list-winning-tickets.use-case';
import { VoidTicket } from './application/use-cases/void-ticket.use-case';
import { TICKETS_REPOSITORY } from './domain/repositories/tickets.repository';
import { TicketsController } from './infrastructure/http/controllers/tickets.controller';
import { TicketLineOrmEntity } from './infrastructure/persistence/entities/ticket-line.orm-entity';
import { TicketOrmEntity } from './infrastructure/persistence/entities/ticket.orm-entity';
import { TypeOrmTicketsRepository } from './infrastructure/persistence/repositories/typeorm-tickets.repository';
import { TimestampFolioGenerator } from './infrastructure/services/timestamp-folio-generator';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketOrmEntity, TicketLineOrmEntity]),
    GamesModule,
    SalePointsModule,
    SaleLimitsModule,
    SaleLimitsByNumberModule,
    UsersModule,
    FeatureFlagsModule,
  ],
  controllers: [TicketsController],
  providers: [
    { provide: TICKETS_REPOSITORY, useClass: TypeOrmTicketsRepository },
    { provide: FOLIO_GENERATOR, useClass: TimestampFolioGenerator },
    CreateTicket,
    ListTickets,
    GetTicketsSummary,
    GetTicketsByDraw,
    GetSellerReport,
    GetBranchTotals,
    GetBillingByGame,
    GetSalesByNumber,
    FindTicketById,
    FindTicketByIdForScan,
    FindTicketByFolio,
    VoidTicket,
    TicketEvaluator,
    ListWinningTickets,
    EvaluateTicketById,
  ],
  exports: [ListWinningTickets, TICKETS_REPOSITORY, TicketEvaluator],
})
export class TicketsModule {}
