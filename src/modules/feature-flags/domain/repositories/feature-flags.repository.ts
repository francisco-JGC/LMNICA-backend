import type { FeatureFlag } from '../entities/feature-flag.entity';

export const FEATURE_FLAGS_REPOSITORY = Symbol('FEATURE_FLAGS_REPOSITORY');

export interface FeatureFlagsRepository {
  findAll(): Promise<FeatureFlag[]>;
  findByKey(key: string): Promise<FeatureFlag | null>;
  setEnabled(key: string, enabled: boolean): Promise<FeatureFlag>;
  /**
   * Atajo booleano usado por use cases que solo necesitan saber si algo
   * está habilitado. Devuelve `false` si la key no existe — un flag que
   * nadie creó nunca se comporta como apagado.
   */
  isEnabled(key: string): Promise<boolean>;
}
