import { Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { SalePoint } from '../../domain/entities/sale-point.entity';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';
import { toSalePointOutput, type SalePointOutput } from '../dtos/sale-point.output';

export interface ListAllSalePointsInput {
  requesterId: string;
  requesterRole: UserRole;
  /**
   * Solo tiene efecto para admin. Cuando es `true`, incluye sucursales
   * inactivas en la respuesta — se usa exclusivamente en la página de
   * administración de sucursales para permitir reactivarlas. Por defecto
   * (o para partners) las inactivas quedan siempre fuera.
   */
  includeInactive?: boolean;
}

/**
 * Admin → toda sucursal (activas por defecto; inactivas solo si
 *   `includeInactive=true`).
 * Partner → sucursales ACTIVAS que le pertenecen (encargado) o le están
 *   asignadas. Las inactivas nunca aparecen para partners aunque las
 *   hayan sido encargados antes.
 * (Sellers usan `/sale-points/mine`; este endpoint es solo web.)
 */
@Injectable()
export class ListAllSalePoints
  implements UseCase<ListAllSalePointsInput, SalePointOutput[]>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
  ) {}

  async execute(input: ListAllSalePointsInput): Promise<SalePointOutput[]> {
    const list = await this.resolveVisible(input);
    if (list.length === 0) return [];
    const assignedByPoint = await this.salePoints.getAssignedPartnerIdsByMany(
      list.map((sp) => sp.id),
    );
    return list.map((sp) =>
      toSalePointOutput(sp, assignedByPoint.get(sp.id) ?? []),
    );
  }

  private async resolveVisible(
    input: ListAllSalePointsInput,
  ): Promise<SalePoint[]> {
    const includeInactive =
      input.requesterRole === UserRole.ADMIN &&
      input.includeInactive === true;

    if (input.requesterRole !== UserRole.PARTNER) {
      return this.salePoints.findAll({ includeInactive });
    }
    // Partners: nunca ven inactivas — el repo ya filtra por defecto.
    const visibleIds =
      await this.salePoints.findVisibleSalePointIdsForPartner(
        input.requesterId,
      );
    if (visibleIds.length === 0) return [];
    const all = await this.salePoints.findAll();
    const idSet = new Set(visibleIds);
    return all.filter((sp) => idSet.has(sp.id));
  }
}
