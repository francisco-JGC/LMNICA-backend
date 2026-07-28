/**
 * Feature flag simple: `key` como identificador semántico y `enabled` como
 * toggle. Los use cases que consulten la flag son los que interpretan qué
 * significa "prender" o "apagar" — la entidad en sí solo transporta el
 * boolean.
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: Date;
}
