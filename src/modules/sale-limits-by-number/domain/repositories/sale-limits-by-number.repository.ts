import type { SaleLimitByNumber } from '../entities/sale-limit-by-number.entity';

export const SALE_LIMITS_BY_NUMBER_REPOSITORY = Symbol(
  'SALE_LIMITS_BY_NUMBER_REPOSITORY',
);

export interface SaleLimitByNumberRow {
  gameId: string;
  label: string;
  amount: number;
}

export interface SaleLimitsByNumberRepository {
  save(entity: SaleLimitByNumber): Promise<void>;
  findById(id: string): Promise<SaleLimitByNumber | null>;
  findBySalePoint(salePointId: string): Promise<SaleLimitByNumber[]>;
  findByKey(
    salePointId: string,
    gameId: string,
    label: string,
  ): Promise<SaleLimitByNumber | null>;
  delete(id: string): Promise<void>;
  /**
   * Bulk fetch para la enforce logic al crear tickets: dado (sp, game),
   * devuelve un map `label -> amount` para todos los overrides existentes.
   * Vacío si no hay ninguno.
   */
  mapForGame(
    salePointId: string,
    gameId: string,
  ): Promise<Map<string, number>>;
}
