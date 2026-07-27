import { Body, Controller, Get, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import type { RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import type { ListEffectiveGamePrizesOutput } from '../../../application/dtos/effective-game-prize.output';
import { ListEffectiveGamePrizes } from '../../../application/use-cases/list-effective-game-prizes.use-case';
import {
  UpsertSalePointGamePrize,
  type UpsertSalePointGamePrizeOutput,
} from '../../../application/use-cases/upsert-sale-point-game-prize.use-case';
import { ListEffectivePrizesQueryDto } from '../dtos/list-effective-prizes-query.dto';
import { UpsertGamePrizeHttpDto } from '../dtos/upsert-game-prize-http.dto';

@Controller('sale-point-game-prizes')
export class GamePrizesController {
  constructor(
    private readonly listEffective: ListEffectiveGamePrizes,
    private readonly upsert: UpsertSalePointGamePrize,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.SELLER)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListEffectivePrizesQueryDto,
  ): Promise<ListEffectiveGamePrizesOutput> {
    return this.listEffective.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
    });
  }

  // PUT upsert semantics — same body twice is idempotent, and both fields
  // null wipes the override so the caller falls back to game defaults.
  @Put()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  upsertPrize(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertGamePrizeHttpDto,
  ): Promise<UpsertSalePointGamePrizeOutput> {
    return this.upsert.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: dto.salePointId,
      gameId: dto.gameId,
      exactMultiplier: dto.exactMultiplier,
      easyMultiplier: dto.easyMultiplier,
      pairEasyMultiplier: dto.pairEasyMultiplier,
    });
  }
}
