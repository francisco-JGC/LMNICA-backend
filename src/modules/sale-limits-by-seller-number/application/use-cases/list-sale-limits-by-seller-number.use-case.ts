import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY,
  type SaleLimitsBySellerNumberRepository,
} from '../../domain/repositories/sale-limits-by-seller-number.repository';
import {
  toSaleLimitBySellerNumberOutput,
  type SaleLimitBySellerNumberOutput,
} from '../dtos/sale-limit-by-seller-number.output';

export interface ListSaleLimitsBySellerNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
}

@Injectable()
export class ListSaleLimitsBySellerNumber
  implements
    UseCase<
      ListSaleLimitsBySellerNumberInput,
      SaleLimitBySellerNumberOutput[]
    >
{
  constructor(
    @Inject(SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY)
    private readonly repo: SaleLimitsBySellerNumberRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: ListSaleLimitsBySellerNumberInput,
  ): Promise<SaleLimitBySellerNumberOutput[]> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no consultan cuotas');
    }
    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    const entities = await this.repo.findBySalePoint(input.salePointId);
    return entities.map(toSaleLimitBySellerNumberOutput);
  }
}
