import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateMovement } from '../../../application/use-cases/create-movement.use-case';
import { DeleteMovement } from '../../../application/use-cases/delete-movement.use-case';
import { GetBranchFlow } from '../../../application/use-cases/get-branch-flow.use-case';
import { GetMovementsBalance } from '../../../application/use-cases/get-movements-balance.use-case';
import {
  ListMovements,
  type ListMovementsOutput,
} from '../../../application/use-cases/list-movements.use-case';
import { BranchFlowQueryDto } from '../dtos/branch-flow-query.dto';
import { CreateMovementHttpDto } from '../dtos/create-movement-http.dto';
import { ListMovementsQueryDto } from '../dtos/list-movements-query.dto';
import { MovementsBalanceQueryDto } from '../dtos/movements-balance-query.dto';

@Controller('movements')
@Roles(UserRole.ADMIN, UserRole.PARTNER)
export class MovementsController {
  constructor(
    private readonly createMovement: CreateMovement,
    private readonly listMovements: ListMovements,
    private readonly deleteMovement: DeleteMovement,
    private readonly getMovementsBalance: GetMovementsBalance,
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
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
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

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMovementsQueryDto,
  ): Promise<ListMovementsOutput> {
    return this.listMovements.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      type: query.type,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      limit: query.limit,
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
