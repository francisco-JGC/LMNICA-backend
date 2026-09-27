import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import type { RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import type { BranchFlowOutput } from '../../../application/dtos/branch-flow.output';
import type { MovementOutput } from '../../../application/dtos/movement.output';
import type { MovementsBalanceOutput } from '../../../application/dtos/movements-balance.output';
import type { SellerMovementsBalanceOutput } from '../../../application/dtos/seller-movements-balance.output';
import { CreateMovement } from '../../../application/use-cases/create-movement.use-case';
import { DeleteMovement } from '../../../application/use-cases/delete-movement.use-case';
import { GetBranchFlow } from '../../../application/use-cases/get-branch-flow.use-case';
import { GetMovementsBalance } from '../../../application/use-cases/get-movements-balance.use-case';
import { GetSellerMovementsBalance } from '../../../application/use-cases/get-seller-movements-balance.use-case';
import {
  ListMovements,
  type ListMovementsOutput,
} from '../../../application/use-cases/list-movements.use-case';
import { UpdateMovement } from '../../../application/use-cases/update-movement.use-case';
import { BranchFlowQueryDto } from '../dtos/branch-flow-query.dto';
import { CreateMovementHttpDto } from '../dtos/create-movement-http.dto';
import { ListMovementsQueryDto } from '../dtos/list-movements-query.dto';
import { MovementsBalanceQueryDto } from '../dtos/movements-balance-query.dto';
import { SellerMovementsBalanceQueryDto } from '../dtos/seller-movements-balance-query.dto';
import { UpdateMovementHttpDto } from '../dtos/update-movement-http.dto';

@Controller('movements')
@Roles(UserRole.ADMIN, UserRole.PARTNER)
export class MovementsController {
  constructor(
    private readonly createMovement: CreateMovement,
    private readonly listMovements: ListMovements,
    private readonly deleteMovement: DeleteMovement,
    private readonly updateMovement: UpdateMovement,
    private readonly getMovementsBalance: GetMovementsBalance,
    private readonly getSellerMovementsBalance: GetSellerMovementsBalance,
    private readonly getBranchFlow: GetBranchFlow,
  ) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMovementHttpDto,
  ): Promise<MovementOutput> {
    return this.createMovement.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: dto.salePointId,
      sellerId: dto.sellerId ?? null,
      isPrizePayment: dto.isPrizePayment ?? false,
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      clientRequestId: dto.clientRequestId ?? null,
    });
  }

  @Get('branch-flow')
  branchFlow(
    @CurrentUser() user: RequestUser,
    @Query() query: BranchFlowQueryDto,
  ): Promise<BranchFlowOutput> {
    return this.getBranchFlow.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      gameId: query.gameId,
      sellerId: query.sellerId,
      drawAt: query.drawAt ? new Date(query.drawAt) : undefined,
    });
  }

  @Get('balance')
  balance(
    @CurrentUser() user: RequestUser,
    @Query() query: MovementsBalanceQueryDto,
  ): Promise<MovementsBalanceOutput> {
    return this.getMovementsBalance.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      salePointIds: query.salePointIds,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('seller-balance')
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.SELLER)
  sellerBalance(
    @CurrentUser() user: RequestUser,
    @Query() query: SellerMovementsBalanceQueryDto,
  ): Promise<SellerMovementsBalanceOutput> {
    return this.getSellerMovementsBalance.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointIds: query.parsedSalePointIds,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.SELLER)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMovementsQueryDto,
  ): Promise<ListMovementsOutput> {
    return this.listMovements.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      sellerId: query.sellerId,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMovementHttpDto,
  ): Promise<MovementOutput> {
    return this.updateMovement.execute({
      id,
      requesterId: user.id,
      requesterRole: user.role,
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      isPrizePayment: dto.isPrizePayment,
    });
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ deleted: true }> {
    return this.deleteMovement.execute({
      id,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }
}
