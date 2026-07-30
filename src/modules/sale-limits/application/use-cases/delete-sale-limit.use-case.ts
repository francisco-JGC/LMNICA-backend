import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_REPOSITORY,
  type SaleLimitsRepository,
} from '../../domain/repositories/sale-limits.repository';

export interface DeleteSaleLimitInput {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
}

/**
 * Removing the limit row lifts the cap — the number becomes unlimited
 * again for that `(game, sucursal)` pair.
 */
@Injectable()
export class DeleteSaleLimit
  implements UseCase<DeleteSaleLimitInput, { deleted: true }>
{
  constructor(
    @Inject(SALE_LIMITS_REPOSITORY)
    private readonly limits: SaleLimitsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: DeleteSaleLimitInput): Promise<{ deleted: true }> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran límites');
    }

    const limit = await this.limits.findById(input.id);
    if (!limit) throw new NotFoundError('SaleLimit', input.id);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(limit.salePointId)) {
        throw new ForbiddenException(
          'No puedes eliminar un límite fuera de tus sucursales',
        );
      }
    }

    await this.limits.delete(input.id);
    return { deleted: true };
  }
}
