import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { SaleLimitByNumber } from '../../domain/entities/sale-limit-by-number.entity';
import {
  SALE_LIMITS_BY_NUMBER_REPOSITORY,
  type SaleLimitsByNumberRepository,
} from '../../domain/repositories/sale-limits-by-number.repository';
import {
  toSaleLimitByNumberOutput,
  type SaleLimitByNumberOutput,
} from '../dtos/sale-limit-by-number.output';

export interface UpsertSaleLimitByNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
  gameId: string;
  label: string;
  amount: number;
}

/**
 * Crear o actualizar tope específico para un `(sale_point, game, label)`.
 * El uso típico desde el admin es "agregar un tope para el número 42 en
 * la Diaria de Masaya" — si ya existe se sobrescribe.
 */
@Injectable()
export class UpsertSaleLimitByNumber
  implements
    UseCase<UpsertSaleLimitByNumberInput, SaleLimitByNumberOutput>
{
  constructor(
    @Inject(SALE_LIMITS_BY_NUMBER_REPOSITORY)
    private readonly limits: SaleLimitsByNumberRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: UpsertSaleLimitByNumberInput,
  ): Promise<SaleLimitByNumberOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran límites');
    }

    const game = await this.games.findById(input.gameId);
    if (!game) throw new NotFoundError('Game', input.gameId);

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

    const label = input.label.trim();
    const existing = await this.limits.findByKey(
      input.salePointId,
      input.gameId,
      label,
    );

    if (existing) {
      existing.setAmount(input.amount);
      await this.limits.save(existing);
      return toSaleLimitByNumberOutput(existing);
    }

    const created = SaleLimitByNumber.create({
      salePointId: input.salePointId,
      gameId: input.gameId,
      label,
      amount: input.amount,
    });
    await this.limits.save(created);
    return toSaleLimitByNumberOutput(created);
  }
}
