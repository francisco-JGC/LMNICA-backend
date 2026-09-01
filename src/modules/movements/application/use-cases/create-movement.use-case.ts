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
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
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
  /** Required for sucursal movements. Omit when sellerId is provided. */
  salePointId?: string;
  /** When set, creates a seller-level movement (cobro, ajuste, prize payment). */
  sellerId?: string | null;
  isPrizePayment?: boolean;
  type: MovementType;
  amount: number;
  description?: string;
  /** Optional — defaults to now. */
  occurredAt?: Date;
  clientRequestId?: string | null;
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
    @Inject(USERS_REPOSITORY)
    private readonly users: UsersRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: CreateMovementInput): Promise<MovementOutput> {
    if (input.clientRequestId) {
      const existing = await this.movements.findByClientRequestId(
        input.clientRequestId,
      );
      if (existing) return toMovementOutput(existing);
    }

    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no crean movimientos');
    }

    if (!Number.isInteger(input.amount) || input.amount < 0) {
      throw new ValidationError('amount debe ser un entero no negativo');
    }

    let effectiveSalePointId: string | null = null;

    if (input.sellerId) {
      // Seller movement: resolve scope via the seller's sucursal.
      const seller = await this.users.findById(input.sellerId);
      if (!seller) throw new NotFoundError('User', input.sellerId);

      if (input.requesterRole === UserRole.PARTNER) {
        if (!seller.salePointId) {
          throw new ForbiddenException('Ese vendedor no pertenece a ninguna sucursal tuya');
        }
        const owned = await this.scope.getAccessibleSalePointIds(
          input.requesterId,
          input.requesterRole,
        );
        if (!owned.includes(seller.salePointId)) {
          throw new ForbiddenException('Ese vendedor no te pertenece');
        }
      }
      // Seller movements don't have a sale_point_id — they live at seller level.
      effectiveSalePointId = null;
    } else {
      // Sucursal movement — salePointId required.
      if (!input.salePointId) {
        throw new ValidationError('salePointId es requerido cuando no se especifica sellerId');
      }
      const salePoint = await this.salePoints.findById(input.salePointId);
      if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

      if (input.requesterRole === UserRole.PARTNER) {
        const owned = await this.scope.getAccessibleSalePointIds(
          input.requesterId,
          input.requesterRole,
        );
        if (!owned.includes(input.salePointId)) {
          throw new ForbiddenException('Esa sucursal no te pertenece');
        }
      }
      effectiveSalePointId = input.salePointId;
    }

    const movement = Movement.create({
      salePointId: effectiveSalePointId,
      sellerId: input.sellerId ?? null,
      isPrizePayment: input.isPrizePayment ?? false,
      type: input.type,
      amount: input.amount,
      description: input.description,
      occurredAt: input.occurredAt,
      createdById: input.requesterId,
      clientRequestId: input.clientRequestId ?? null,
    });

    try {
      await this.movements.save(movement);
    } catch (err) {
      // Race: dos requests con el mismo `clientRequestId` entraron en
      // paralelo (ambos pasaron el lookup inicial), el segundo choca
      // con el UNIQUE parcial. Devolvemos el movement ganador (el
      // primero) para que el cliente reciba una respuesta útil en vez
      // de un 500.
      if (input.clientRequestId && this.isDuplicateRequestIdError(err)) {
        const existing = await this.movements.findByClientRequestId(
          input.clientRequestId,
        );
        if (existing) return toMovementOutput(existing);
      }
      throw err;
    }

    return toMovementOutput(movement);
  }

  /** Reconoce la violación del UNIQUE parcial sobre `client_request_id`. */
  private isDuplicateRequestIdError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const anyErr = err as {
      code?: string;
      constraint?: string;
      message?: string;
    };
    // Postgres 23505 = unique_violation.
    if (anyErr.code !== '23505') return false;
    return (
      anyErr.constraint === 'IDX_movements_client_request_id' ||
      (anyErr.message ?? '').includes('client_request_id')
    );
  }
}
