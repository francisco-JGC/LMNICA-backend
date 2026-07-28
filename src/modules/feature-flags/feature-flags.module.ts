import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ListFeatureFlags } from './application/use-cases/list-feature-flags.use-case';
import { SetFeatureFlag } from './application/use-cases/set-feature-flag.use-case';
import { FEATURE_FLAGS_REPOSITORY } from './domain/repositories/feature-flags.repository';
import { FeatureFlagsController } from './infrastructure/http/controllers/feature-flags.controller';
import { FeatureFlagOrmEntity } from './infrastructure/persistence/entities/feature-flag.orm-entity';
import { TypeOrmFeatureFlagsRepository } from './infrastructure/persistence/repositories/typeorm-feature-flags.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlagOrmEntity])],
  controllers: [FeatureFlagsController],
  providers: [
    {
      provide: FEATURE_FLAGS_REPOSITORY,
      useClass: TypeOrmFeatureFlagsRepository,
    },
    ListFeatureFlags,
    SetFeatureFlag,
  ],
  exports: [FEATURE_FLAGS_REPOSITORY],
})
export class FeatureFlagsModule {}
