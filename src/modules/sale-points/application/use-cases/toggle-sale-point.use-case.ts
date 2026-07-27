import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';
import { toSalePointOutput, type SalePointOutput } from '../dtos/sale-point.output';

export interface ToggleSalePointInput {
  id: string;
  active: boolean;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class ToggleSalePoint
  implements UseCase<ToggleSalePointInput, SalePointOutput>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
  ) {}

  async execute(input: ToggleSalePointInput): Promise<SalePointOutput> {
    const salePoint = await this.salePoints.findById(input.id);
    if (!salePoint) throw new NotFoundError('SalePoint', input.id);

    // A partner can only toggle their own sucursales; admins can toggle
    // anything.
    if (
      input.requesterRole === UserRole.PARTNER &&
      salePoint.ownerPartnerId !== input.requesterId
    ) {
      throw new ForbiddenException('You do not own this sucursal');
    }

    if (input.active) salePoint.activate();
    else salePoint.deactivate();

    await this.salePoints.save(salePoint);
    const assigned = await this.salePoints.getAssignedPartnerIds(salePoint.id);
    return toSalePointOutput(salePoint, assigned);
  }
}
