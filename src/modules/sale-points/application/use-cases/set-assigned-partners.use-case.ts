import { Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';
import {
  toSalePointOutput,
  type SalePointOutput,
} from '../dtos/sale-point.output';

export interface SetAssignedPartnersInput {
  salePointId: string;
  partnerIds: string[];
}

/**
 * Bulk-replace the "socios asignados" list of a sucursal. Assigned partners
 * get read-only visibility (dashboards, reports) — they can't administer the
 * sucursal, that stays with the encargado (ownerPartnerId) and admins.
 *
 * Admin-only endpoint (enforced at the controller layer).
 */
@Injectable()
export class SetAssignedPartners
  implements UseCase<SetAssignedPartnersInput, SalePointOutput>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(input: SetAssignedPartnersInput): Promise<SalePointOutput> {
    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) {
      throw new NotFoundError('SalePoint', input.salePointId);
    }

    // Dedup incoming IDs before validating so a caller sending the same id
    // twice doesn't cause spurious duplicate errors.
    const unique = Array.from(new Set(input.partnerIds));

    for (const partnerId of unique) {
      const user = await this.users.findById(partnerId);
      if (!user) throw new NotFoundError('User', partnerId);
      if (user.role !== UserRole.PARTNER) {
        throw new ValidationError(
          'Only users with role "partner" can be assigned to a sucursal',
        );
      }
    }

    await this.salePoints.setAssignedPartnerIds(salePoint.id, unique);
    return toSalePointOutput(salePoint, unique);
  }
}
