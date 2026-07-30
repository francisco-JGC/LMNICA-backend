import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../domain/repositories/users.repository';
import { UserRole } from '../../domain/value-objects/user-role';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../ports/password-hasher.port';
import { type UpdateUserInput } from '../dtos/update-user.input';
import { toUserOutput, type UserOutput } from '../dtos/user.output';

@Injectable()
export class UpdateUser implements UseCase<UpdateUserInput, UserOutput> {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: UpdateUserInput): Promise<UserOutput> {
    const user = await this.users.findById(input.id);
    if (!user) throw new NotFoundError('User', input.id);

    // Partner constraints: a partner can only edit users they themselves
    // created, cannot change their role away from seller, and if they
    // reassign the sucursal it must land within their own owned sucursales.
    if (input.requesterRole === UserRole.PARTNER) {
      if (user.createdById !== input.requesterId) {
        throw new ForbiddenException(
          'Solo puedes modificar usuarios que tú creaste',
        );
      }
      if (input.role !== undefined && input.role !== UserRole.SELLER) {
        throw new ForbiddenException(
          'Un socio solo puede asignar el rol vendedor',
        );
      }
      if (input.salePointId !== undefined && input.salePointId !== null) {
        const owned = await this.scope.getAccessibleSalePointIds(
          input.requesterId,
          input.requesterRole,
        );
        if (!owned.includes(input.salePointId)) {
          throw new ForbiddenException('Esa sucursal no te pertenece');
        }
      }
      if (input.salePointId === null) {
        throw new ForbiddenException(
          'No puedes desasignar un vendedor de tu sucursal',
        );
      }
    }

    // Enforce the same invariant as CreateUser: non-sellers cannot have
    // a salePointId. If the role transitions to non-seller we auto-clear
    // salePointId; if the client tries to set salePointId non-null on a
    // non-seller we reject explicitly.
    const finalRole = input.role ?? user.role;
    const finalSalePointId =
      input.salePointId !== undefined ? input.salePointId : user.salePointId;
    if (finalRole !== UserRole.SELLER && finalSalePointId !== null) {
      if (input.salePointId !== undefined && input.salePointId !== null) {
        throw new ValidationError(
          'Solo los vendedores pueden tener una sucursal asignada',
        );
      }
      // Role changed to non-seller and the existing salePointId is stale —
      // clear it as part of this update.
      input = { ...input, salePointId: null };
    }

    const patch: Parameters<typeof user.update>[0] = {
      name: input.name,
      role: input.role,
      isActive: input.isActive,
      phone: input.phone,
      address: input.address,
      nationalId: input.nationalId,
      paymentPercentage: input.paymentPercentage,
      salePointId: input.salePointId,
    };
    if (input.password) {
      patch.hashedPassword = await this.hasher.hash(input.password);
    }
    user.update(patch);
    await this.users.save(user);
    return toUserOutput(user);
  }
}
