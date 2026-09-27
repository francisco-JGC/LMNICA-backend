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
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../domain/repositories/users.repository';
import { UserRole } from '../../domain/value-objects/user-role';
import { toUserOutput, type UserOutput } from '../dtos/user.output';

export interface UpdateMobileSalesProfileInput {
  requesterId: string;
  requesterRole: UserRole;
  mobileSalesEnabled: boolean;
  defaultSalePointId: string | null;
}

@Injectable()
export class UpdateMobileSalesProfile
  implements UseCase<UpdateMobileSalesProfileInput, UserOutput>
{
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
  ) {}

  async execute(input: UpdateMobileSalesProfileInput): Promise<UserOutput> {
    if (input.requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solo los administradores pueden configurar el modo vendedor',
      );
    }

    const user = await this.users.findById(input.requesterId);
    if (!user) throw new NotFoundError('User', input.requesterId);

    if (input.mobileSalesEnabled) {
      if (!input.defaultSalePointId) {
        throw new ValidationError(
          'Debes elegir una sucursal para activar el modo vendedor',
        );
      }
      const salePoint = await this.salePoints.findById(
        input.defaultSalePointId,
      );
      if (!salePoint) {
        throw new NotFoundError('SalePoint', input.defaultSalePointId);
      }
      if (!salePoint.isActive) {
        throw new ValidationError(
          'Esa sucursal está desactivada, no puedes vender desde ahí',
        );
      }
      user.update({
        mobileSalesEnabled: true,
        defaultSalePointId: input.defaultSalePointId,
      });
    } else {
      user.update({ mobileSalesEnabled: false });
    }

    await this.users.save(user);
    return toUserOutput(user);
  }
}
