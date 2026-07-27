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
}

/**
 * Admin → every sucursal.
 * Partner → sucursales they own (encargado) plus those where they are in the
 *   assigned-partners list (read-only visibility).
 * (Sellers use `/sale-points/mine`, this endpoint is web-only.)
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
    if (input.requesterRole !== UserRole.PARTNER) {
      return this.salePoints.findAll();
    }
    const visibleIds = await this.salePoints.findVisibleSalePointIdsForPartner(
      input.requesterId,
    );
    if (visibleIds.length === 0) return [];
    // Preserve newest-first order via findAll then in-memory filter — the
    // sucursal count is small (dozens, not thousands) so this is fine and
    // keeps the ordering consistent with the admin view.
    const all = await this.salePoints.findAll();
    const idSet = new Set(visibleIds);
    return all.filter((sp) => idSet.has(sp.id));
  }
}
