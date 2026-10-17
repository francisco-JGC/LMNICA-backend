import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CrossGenerator } from './application/services/cross-generator.service';
import { EnsureTodayLucky } from './application/use-cases/ensure-today-lucky.use-case';
import { FindLuckyForDate } from './application/use-cases/find-lucky-for-date.use-case';
import { ListLuckyHistory } from './application/use-cases/list-lucky-history.use-case';
import { LUCKY_DAILIES_REPOSITORY } from './domain/repositories/lucky-dailies.repository';
import { LuckyCronService } from './infrastructure/cron/lucky-cron.service';
import { LuckyController } from './infrastructure/http/controllers/lucky.controller';
import { LuckyDailyOrmEntity } from './infrastructure/persistence/entities/lucky-daily.orm-entity';
import { TypeOrmLuckyDailiesRepository } from './infrastructure/persistence/repositories/typeorm-lucky-dailies.repository';

@Module({
  imports: [TypeOrmModule.forFeature([LuckyDailyOrmEntity])],
  controllers: [LuckyController],
  providers: [
    {
      provide: LUCKY_DAILIES_REPOSITORY,
      useClass: TypeOrmLuckyDailiesRepository,
    },
    CrossGenerator,
    EnsureTodayLucky,
    FindLuckyForDate,
    ListLuckyHistory,
    LuckyCronService,
  ],
})
export class LuckyModule {}
