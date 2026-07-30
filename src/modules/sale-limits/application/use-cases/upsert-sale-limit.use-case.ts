import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { SaleLimit } from '../../domain/entities/sale-limit.entity';
import {
  SALE_LIMITS_REPOSITORY,
  type SaleLimitsRepository,
} from '../../domain/repositories/sale-limits.repository';
import {
  toSaleLimitOutput,
  type SaleLimitOutput,
} from '../dtos/sale-limit.output';

export interface UpsertSaleLimitInput {
  requesterId: string;
  requesterRole: UserRole;
  gameId: string;
  salePointId: string;
  amount: number;
}

/**
 * Set (or update) the per-draw sales cap for a `(game, sucursal)` pair.
 * There's at most one row per pair — this hides the create-vs-update
 * distinction from callers.
 */
@Injectable()
export class UpsertSaleLimit
  implements UseCase<UpsertSaleLimitInput, SaleLimitOutput>
{
  constructor(
    @Inject(SALE_LIMITS_REPOSITORY)
    private readonly limits: SaleLimitsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: UpsertSaleLimitInput): Promise<SaleLimitOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran límites');
    }

    if (!Number.isInteger(input.amount) || input.amount < 0) {
      throw new ValidationError('amount debe ser un entero no negativo');
    }

    const game = await this.games.findById(input.gameId);
    if (!game) throw new NotFoundError('Game', input.gameId);

    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

    // Partner: only for sucursales they own.
    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    const existing = await this.limits.findByGameAndSalePoint(
      input.gameId,
      input.salePointId,
    );

    if (existing) {
      existing.setAmount(input.amount);
      await this.limits.save(existing);
      return toSaleLimitOutput(existing);
    }

    const created = SaleLimit.create({
      gameId: input.gameId,
      salePointId: input.salePointId,
      amount: input.amount,
    });
    await this.limits.save(created);
    return toSaleLimitOutput(created);
  }
}
