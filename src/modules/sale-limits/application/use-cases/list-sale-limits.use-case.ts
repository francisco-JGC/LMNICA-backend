import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_REPOSITORY,
  type SaleLimitsRepository,
} from '../../domain/repositories/sale-limits.repository';
import {
  toSaleLimitOutput,
  type SaleLimitOutput,
} from '../dtos/sale-limit.output';

export interface ListSaleLimitsInput {
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class ListSaleLimits
  implements UseCase<ListSaleLimitsInput, SaleLimitOutput[]>
{
  constructor(
    @Inject(SALE_LIMITS_REPOSITORY)
    private readonly limits: SaleLimitsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: ListSaleLimitsInput): Promise<SaleLimitOutput[]> {
    if (input.requesterRole === UserRole.SELLER) return [];

    const accessible = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (accessible.length === 0) return [];
    const rows = await this.limits.findMany({
      salePointIds: accessible,
    });
    return rows.map(toSaleLimitOutput);
  }
}
