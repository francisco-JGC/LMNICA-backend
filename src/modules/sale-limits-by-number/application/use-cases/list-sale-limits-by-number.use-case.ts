import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_BY_NUMBER_REPOSITORY,
  type SaleLimitsByNumberRepository,
} from '../../domain/repositories/sale-limits-by-number.repository';
import {
  toSaleLimitByNumberOutput,
  type SaleLimitByNumberOutput,
} from '../dtos/sale-limit-by-number.output';

export interface ListSaleLimitsByNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
}

@Injectable()
export class ListSaleLimitsByNumber
  implements
    UseCase<ListSaleLimitsByNumberInput, SaleLimitByNumberOutput[]>
{
  constructor(
    @Inject(SALE_LIMITS_BY_NUMBER_REPOSITORY)
    private readonly limits: SaleLimitsByNumberRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: ListSaleLimitsByNumberInput,
  ): Promise<SaleLimitByNumberOutput[]> {
    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }
    const list = await this.limits.findBySalePoint(input.salePointId);
    return list.map(toSaleLimitByNumberOutput);
  }
}
