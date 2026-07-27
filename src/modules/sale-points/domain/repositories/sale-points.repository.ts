import { SalePoint } from '../entities/sale-point.entity';

export const SALE_POINTS_REPOSITORY = Symbol('SALE_POINTS_REPOSITORY');

export interface SalePointsRepository {
  save(salePoint: SalePoint): Promise<void>;
  findById(id: string): Promise<SalePoint | null>;
  findByCode(code: string): Promise<SalePoint | null>;
  findAll(): Promise<SalePoint[]>;
  /** Sucursales owned by a specific partner (via `owner_partner_id`). */
  findByPartner(partnerId: string): Promise<SalePoint[]>;
  /**
   * All sucursal IDs visible to a partner: the ones they own (encargado) plus
   * the ones where they are in the assigned-partners list. Returns just IDs
   * because that's what PartnerScopeService needs; call sites that also need
   * the full entities can combine this with findById as needed.
   */
  findVisibleSalePointIdsForPartner(partnerId: string): Promise<string[]>;
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
