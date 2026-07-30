import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_BY_NUMBER_REPOSITORY,
  type SaleLimitsByNumberRepository,
} from '../../domain/repositories/sale-limits-by-number.repository';

export interface DeleteSaleLimitByNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  id: string;
}

@Injectable()
export class DeleteSaleLimitByNumber
  implements UseCase<DeleteSaleLimitByNumberInput, { deleted: true }>
{
  constructor(
    @Inject(SALE_LIMITS_BY_NUMBER_REPOSITORY)
    private readonly limits: SaleLimitsByNumberRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: DeleteSaleLimitByNumberInput,
  ): Promise<{ deleted: true }> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran límites');
    }

    const existing = await this.limits.findById(input.id);
    if (!existing) throw new NotFoundError('SaleLimitByNumber', input.id);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(existing.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    await this.limits.delete(input.id);
    return { deleted: true };
  }
}
