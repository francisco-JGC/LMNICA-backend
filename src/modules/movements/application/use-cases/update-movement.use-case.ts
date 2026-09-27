import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  MOVEMENTS_REPOSITORY,
  type MovementsRepository,
} from '../../domain/repositories/movements.repository';
import { MovementType } from '../../domain/value-objects/movement-type';
import { toMovementOutput, type MovementOutput } from '../dtos/movement.output';

export interface UpdateMovementInput {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
  type?: MovementType;
  amount?: number;
  description?: string;
  occurredAt?: Date;
  isPrizePayment?: boolean;
}

@Injectable()
export class UpdateMovement
  implements UseCase<UpdateMovementInput, MovementOutput>
{
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movements: MovementsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: UpdateMovementInput): Promise<MovementOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no pueden editar movimientos');
    }

    const movement = await this.movements.findById(input.id);
    if (!movement) throw new NotFoundError('Movement', input.id);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      const spId = movement.salePointId;
      if (spId !== null && !owned.includes(spId)) {
        throw new ForbiddenException(
          'No puedes editar un movimiento fuera de tus sucursales',
        );
      }
    }

    movement.update({
      type: input.type,
      amount: input.amount,
      description: input.description,
      occurredAt: input.occurredAt,
      isPrizePayment: input.isPrizePayment,
    });

    await this.movements.save(movement);
    return toMovementOutput(movement);
  }
}
