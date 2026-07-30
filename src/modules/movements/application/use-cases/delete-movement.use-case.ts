import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  MOVEMENTS_REPOSITORY,
  type MovementsRepository,
} from '../../domain/repositories/movements.repository';

export interface DeleteMovementInput {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class DeleteMovement
  implements UseCase<DeleteMovementInput, { deleted: true }>
{
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movements: MovementsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: DeleteMovementInput): Promise<{ deleted: true }> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no eliminan movimientos');
    }

    const movement = await this.movements.findById(input.id);
    if (!movement) throw new NotFoundError('Movement', input.id);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(movement.salePointId)) {
        throw new ForbiddenException(
          'No puedes eliminar un movimiento fuera de tus sucursales',
        );
      }
    }

    await this.movements.delete(input.id);
    return { deleted: true };
  }
}
