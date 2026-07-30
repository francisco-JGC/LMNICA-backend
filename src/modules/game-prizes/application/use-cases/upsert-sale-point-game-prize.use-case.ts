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
import { GameType } from '../../../games/domain/value-objects/game-type';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { SalePointGamePrize } from '../../domain/entities/sale-point-game-prize.entity';
import {
  SALE_POINT_GAME_PRIZES_REPOSITORY,
  type SalePointGamePrizesRepository,
} from '../../domain/repositories/sale-point-game-prizes.repository';

export interface UpsertSalePointGamePrizeInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
  gameId: string;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  pairEasyMultiplier: number | null;
}

export interface UpsertSalePointGamePrizeOutput {
  id: string | null;
  deleted: boolean;
}

/**
 * Upsert the payout override for `(sale_point, game)`. Sending both fields
 * as `null` clears the row entirely so callers fall back to the game's
 * defaults. Admins and the partner that owns the sucursal may write.
 */
@Injectable()
export class UpsertSalePointGamePrize
  implements
    UseCase<UpsertSalePointGamePrizeInput, UpsertSalePointGamePrizeOutput>
{
  constructor(
    @Inject(SALE_POINT_GAME_PRIZES_REPOSITORY)
    private readonly prizes: SalePointGamePrizesRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: UpsertSalePointGamePrizeInput,
  ): Promise<UpsertSalePointGamePrizeOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran premios');
    }

    const [game, salePoint] = await Promise.all([
      this.games.findById(input.gameId),
      this.salePoints.findById(input.salePointId),
    ]);
    if (!game) throw new NotFoundError('Game', input.gameId);
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

    // Override compatibility — mirrors Game.assertMultipliersMatchType.
    // Easy is a THREE_DIGIT concept; pair-easy is Juega 3 specifically
    // (business decision, not technical — see game.entity.ts).
    // Clearing to null is always allowed regardless of type.
    if (game.type === GameType.MULTI_SORTEO) {
      if (
        input.exactMultiplier !== null ||
        input.easyMultiplier !== null ||
        input.pairEasyMultiplier !== null
      ) {
        throw new ValidationError(
          `Game type "${game.type}" does not accept multiplier overrides`,
        );
      }
    }
    if (game.type !== GameType.THREE_DIGIT) {
      if (input.easyMultiplier !== null) {
        throw new ValidationError(
          `Game type "${game.type}" does not accept an easy multiplier override`,
        );
      }
    }
    if (game.slug !== 'juega3' && input.pairEasyMultiplier !== null) {
      throw new ValidationError(
        `Game "${game.slug}" does not accept a pair-easy multiplier override`,
      );
    }

    const existing = await this.prizes.findByGameAndSalePoint(
      input.gameId,
      input.salePointId,
    );

    // All cleared → delete the override row (revert to game defaults).
    if (
      input.exactMultiplier === null &&
      input.easyMultiplier === null &&
      input.pairEasyMultiplier === null
    ) {
      if (existing) {
        await this.prizes.delete(existing.id);
        return { id: null, deleted: true };
      }
      return { id: null, deleted: false };
    }

    if (existing) {
      existing.updateMultipliers(
        input.exactMultiplier,
        input.easyMultiplier,
        input.pairEasyMultiplier,
      );
      await this.prizes.save(existing);
      return { id: existing.id, deleted: false };
    }

    const created = SalePointGamePrize.create({
      salePointId: input.salePointId,
      gameId: input.gameId,
      exactMultiplier: input.exactMultiplier,
      easyMultiplier: input.easyMultiplier,
      pairEasyMultiplier: input.pairEasyMultiplier,
    });
    await this.prizes.save(created);
    return { id: created.id, deleted: false };
  }
}
