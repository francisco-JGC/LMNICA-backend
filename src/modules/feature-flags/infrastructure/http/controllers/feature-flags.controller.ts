import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
} from '@nestjs/common';

import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import type { FeatureFlagOutput } from '../../../application/dtos/feature-flag.output';
import { ListFeatureFlags } from '../../../application/use-cases/list-feature-flags.use-case';
import { SetFeatureFlag } from '../../../application/use-cases/set-feature-flag.use-case';
import { SetFeatureFlagHttpDto } from '../dtos/set-feature-flag-http.dto';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(
    private readonly listFeatureFlags: ListFeatureFlags,
    private readonly setFeatureFlag: SetFeatureFlag,
  ) {}

  // Todos los roles pueden leer — el móvil y el web necesitan consultar
  // qué está prendido para ajustar UI y comportamiento (ej. skipear la
  // ventana nocturna cuando el admin la apagó para pruebas).
  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.SELLER)
  list(): Promise<FeatureFlagOutput[]> {
    return this.listFeatureFlags.execute();
  }

  @Patch(':key')
  @Roles(UserRole.ADMIN)
  update(
    @Param('key') key: string,
    @Body() dto: SetFeatureFlagHttpDto,
  ): Promise<FeatureFlagOutput> {
    return this.setFeatureFlag.execute({ key, enabled: dto.enabled });
  }
}
