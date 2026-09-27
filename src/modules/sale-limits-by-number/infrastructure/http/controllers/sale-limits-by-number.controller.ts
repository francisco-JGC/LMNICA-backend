import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import type { RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import type { SaleLimitByNumberOutput } from '../../../application/dtos/sale-limit-by-number.output';
import { DeleteSaleLimitByNumber } from '../../../application/use-cases/delete-sale-limit-by-number.use-case';
import { GetMinAmountsByNumber } from '../../../application/use-cases/get-min-amounts-by-number.use-case';
import { ListSaleLimitsByNumber } from '../../../application/use-cases/list-sale-limits-by-number.use-case';
import { UpsertSaleLimitByNumber } from '../../../application/use-cases/upsert-sale-limit-by-number.use-case';
import { ListSaleLimitsByNumberQueryDto } from '../dtos/list-sale-limits-by-number-query.dto';
import { MinAmountsByNumberQueryDto } from '../dtos/min-amounts-by-number-query.dto';
import { UpsertSaleLimitByNumberHttpDto } from '../dtos/upsert-sale-limit-by-number-http.dto';

@Controller('sale-limits-by-number')
export class SaleLimitsByNumberController {
  constructor(
    private readonly listUC: ListSaleLimitsByNumber,
    private readonly upsertUC: UpsertSaleLimitByNumber,
    private readonly deleteUC: DeleteSaleLimitByNumber,
    private readonly minAmountsUC: GetMinAmountsByNumber,
  ) {}

  @Get('min-amounts')
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.SELLER)
  minAmounts(
    @CurrentUser() user: RequestUser,
    @Query() query: MinAmountsByNumberQueryDto,
  ): Promise<Record<string, number>> {
    return this.minAmountsUC.execute({
      requesterId: user.id,
      requesterRole: user.role,
      gameId: query.gameId,
      salePointId: query.salePointId,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListSaleLimitsByNumberQueryDto,
  ): Promise<SaleLimitByNumberOutput[]> {
    return this.listUC.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
    });
  }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  upsert(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertSaleLimitByNumberHttpDto,
  ): Promise<SaleLimitByNumberOutput> {
    return this.upsertUC.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: dto.salePointId,
      gameId: dto.gameId,
      label: dto.label,
      amount: dto.amount,
    });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ deleted: true }> {
    return this.deleteUC.execute({
      requesterId: user.id,
      requesterRole: user.role,
      id,
    });
  }
}
