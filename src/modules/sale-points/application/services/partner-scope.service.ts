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
 * - Devuelve **siempre** un array de IDs de sucursales activas.
 * - Admin → todas las sucursales activas.
 * - Partner → sucursales activas que le pertenecen (encargado) o le
 *   están asignadas (socios asignados).
 * - Seller → todas las sucursales activas (los use cases filtran por
 *   `sellerId` upstream — el scope acá es solo para excluir inactivas).
 *
 * Un array vacío significa "el requester no tiene alcance a ninguna
 * sucursal" y los use cases deben devolver resultado vacío.
 */
export type AccessibleSalePointScope = string[];

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
    if (role === UserRole.PARTNER) {
      // Visibility = encargado (owner_partner_id) ∪ assigned partners.
      // Assigned partners get read-only access to reports/dashboards for
      // sucursales they're not the encargado of. Solo se devuelven IDs
      // de sucursales activas.
      return this.salePoints.findVisibleSalePointIdsForPartner(requesterId);
    }
    // Admin y seller ven todas las activas. El seller además se filtra por
    // `sellerId` upstream en cada use case — este scope solo excluye
    // sucursales desactivadas para que no aparezcan en agregados/dropdowns.
    return this.salePoints.findAllActiveIds();
  }
}
