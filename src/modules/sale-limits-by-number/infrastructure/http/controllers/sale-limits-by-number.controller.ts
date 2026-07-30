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
import { ListSaleLimitsByNumber } from '../../../application/use-cases/list-sale-limits-by-number.use-case';
import { UpsertSaleLimitByNumber } from '../../../application/use-cases/upsert-sale-limit-by-number.use-case';
import { ListSaleLimitsByNumberQueryDto } from '../dtos/list-sale-limits-by-number-query.dto';
import { UpsertSaleLimitByNumberHttpDto } from '../dtos/upsert-sale-limit-by-number-http.dto';

@Controller('sale-limits-by-number')
export class SaleLimitsByNumberController {
  constructor(
    private readonly listUC: ListSaleLimitsByNumber,
    private readonly upsertUC: UpsertSaleLimitByNumber,
    private readonly deleteUC: DeleteSaleLimitByNumber,
  ) {}

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
