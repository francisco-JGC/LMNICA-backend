import { Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';
import {
  toSalePointOutput,
  type SalePointOutput,
} from '../dtos/sale-point.output';

/**
 * Returns the sale point the given user belongs to (via `users.sale_point_id`),
 * or an empty array if the user is not assigned to one. Kept as an array to
 * preserve the mobile's existing "pick from list" flow — the picker now shows
 * either 0 or 1 option instead of the legacy "all sale points I own".
 */
@Injectable()
export class ListSalePointsForUser
  implements UseCase<string, SalePointOutput[]>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(userId: string): Promise<SalePointOutput[]> {
    const user = await this.users.findById(userId);
    if (!user || !user.salePointId) return [];
    const salePoint = await this.salePoints.findById(user.salePointId);
    // Si la sucursal fue desactivada, no debe aparecer para el vendedor
    // (no puede seguir vendiendo desde una sucursal cerrada). El cliente
    // móvil interpreta lista vacía como "sin sucursal asignada".
    if (!salePoint || !salePoint.isActive) return [];
    return [toSalePointOutput(salePoint)];
  }
}
