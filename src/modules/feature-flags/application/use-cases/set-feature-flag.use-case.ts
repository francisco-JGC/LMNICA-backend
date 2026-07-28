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

export interface SetFeatureFlagInput {
  key: string;
  enabled: boolean;
}

@Injectable()
export class SetFeatureFlag
  implements UseCase<SetFeatureFlagInput, FeatureFlagOutput>
{
  constructor(
    @Inject(FEATURE_FLAGS_REPOSITORY)
    private readonly flags: FeatureFlagsRepository,
  ) {}

  async execute(input: SetFeatureFlagInput): Promise<FeatureFlagOutput> {
    const updated = await this.flags.setEnabled(input.key, input.enabled);
    return toFeatureFlagOutput(updated);
  }
}
