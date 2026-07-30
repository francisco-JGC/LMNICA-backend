import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { Movement } from '../../domain/entities/movement.entity';
import {
  MOVEMENTS_REPOSITORY,
  type MovementsRepository,
} from '../../domain/repositories/movements.repository';
import { MovementType } from '../../domain/value-objects/movement-type';
import { toMovementOutput, type MovementOutput } from '../dtos/movement.output';

export interface CreateMovementInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
  type: MovementType;
  amount: number;
  description?: string;
  /** Optional — defaults to now. */
  occurredAt?: Date;
}

@Injectable()
export class CreateMovement
  implements UseCase<CreateMovementInput, MovementOutput>
{
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movements: MovementsRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: CreateMovementInput): Promise<MovementOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no crean movimientos');
    }

    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

    // Partner: only their own sucursales.
    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    if (!Number.isInteger(input.amount) || input.amount < 0) {
      throw new ValidationError('amount debe ser un entero no negativo');
    }

    const movement = Movement.create({
      salePointId: input.salePointId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      occurredAt: input.occurredAt,
      createdById: input.requesterId,
    });
    await this.movements.save(movement);
    return toMovementOutput(movement);
  }
}
