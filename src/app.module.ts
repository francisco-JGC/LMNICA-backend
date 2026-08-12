import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { GamePrizesModule } from './modules/game-prizes/game-prizes.module';
import { GamesModule } from './modules/games/games.module';
import { LuckyModule } from './modules/lucky/lucky.module';
import { MovementsModule } from './modules/movements/movements.module';
import { SaleLimitsModule } from './modules/sale-limits/sale-limits.module';
import { SaleLimitsByNumberModule } from './modules/sale-limits-by-number/sale-limits-by-number.module';
import { SaleLimitsBySellerNumberModule } from './modules/sale-limits-by-seller-number/sale-limits-by-seller-number.module';
import { SalePointsModule } from './modules/sale-points/sale-points.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UsersModule } from './modules/users/users.module';
import { envLoader, envSchema } from './shared/infrastructure/config/env.config';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter';
import { HealthController } from './shared/infrastructure/http/health.controller';
import { DatabaseModule } from './shared/infrastructure/persistence/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [envLoader],
      validationSchema: envSchema,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    AuthModule,
    SalePointsModule,
    GamesModule,
    TicketsModule,
    LuckyModule,
    DashboardModule,
    MovementsModule,
    SaleLimitsModule,
    SaleLimitsByNumberModule,
    SaleLimitsBySellerNumberModule,
    GamePrizesModule,
    FeatureFlagsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
