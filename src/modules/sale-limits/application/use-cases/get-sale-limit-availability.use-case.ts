import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  SALE_LIMITS_REPOSITORY,
  type SaleLimitsRepository,
} from '../../domain/repositories/sale-limits.repository';
import type { SaleLimitAvailabilityOutput } from '../dtos/sale-limit-availability.output';

export interface GetSaleLimitAvailabilityInput {
  requesterId: string;
  requesterRole: UserRole;
  gameId: string;
  salePointId: string;
  drawAt: Date;
}

/**
 * Snapshot of "how much is left per number" for the specified draw.
 * Sellers are allowed for their own sucursal — that's the whole point,
 * the mobile picker needs this info.
 */
@Injectable()
export class GetSaleLimitAvailability
  implements
    UseCase<GetSaleLimitAvailabilityInput, SaleLimitAvailabilityOutput>
{
  constructor(
    @Inject(SALE_LIMITS_REPOSITORY)
    private readonly limits: SaleLimitsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetSaleLimitAvailabilityInput,
  ): Promise<SaleLimitAvailabilityOutput> {
    // Sellers can only ask about their own sucursal.
    if (input.requesterRole === UserRole.SELLER) {
      const seller = await this.users.findById(input.requesterId);
      if (!seller || seller.salePointId !== input.salePointId) {
        throw new ForbiddenException(
          'No puedes consultar disponibilidad fuera de tu sucursal',
        );
      }
    } else if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    const limit = await this.limits.findByGameAndSalePoint(
      input.gameId,
      input.salePointId,
    );

    // Even if there's no configured limit, we still return usage so the UI
    // can display "already sold: C$X" if it wants to. Keeps the endpoint
    // useful across configurations.
    const rows = await this.dataSource.query<
      Array<{ label: string; sold: string }>
    >(
      `
      SELECT tl.label, COALESCE(SUM(tl.amount), 0)::bigint AS sold
      FROM ticket_lines tl
      JOIN tickets t ON t.id = tl.ticket_id
      WHERE t.game_id = $1::uuid
        AND t.sale_point_id = $2::uuid
        AND t.draw_at = $3::timestamptz
        AND t.status = 'valid'
      GROUP BY tl.label
      `,
      [input.gameId, input.salePointId, input.drawAt],
    );

    const usage: Record<string, number> = {};
    for (const r of rows) {
      usage[r.label] = Number(r.sold);
    }

    return {
      limit: limit ? limit.amount : null,
      usage,
    };
  }
}
