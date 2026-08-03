import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { type RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import type { DashboardSummaryOutput } from '../../../application/dtos/dashboard-summary.output';
import { GetDashboardSummary } from '../../../application/use-cases/get-dashboard-summary.use-case';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getSummary: GetDashboardSummary) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  summary(
    @CurrentUser() user: RequestUser,
    // ISO 8601 con offset — el cliente arma `YYYY-MM-DDT00:00:00-06:00`
    // (o el offset local). Si alguno viene mal, respondemos 400.
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<DashboardSummaryOutput> {
    return this.getSummary.execute({
      requesterId: user.id,
      requesterRole: user.role,
      from: parseIsoOr400(from, 'from'),
      to: parseIsoOr400(to, 'to'),
    });
  }
}

function parseIsoOr400(value: string | undefined, name: string): Date | undefined {
  if (value === undefined || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Query param "${name}" no es una fecha ISO válida.`);
  }
  return d;
}
