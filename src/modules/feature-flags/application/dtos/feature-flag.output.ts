import type { FeatureFlag } from '../../domain/entities/feature-flag.entity';

export interface FeatureFlagOutput {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: Date;
}

export const toFeatureFlagOutput = (flag: FeatureFlag): FeatureFlagOutput => ({
  key: flag.key,
  enabled: flag.enabled,
  description: flag.description,
  updatedAt: flag.updatedAt,
});
