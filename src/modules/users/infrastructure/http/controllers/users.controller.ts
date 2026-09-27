import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Public } from '../../../../auth/infrastructure/http/decorators/public.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { type RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { BootstrapFirstAdmin } from '../../../application/use-cases/bootstrap-first-admin.use-case';
import { CreateUser } from '../../../application/use-cases/create-user.use-case';
import { FindUserById } from '../../../application/use-cases/find-user-by-id.use-case';
import {
  GetSyncPreview,
  type GetSyncPreviewOutput,
} from '../../../application/use-cases/get-sync-preview.use-case';
import {
  GetTransferPreview,
  type GetTransferPreviewOutput,
} from '../../../application/use-cases/get-transfer-preview.use-case';
import {
  ListUsers,
  type ListUsersOutput,
} from '../../../application/use-cases/list-users.use-case';
import {
  SyncSellerBranch,
  type SyncSellerBranchOutput,
} from '../../../application/use-cases/sync-seller-branch.use-case';
import {
  TransferSellerBranch,
  type TransferSellerBranchOutput,
} from '../../../application/use-cases/transfer-seller-branch.use-case';
import { UpdateMobileSalesProfile } from '../../../application/use-cases/update-mobile-sales-profile.use-case';
import { UpdateUser } from '../../../application/use-cases/update-user.use-case';
import { UserOutput } from '../../../application/dtos/user.output';
import { UserRole } from '../../../domain/value-objects/user-role';
import { BootstrapAdminHttpDto } from '../dtos/bootstrap-admin-http.dto';
import { CreateUserHttpDto } from '../dtos/create-user-http.dto';
import { ListUsersQueryDto } from '../dtos/list-users-query.dto';
import { TransferBranchHttpDto } from '../dtos/transfer-branch-http.dto';
import { UpdateMobileSalesProfileHttpDto } from '../dtos/update-mobile-sales-profile-http.dto';
import { UpdateUserHttpDto } from '../dtos/update-user-http.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUser,
    private readonly findUserById: FindUserById,
    private readonly listUsers: ListUsers,
    private readonly updateUser: UpdateUser,
    private readonly updateMobileSalesProfile: UpdateMobileSalesProfile,
    private readonly bootstrapFirstAdmin: BootstrapFirstAdmin,
    private readonly getTransferPreviewUC: GetTransferPreview,
    private readonly transferSellerBranchUC: TransferSellerBranch,
    private readonly getSyncPreviewUC: GetSyncPreview,
    private readonly syncSellerBranchUC: SyncSellerBranch,
  ) {}

  @Post('bootstrap')
  @Public()
  bootstrap(@Body() dto: BootstrapAdminHttpDto): Promise<UserOutput> {
    return this.bootstrapFirstAdmin.execute(dto);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateUserHttpDto,
  ): Promise<UserOutput> {
    return this.createUser.execute({
      ...dto,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<ListUsersOutput> {
    return this.listUsers.execute({
      requesterId: user.id,
      requesterRole: user.role,
      role: query.role,
      search: query.search,
      salePointId: query.salePointId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<UserOutput> {
    return this.findUserById.execute(id);
  }

  /**
   * Debe vivir ANTES de @Patch(':id') para que Nest no lo interprete
   * como un UUID param con valor literal "me".
   */
  @Patch('me/mobile-sales')
  @Roles(UserRole.ADMIN)
  updateMobileSales(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMobileSalesProfileHttpDto,
  ): Promise<UserOutput> {
    return this.updateMobileSalesProfile.execute({
      requesterId: user.id,
      requesterRole: user.role,
      mobileSalesEnabled: dto.mobileSalesEnabled,
      defaultSalePointId: dto.defaultSalePointId ?? null,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserHttpDto,
  ): Promise<UserOutput> {
    return this.updateUser.execute({
      id,
      ...dto,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  /**
   * Must be declared BEFORE :id/transfer-branch (POST) so Nest matches it
   * as a distinct GET route and not as a param route.
   */
  @Get(':id/transfer-branch/preview')
  @Roles(UserRole.ADMIN)
  transferPreview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('newSalePointId', new ParseUUIDPipe()) newSalePointId: string,
  ): Promise<GetTransferPreviewOutput> {
    return this.getTransferPreviewUC.execute({ userId: id, newSalePointId });
  }

  @Post(':id/transfer-branch')
  @Roles(UserRole.ADMIN)
  transferBranch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: TransferBranchHttpDto,
  ): Promise<TransferSellerBranchOutput> {
    return this.transferSellerBranchUC.execute({
      userId: id,
      newSalePointId: dto.newSalePointId,
    });
  }

  @Get(':id/sync-branch/preview')
  @Roles(UserRole.ADMIN)
  syncPreview(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GetSyncPreviewOutput> {
    return this.getSyncPreviewUC.execute(id);
  }

  @Post(':id/sync-branch')
  @Roles(UserRole.ADMIN)
  syncBranch(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SyncSellerBranchOutput> {
    return this.syncSellerBranchUC.execute(id);
  }
}
