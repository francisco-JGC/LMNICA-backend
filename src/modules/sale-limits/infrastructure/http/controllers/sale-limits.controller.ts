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
import type { SaleLimitAvailabilityOutput } from '../../../application/dtos/sale-limit-availability.output';
import type { SaleLimitOutput } from '../../../application/dtos/sale-limit.output';
import { DeleteSaleLimit } from '../../../application/use-cases/delete-sale-limit.use-case';
import { GetSaleLimitAvailability } from '../../../application/use-cases/get-sale-limit-availability.use-case';
import { ListSaleLimits } from '../../../application/use-cases/list-sale-limits.use-case';
import { UpsertSaleLimit } from '../../../application/use-cases/upsert-sale-limit.use-case';
import { SaleLimitAvailabilityQueryDto } from '../dtos/sale-limit-availability-query.dto';
import { UpsertSaleLimitHttpDto } from '../dtos/upsert-sale-limit-http.dto';

@Controller('sale-limits')
export class SaleLimitsController {
  constructor(
    private readonly listSaleLimits: ListSaleLimits,
    private readonly upsertSaleLimit: UpsertSaleLimit,
    private readonly deleteSaleLimit: DeleteSaleLimit,
    private readonly getSaleLimitAvailability: GetSaleLimitAvailability,
  ) {}

  @Get('availability')
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.SELLER)
  availability(
    @CurrentUser() user: RequestUser,
    @Query() query: SaleLimitAvailabilityQueryDto,
  ): Promise<SaleLimitAvailabilityOutput> {
    return this.getSaleLimitAvailability.execute({
      requesterId: user.id,
      requesterRole: user.role,
      gameId: query.gameId,
      salePointId: query.salePointId,
      drawAt: new Date(query.drawAt),
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  list(@CurrentUser() user: RequestUser): Promise<SaleLimitOutput[]> {
    return this.listSaleLimits.execute({
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  // PUT because upsert semantics — no distinction between create and update
  // from the caller's perspective. Idempotent for the same body.
  @Put()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  upsert(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertSaleLimitHttpDto,
  ): Promise<SaleLimitOutput> {
    return this.upsertSaleLimit.execute({
      requesterId: user.id,
      requesterRole: user.role,
      gameId: dto.gameId,
      salePointId: dto.salePointId,
      amount: dto.amount,
      maxPerTicket: dto.maxPerTicket,
    });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ deleted: true }> {
    return this.deleteSaleLimit.execute({
      id,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }
}
