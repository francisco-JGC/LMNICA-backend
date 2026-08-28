import { Movement } from '../entities/movement.entity';
import { MovementType } from '../value-objects/movement-type';

export const MOVEMENTS_REPOSITORY = Symbol('MOVEMENTS_REPOSITORY');

export interface FindMovementsFilters {
  salePointId?: string;
  /** Restrict to movements in these sucursales (partner scoping). Empty = no rows. */
  salePointIds?: string[];
  type?: MovementType;
  /** Filter by `occurred_at` inclusive. */
  from?: Date;
  /** Filter by `occurred_at` inclusive (upper bound). */
  to?: Date;
  limit: number;
  offset: number;
}

export interface MovementsRepository {
  save(movement: Movement): Promise<void>;
  findById(id: string): Promise<Movement | null>;
  /**
   * Lookup por el UUID de idempotencia. `CreateMovement` lo usa antes de
   * insertar para dedupear reintentos (retry por timeout, doble-click en
   * "Guardar", refresh del token). Ver `movement.orm-entity.ts`.
   */
  findByClientRequestId(clientRequestId: string): Promise<Movement | null>;
  findMany(filters: FindMovementsFilters): Promise<Movement[]>;
  countMany(filters: FindMovementsFilters): Promise<number>;
  delete(id: string): Promise<void>;
}
