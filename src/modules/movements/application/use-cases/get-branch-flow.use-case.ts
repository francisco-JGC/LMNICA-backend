import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type { MovementType } from '../../domain/value-objects/movement-type';
import type {
  BranchFlowItem,
  BranchFlowKind,
  BranchFlowOutput,
} from '../dtos/branch-flow.output';

export interface GetBranchFlowInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  kind: BranchFlowKind;
  at: Date;
  amount: string;
  folio: string | null;
  movement_type: MovementType | null;
  description: string;
  ref_id: string;
}

/**
 * Chronological, per-sucursal timeline combining ticket sales, prize
 * payouts and manually-registered movements. One SQL round trip via
 * UNION ALL so pagination and sorting stay database-side.
 *
 * A single sucursal is required (this report only makes sense scoped).
 */
@Injectable()
export class GetBranchFlow
  implements UseCase<GetBranchFlowInput, BranchFlowOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: GetBranchFlowInput): Promise<BranchFlowOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException(
        'Los vendedores no ven el flujo de sucursal',
      );
    }
    if (!input.salePointId) {
      throw new ValidationError('salePointId es obligatorio');
    }

    // Verify the sucursal exists and the caller can see it.
    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        'ticket_sale'::text AS kind,
        t.created_at        AS at,
        t.total::bigint     AS amount,
        t.folio             AS folio,
        NULL::text          AS movement_type,
        ''::text            AS description,
        t.id::text          AS ref_id
      FROM tickets t
      WHERE t.sale_point_id = $1::uuid
        AND t.status = 'valid'
        AND ($2::timestamptz IS NULL OR t.created_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR t.created_at <  $3::timestamptz)

      UNION ALL

      SELECT
        'prize_payout'::text AS kind,
        t.paid_at            AS at,
        t.paid_prize::bigint AS amount,
        t.folio              AS folio,
        NULL::text           AS movement_type,
        ''::text             AS description,
        t.id::text           AS ref_id
      FROM tickets t
      WHERE t.sale_point_id = $1::uuid
        AND t.paid_at IS NOT NULL
        AND ($2::timestamptz IS NULL OR t.paid_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR t.paid_at <  $3::timestamptz)

      UNION ALL

      SELECT
        'movement'::text    AS kind,
        m.occurred_at       AS at,
        m.amount::bigint    AS amount,
        NULL::text          AS folio,
        m.type::text        AS movement_type,
        m.description       AS description,
        m.id::text          AS ref_id
      FROM movements m
      WHERE m.sale_point_id = $1::uuid
        AND ($2::timestamptz IS NULL OR m.occurred_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR m.occurred_at <  $3::timestamptz)

      ORDER BY at ASC
      `,
      [input.salePointId, input.from ?? null, input.to ?? null],
    );

    const items: BranchFlowItem[] = rows.map((r) => ({
      kind: r.kind,
      at: r.at,
      amount: Number(r.amount),
      folio: r.folio,
      movementType: r.movement_type,
      description: r.description ?? '',
      refId: r.ref_id,
    }));

    return { items };
  }
}
