import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { type RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import { type SalePointOutput } from '../../../application/dtos/sale-point.output';
import { CreateSalePoint } from '../../../application/use-cases/create-sale-point.use-case';
import { ListAllSalePoints } from '../../../application/use-cases/list-all-sale-points.use-case';
import { ListSalePointsForUser } from '../../../application/use-cases/list-sale-points-for-user.use-case';
import { SetAssignedPartners } from '../../../application/use-cases/set-assigned-partners.use-case';
import { ToggleSalePoint } from '../../../application/use-cases/toggle-sale-point.use-case';
import { UpdateSalePoint } from '../../../application/use-cases/update-sale-point.use-case';
import { CreateSalePointHttpDto } from '../dtos/create-sale-point-http.dto';
import { SetAssignedPartnersHttpDto } from '../dtos/set-assigned-partners-http.dto';
import { ToggleSalePointHttpDto } from '../dtos/toggle-sale-point-http.dto';
import { UpdateSalePointHttpDto } from '../dtos/update-sale-point-http.dto';

@Controller('sale-points')
export class SalePointsController {
  constructor(
    private readonly createSalePoint: CreateSalePoint,
    private readonly listAllSalePoints: ListAllSalePoints,
    private readonly listSalePointsForUser: ListSalePointsForUser,
    private readonly setAssignedPartners: SetAssignedPartners,
    private readonly toggleSalePoint: ToggleSalePoint,
    private readonly updateSalePoint: UpdateSalePoint,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSalePointHttpDto): Promise<SalePointOutput> {
    return this.createSalePoint.execute(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  findAll(@CurrentUser() user: RequestUser): Promise<SalePointOutput[]> {
    return this.listAllSalePoints.execute({
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  @Get('mine')
  findMine(@CurrentUser() user: RequestUser): Promise<SalePointOutput[]> {
    return this.listSalePointsForUser.execute(user.id);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  toggle(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ToggleSalePointHttpDto,
  ): Promise<SalePointOutput> {
    return this.toggleSalePoint.execute({
      id,
      active: dto.active,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSalePointHttpDto,
  ): Promise<SalePointOutput> {
    return this.updateSalePoint.execute({ id, ...dto });
  }

  // Bulk-replace the list of socios asignados (read-only visibility). The
  // encargado is set via PATCH :id above; this endpoint is only for the
  // additional-visibility list.
  @Put(':id/assigned-partners')
  @Roles(UserRole.ADMIN)
  setAssigned(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetAssignedPartnersHttpDto,
  ): Promise<SalePointOutput> {
    return this.setAssignedPartners.execute({
      salePointId: id,
      partnerIds: dto.partnerIds,
    });
  }
}
