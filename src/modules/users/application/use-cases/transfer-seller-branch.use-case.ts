import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
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

export interface TransferSellerBranchInput {
  userId: string;
  newSalePointId: string;
}

export interface TransferSellerBranchOutput {
  user: UserOutput;
  ticketsMoved: number;
  movementsMoved: number;
}

@Injectable()
export class TransferSellerBranch
  implements UseCase<TransferSellerBranchInput, TransferSellerBranchOutput>
{
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
  ) {}

  async execute(input: TransferSellerBranchInput): Promise<TransferSellerBranchOutput> {
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.role !== UserRole.SELLER) {
      throw new BadRequestException('Solo se puede transferir de sucursal a vendedores.');
    }

    if (user.salePointId === input.newSalePointId) {
      throw new BadRequestException('El vendedor ya pertenece a esa sucursal.');
    }

    const targetBranch = await this.salePoints.findById(input.newSalePointId);
    if (!targetBranch) throw new NotFoundException('Sucursal destino no encontrada.');

    const { ticketsMoved, movementsMoved } = await this.users.transferBranch(
      input.userId,
      input.newSalePointId,
    );

    const updated = await this.users.findById(input.userId);
    return { user: toUserOutput(updated!), ticketsMoved, movementsMoved };
  }
}
