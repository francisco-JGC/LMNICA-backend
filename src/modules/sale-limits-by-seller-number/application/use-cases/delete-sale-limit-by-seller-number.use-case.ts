import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY,
  type SaleLimitsBySellerNumberRepository,
} from '../../domain/repositories/sale-limits-by-seller-number.repository';

export interface DeleteSaleLimitBySellerNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  id: string;
}

@Injectable()
export class DeleteSaleLimitBySellerNumber
  implements
    UseCase<DeleteSaleLimitBySellerNumberInput, { deleted: true }>
{
  constructor(
    @Inject(SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY)
    private readonly repo: SaleLimitsBySellerNumberRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: DeleteSaleLimitBySellerNumberInput,
  ): Promise<{ deleted: true }> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran cuotas');
    }

    const existing = await this.repo.findById(input.id);
    if (!existing) throw new NotFoundError('SaleLimitBySellerNumber', input.id);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(existing.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    await this.repo.delete(input.id);
    return { deleted: true };
  }
}
