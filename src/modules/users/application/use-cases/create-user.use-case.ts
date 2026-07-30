import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { User } from '../../domain/entities/user.entity';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../domain/repositories/users.repository';
import { UserRole } from '../../domain/value-objects/user-role';
import { type CreateUserInput } from '../dtos/create-user.input';
import { toUserOutput, type UserOutput } from '../dtos/user.output';
import { PASSWORD_HASHER, type PasswordHasher } from '../ports/password-hasher.port';

@Injectable()
export class CreateUser implements UseCase<CreateUserInput, UserOutput> {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: CreateUserInput): Promise<UserOutput> {
    // Partners can create their own sellers only — no admins, no other
    // partners, and the target must land inside one of their sucursales.
    if (input.requesterRole === UserRole.PARTNER) {
      if (input.role !== UserRole.SELLER) {
        throw new ForbiddenException(
          'Un socio solo puede crear usuarios con rol vendedor',
        );
      }
      if (!input.salePointId) {
        throw new ValidationError(
          'Debes asignar el vendedor a una de tus sucursales',
        );
      }
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException(
          'Esa sucursal no te pertenece',
        );
      }
    }

    // Domain invariant: only sellers are assigned to a sucursal via
    // `users.salePointId`. Partners relate through `sale_points.ownerPartnerId`;
    // admins operate globally. Reject up front so we don't get polluted rows.
    if (input.role !== UserRole.SELLER && input.salePointId) {
      throw new ValidationError(
        'Solo los vendedores pueden tener una sucursal asignada',
      );
    }

    const existing = await this.users.findByUsername(input.username);
    if (existing) throw new ValidationError('Username already taken');

    const hashed = await this.hasher.hash(input.password);
    // The bootstrap admin path passes a nil UUID as requesterId to signify
    // "no creator" — store null in that case so the FK stays clean.
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    const createdById =
      input.requesterId && input.requesterId !== NIL_UUID
        ? input.requesterId
        : null;
    const user = User.create({
      username: input.username,
      hashedPassword: hashed,
      name: input.name,
      role: input.role,
      phone: input.phone ?? null,
      address: input.address ?? null,
      nationalId: input.nationalId ?? null,
      paymentPercentage: input.paymentPercentage ?? null,
      salePointId:
        input.role === UserRole.SELLER ? input.salePointId ?? null : null,
      createdById,
    });
    await this.users.save(user);
    return toUserOutput(user);
  }
}
