import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
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
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_POINT_GAME_PRIZES_REPOSITORY,
  type SalePointGamePrizesRepository,
} from '../../domain/repositories/sale-point-game-prizes.repository';
import type {
  EffectiveGamePrizeOutput,
  ListEffectiveGamePrizesOutput,
} from '../dtos/effective-game-prize.output';

export interface ListEffectiveGamePrizesInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
}

/**
 * Returns one row per active game with the effective multipliers for the
 * given sucursal — override merged over game default. The UI uses this
 * for both display (with defaults as placeholders) and for the mobile app
 * to know which multiplier to apply when computing ticket line prizes.
 *
 * Sellers may consult their own sucursal so the mobile can compute prizes
 * correctly at the moment of sale.
 */
@Injectable()
export class ListEffectiveGamePrizes
  implements
    UseCase<ListEffectiveGamePrizesInput, ListEffectiveGamePrizesOutput>
{
  constructor(
    @Inject(SALE_POINT_GAME_PRIZES_REPOSITORY)
    private readonly prizes: SalePointGamePrizesRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: ListEffectiveGamePrizesInput,
  ): Promise<ListEffectiveGamePrizesOutput> {
    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

    // Sellers may only look at their own sucursal.
    if (input.requesterRole === UserRole.SELLER) {
      const seller = await this.users.findById(input.requesterId);
      if (!seller || seller.salePointId !== input.salePointId) {
        throw new ForbiddenException(
          'No puedes consultar premios fuera de tu sucursal',
        );
      }
    } else if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    const [allGames, overrides] = await Promise.all([
      this.games.findAll({ onlyActive: true }),
      this.prizes.findBySalePoint(input.salePointId),
    ]);

    // Multi-sorteo is a container that creates tickets in its sub-games —
    // it has no multipliers of its own. Sub-games hold the real rules, so
    // configuring prizes on it is meaningless. Filter it out.
    const configurableGames = allGames.filter(
      (g) => g.type !== GameType.MULTI_SORTEO,
    );

    const overrideByGameId = new Map(overrides.map((o) => [o.gameId, o]));

    const items: EffectiveGamePrizeOutput[] = configurableGames.map((game) => {
      const override = overrideByGameId.get(game.id) ?? null;
      const exactDefault = game.exactMultiplier;
      const easyDefault = game.easyMultiplier;
      const pairEasyDefault = game.pairEasyMultiplier;
      const overrideExact = override?.exactMultiplier ?? null;
      const overrideEasy = override?.easyMultiplier ?? null;
      const overridePairEasy = override?.pairEasyMultiplier ?? null;
      return {
        gameId: game.id,
        gameSlug: game.slug,
        gameName: game.name,
        gameType: game.type,
        exactDefault,
        easyDefault,
        pairEasyDefault,
        exactMultiplier: overrideExact ?? exactDefault,
        easyMultiplier: overrideEasy ?? easyDefault,
        pairEasyMultiplier: overridePairEasy ?? pairEasyDefault,
        overrideId: override?.id ?? null,
        overrideExact,
        overrideEasy,
        overridePairEasy,
        hasOverride: override !== null,
      };
    });

    return { items };
  }
}
