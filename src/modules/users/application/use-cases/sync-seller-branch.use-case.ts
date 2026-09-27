import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../domain/repositories/users.repository';
import { UserRole } from '../../domain/value-objects/user-role';
import { toUserOutput, type UserOutput } from '../dtos/user.output';

export interface SyncSellerBranchOutput {
  user: UserOutput;
  ticketsMoved: number;
  movementsMoved: number;
}

@Injectable()
export class SyncSellerBranch implements UseCase<string, SyncSellerBranchOutput> {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(userId: string): Promise<SyncSellerBranchOutput> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.role !== UserRole.SELLER) {
      throw new BadRequestException('Solo se puede sincronizar vendedores.');
    }

    if (!user.salePointId) {
      throw new BadRequestException(
        'El vendedor no tiene sucursal asignada. Asígnale una antes de sincronizar.',
      );
    }

    const { ticketsMoved, movementsMoved } = await this.users.transferBranch(
      userId,
      user.salePointId,
    );

    const updated = await this.users.findById(userId);
    return { user: toUserOutput(updated!), ticketsMoved, movementsMoved };
  }
}
