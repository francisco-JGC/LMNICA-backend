import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../domain/repositories/users.repository';
import { UserRole } from '../../domain/value-objects/user-role';

export interface GetSyncPreviewOutput {
  ticketCount: number;
  movementCount: number;
}

@Injectable()
export class GetSyncPreview
  implements UseCase<string, GetSyncPreviewOutput>
{
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(userId: string): Promise<GetSyncPreviewOutput> {
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

    return this.users.getSyncCounts(userId, user.salePointId);
  }
}
