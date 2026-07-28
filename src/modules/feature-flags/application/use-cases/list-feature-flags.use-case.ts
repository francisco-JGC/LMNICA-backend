import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  FEATURE_FLAGS_REPOSITORY,
  type FeatureFlagsRepository,
} from '../../domain/repositories/feature-flags.repository';
import {
  toFeatureFlagOutput,
  type FeatureFlagOutput,
} from '../dtos/feature-flag.output';

@Injectable()
export class ListFeatureFlags implements UseCase<void, FeatureFlagOutput[]> {
  constructor(
    @Inject(FEATURE_FLAGS_REPOSITORY)
    private readonly flags: FeatureFlagsRepository,
  ) {}

  async execute(): Promise<FeatureFlagOutput[]> {
    const list = await this.flags.findAll();
    return list.map(toFeatureFlagOutput);
  }
}
