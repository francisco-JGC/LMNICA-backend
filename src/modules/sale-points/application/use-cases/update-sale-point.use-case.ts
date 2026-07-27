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
import { type UpdateSalePointInput } from '../dtos/update-sale-point.input';
import {
  toSalePointOutput,
  type SalePointOutput,
} from '../dtos/sale-point.output';

@Injectable()
export class UpdateSalePoint
  implements UseCase<UpdateSalePointInput, SalePointOutput>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(input: UpdateSalePointInput): Promise<SalePointOutput> {
    const salePoint = await this.salePoints.findById(input.id);
    if (!salePoint) throw new NotFoundError('SalePoint', input.id);

    if (input.code !== undefined && input.code !== salePoint.code) {
      const collision = await this.salePoints.findByCode(input.code);
      if (collision && collision.id !== salePoint.id) {
        throw new ValidationError('Code already taken');
      }
    }

    if (input.ownerPartnerId) {
      const partner = await this.users.findById(input.ownerPartnerId);
      if (!partner) throw new NotFoundError('User', input.ownerPartnerId);
      if (partner.role !== UserRole.PARTNER) {
        throw new ValidationError(
          'Only users with role "partner" can own a sucursal',
        );
      }
    }

    salePoint.update({
      name: input.name,
      code: input.code,
      ownerPartnerId: input.ownerPartnerId,
    });
    await this.salePoints.save(salePoint);
    const assigned = await this.salePoints.getAssignedPartnerIds(salePoint.id);
    return toSalePointOutput(salePoint, assigned);
  }
}
