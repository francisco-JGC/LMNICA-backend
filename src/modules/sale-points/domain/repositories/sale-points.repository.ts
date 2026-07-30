import { SalePoint } from '../entities/sale-point.entity';

export const SALE_POINTS_REPOSITORY = Symbol('SALE_POINTS_REPOSITORY');

export interface SalePointsRepository {
  save(salePoint: SalePoint): Promise<void>;
  findById(id: string): Promise<SalePoint | null>;
  findByCode(code: string): Promise<SalePoint | null>;
  /**
   * Devuelve solo sucursales ACTIVAS por defecto — las inactivas se
   * consideran soft-deleted a nivel producto (no aparecen en dropdowns,
   * agregados, ni reportes). Pasar `includeInactive: true` únicamente
   * desde la página de administración de sucursales (para permitir
   * reactivarlas).
   */
  findAll(options?: { includeInactive?: boolean }): Promise<SalePoint[]>;
  /**
   * Sucursales owned by a specific partner (via `owner_partner_id`).
   * Por defecto solo devuelve activas (ver `findAll`).
   */
  findByPartner(
    partnerId: string,
    options?: { includeInactive?: boolean },
  ): Promise<SalePoint[]>;
  /**
   * All sucursal IDs visible to a partner: the ones they own (encargado) plus
   * the ones where they are in the assigned-partners list. Returns just IDs
   * because that's what PartnerScopeService needs; call sites that also need
   * the full entities can combine this with findById as needed. Por defecto
   * solo devuelve IDs de sucursales activas.
   */
  findVisibleSalePointIdsForPartner(
    partnerId: string,
    options?: { includeInactive?: boolean },
  ): Promise<string[]>;
  /**
   * IDs de TODAS las sucursales activas. Usado por PartnerScopeService
   * cuando el requester es admin para pasarle al SQL un array explícito
   * en vez de "sin filtro" — de esa forma los agregados no incluyen
   * datos de sucursales inactivas.
   */
  findAllActiveIds(): Promise<string[]>;
  /** Assigned-partner user IDs for a single sucursal. */
  getAssignedPartnerIds(salePointId: string): Promise<string[]>;
  /**
   * Bulk fetch of assigned-partner IDs for multiple sucursales, returned as a
   * map keyed by `sale_point_id`. Sucursales with no assignees are absent
   * from the map (caller should default to an empty array).
   */
  getAssignedPartnerIdsByMany(
    salePointIds: string[],
  ): Promise<Map<string, string[]>>;
  /**
   * Full-replace semantics: after this call the sucursal's assigned partners
   * are exactly `partnerIds`. Passing an empty array clears the list.
   */
  setAssignedPartnerIds(
    salePointId: string,
    partnerIds: string[],
  ): Promise<void>;
}
