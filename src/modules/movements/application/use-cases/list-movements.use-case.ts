import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  MOVEMENTS_REPOSITORY,
  type MovementsRepository,
} from '../../domain/repositories/movements.repository';
import { MovementType } from '../../domain/value-objects/movement-type';
import { toMovementOutput, type MovementOutput } from '../dtos/movement.output';

export interface ListMovementsInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  type?: MovementType;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface ListMovementsOutput {
  items: MovementOutput[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class ListMovements
  implements UseCase<ListMovementsInput, ListMovementsOutput>
{
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movements: MovementsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: ListMovementsInput): Promise<ListMovementsOutput> {
    // Sellers see only their own movements (by sellerId).
    if (input.requesterRole === UserRole.SELLER) {
      const filters = {
        sellerId: input.requesterId,
        type: input.type,
        from: input.from,
        to: input.to,
        limit: input.limit,
        offset: (input.page - 1) * input.limit,
      };
      const [items, total] = await Promise.all([
        this.movements.findMany(filters),
        this.movements.countMany(filters),
      ]);
      return { items: items.map(toMovementOutput), page: input.page, limit: input.limit, total };
    }

    const accessible = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (accessible.length === 0) {
      return { items: [], page: input.page, limit: input.limit, total: 0 };
    }

    // Enforce scope: if salePointId is outside the accessible list, return empty.
    // This prevents a partner from bypassing scope by sending an arbitrary ID.
    if (input.salePointId && !accessible.includes(input.salePointId)) {
      return { items: [], page: input.page, limit: input.limit, total: 0 };
    }

    const filters = {
      salePointId: input.salePointId,
      salePointIds: accessible,
      type: input.type,
      from: input.from,
      to: input.to,
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    };

    const [items, total] = await Promise.all([
      this.movements.findMany(filters),
      this.movements.countMany(filters),
    ]);

    return {
      items: items.map(toMovementOutput),
      page: input.page,
      limit: input.limit,
      total,
    };
  }
}
