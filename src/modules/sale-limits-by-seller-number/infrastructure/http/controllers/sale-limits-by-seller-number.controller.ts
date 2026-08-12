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
import type { SaleLimitBySellerNumberOutput } from '../../../application/dtos/sale-limit-by-seller-number.output';
import { DeleteSaleLimitBySellerNumber } from '../../../application/use-cases/delete-sale-limit-by-seller-number.use-case';
import { ListSaleLimitsBySellerNumber } from '../../../application/use-cases/list-sale-limits-by-seller-number.use-case';
import { UpsertSaleLimitBySellerNumber } from '../../../application/use-cases/upsert-sale-limit-by-seller-number.use-case';
import { ListSaleLimitsBySellerNumberQueryDto } from '../dtos/list-sale-limits-by-seller-number-query.dto';
import { UpsertSaleLimitBySellerNumberHttpDto } from '../dtos/upsert-sale-limit-by-seller-number-http.dto';

@Controller('sale-limits-by-seller-number')
export class SaleLimitsBySellerNumberController {
  constructor(
    private readonly listUC: ListSaleLimitsBySellerNumber,
    private readonly upsertUC: UpsertSaleLimitBySellerNumber,
    private readonly deleteUC: DeleteSaleLimitBySellerNumber,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListSaleLimitsBySellerNumberQueryDto,
  ): Promise<SaleLimitBySellerNumberOutput[]> {
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
    @Body() dto: UpsertSaleLimitBySellerNumberHttpDto,
  ): Promise<SaleLimitBySellerNumberOutput> {
    return this.upsertUC.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: dto.salePointId,
      sellerId: dto.sellerId,
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
