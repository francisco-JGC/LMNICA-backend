import { Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors/domain.error';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { SalePoint } from '../../domain/entities/sale-point.entity';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';
import { type CreateSalePointInput } from '../dtos/create-sale-point.input';
import { toSalePointOutput, type SalePointOutput } from '../dtos/sale-point.output';

@Injectable()
export class CreateSalePoint
  implements UseCase<CreateSalePointInput, SalePointOutput>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(input: CreateSalePointInput): Promise<SalePointOutput> {
    // Owning partner is optional: null means the sucursal is operated
    // directly by the main admin/owner and only admins can see it.
    if (input.ownerPartnerId) {
      const partner = await this.users.findById(input.ownerPartnerId);
      if (!partner) throw new NotFoundError('User', input.ownerPartnerId);
      if (partner.role !== UserRole.PARTNER) {
        throw new ValidationError(
          'Only users with role "partner" can own a sucursal',
        );
      }
    }

    const existing = await this.salePoints.findByCode(input.code);
    if (existing) throw new ValidationError('Code already taken');

    const salePoint = SalePoint.create({
      name: input.name,
      code: input.code,
      ownerPartnerId: input.ownerPartnerId ?? null,
      partnerPaymentPercentage: input.partnerPaymentPercentage ?? null,
    });
    await this.salePoints.save(salePoint);
    return toSalePointOutput(salePoint);
  }
}
