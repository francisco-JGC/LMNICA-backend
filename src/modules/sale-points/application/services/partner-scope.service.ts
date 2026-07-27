import { Inject, Injectable } from '@nestjs/common';

import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';

/**
 * Which sucursales a requester is allowed to see. Every list/report use
 * case that returns rows scoped to a sucursal must consult this service
 * so the partner-vs-admin isolation stays in one place.
 *
 * Contract:
 * - `null` → **no restriction** (admin sees everything, including sucursales
 *   with `owner_partner_id IS NULL`).
 * - `string[]` → restrict to exactly this set of `sale_points.id` values.
 *   An empty array is meaningful: the partner owns nothing and their
 *   result set must be empty (do NOT convert `[]` → "no filter").
 */
export type AccessibleSalePointScope = string[] | null;

@Injectable()
export class PartnerScopeService {
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
  ) {}

  async getAccessibleSalePointIds(
    requesterId: string,
    role: UserRole,
  ): Promise<AccessibleSalePointScope> {
    if (role === UserRole.ADMIN) return null;
    if (role === UserRole.PARTNER) {
      // Visibility = encargado (owner_partner_id) ∪ assigned partners.
      // Assigned partners get read-only access to reports/dashboards for
      // sucursales they're not the encargado of.
      return this.salePoints.findVisibleSalePointIdsForPartner(requesterId);
    }
    // Sellers are scoped upstream by their own sellerId — no additional
    // sale-point restriction needed here. Endpoints that shouldn't be
    // reachable by sellers must gate with @Roles, not with this service.
    return null;
  }
}
