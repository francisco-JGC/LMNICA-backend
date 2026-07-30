import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  BillingByGameOutput,
  BillingByGameRow,
} from '../dtos/billing-by-game.output';

export interface GetBillingByGameInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
}

interface RawRow {
  game_id: string;
  ticket_count: string;
  voided_count: string;
  paid_count: string;
  billed: string;
  paid_prize: string;
}

@Injectable()
export class GetBillingByGame
  implements UseCase<GetBillingByGameInput, BillingByGameOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetBillingByGameInput,
  ): Promise<BillingByGameOutput> {
    if (input.requesterRole === UserRole.SELLER) return { items: [] };

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    const rows = await this.dataSource.query<RawRow[]>(
      `
      SELECT
        t.game_id::text AS game_id,
        COALESCE(SUM(CASE WHEN t.status = 'valid'  THEN 1 ELSE 0 END), 0)::bigint AS ticket_count,
        COALESCE(SUM(CASE WHEN t.status = 'voided' THEN 1 ELSE 0 END), 0)::bigint AS voided_count,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS paid_count,
        COALESCE(SUM(CASE WHEN t.status = 'valid' THEN t.total ELSE 0 END), 0)::bigint AS billed,
        COALESCE(SUM(CASE WHEN t.paid_at IS NOT NULL THEN t.paid_prize ELSE 0 END), 0)::bigint AS paid_prize
      FROM tickets t
      WHERE ($1::uuid IS NULL OR t.sale_point_id = $1::uuid)
        AND ($2::uuid IS NULL OR t.seller_id     = $2::uuid)
        AND ($3::timestamptz IS NULL OR t.created_at >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR t.created_at <  $4::timestamptz)
        AND t.sale_point_id = ANY($5::uuid[])
      GROUP BY t.game_id
      `,
      [
        input.salePointId ?? null,
        input.sellerId ?? null,
        input.from ?? null,
        input.to ?? null,
        partnerScope,
      ],
    );

    if (rows.length === 0) return { items: [] };

    // Bulk-fetch game names.
    const games = await Promise.all(
      rows.map((r) => this.games.findById(r.game_id)),
    );
    const gameById = new Map(
      games
        .filter((g): g is NonNullable<typeof g> => g !== null)
        .map((g) => [g.id, g]),
    );

    const totalBilled = rows.reduce((sum, r) => sum + Number(r.billed), 0);

    const items: BillingByGameRow[] = rows.map((r) => {
      const game = gameById.get(r.game_id);
      const billed = Number(r.billed);
      const paidPrize = Number(r.paid_prize);
      return {
        gameId: r.game_id,
        gameName: game?.name ?? '—',
        ticketCount: Number(r.ticket_count),
        voidedCount: Number(r.voided_count),
        paidCount: Number(r.paid_count),
        billed,
        paidPrize,
        net: billed - paidPrize,
        share: totalBilled > 0 ? billed / totalBilled : 0,
      };
    });

    items.sort((a, b) => b.billed - a.billed);
    return { items };
  }
}
