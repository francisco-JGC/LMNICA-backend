import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import type {
  SalesByNumberItem,
  SalesByNumberOutput,
} from '../dtos/sales-by-number.output';

export interface GetSalesByNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId?: string;
  gameId?: string;
  sellerId?: string;
  from?: Date;
  to?: Date;
}

/**
 * Agrupa las líneas de tickets válidos por (juego, número) devolviendo la
 * cantidad de veces vendido y el monto total. Alimenta la pantalla web
 * "Ventas por número", donde el operador puede ver qué números se están
 * vendiendo más en un rango dado.
 *
 * Partner scope: si el requester es partner, solo se agregan tickets de
 * sus sucursales asignadas. Si es seller, `effectiveSellerId` se fuerza
 * a su propio id — pero la web no llega acá porque los sellers usan móvil.
 */
@Injectable()
export class GetSalesByNumber
  implements UseCase<GetSalesByNumberInput, SalesByNumberOutput>
{
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: GetSalesByNumberInput,
  ): Promise<SalesByNumberOutput> {
    const effectiveSellerId =
      input.requesterRole === UserRole.SELLER
        ? input.requesterId
        : input.sellerId;

    const partnerScope = await this.scope.getAccessibleSalePointIds(
      input.requesterId,
      input.requesterRole,
    );
    if (partnerScope.length === 0) return { items: [] };

    const rows = await this.dataSource.query<
      Array<{
        game_id: string;
        game_name: string;
        label: string;
        ticket_count: string;
        total_amount: string;
      }>
    >(
      `
      SELECT
        t.game_id,
        g.name AS game_name,
        tl.label,
        COUNT(*)::bigint         AS ticket_count,
        COALESCE(SUM(tl.amount), 0)::bigint AS total_amount
      FROM ticket_lines tl
      JOIN tickets t ON t.id = tl.ticket_id
      JOIN games   g ON g.id = t.game_id
      WHERE t.status = 'valid'
        AND t.sale_point_id = ANY($1::uuid[])
        AND ($2::uuid IS NULL OR t.sale_point_id = $2::uuid)
        AND ($3::uuid IS NULL OR t.game_id       = $3::uuid)
        AND ($4::uuid IS NULL OR t.seller_id     = $4::uuid)
        AND ($5::timestamptz IS NULL OR t.created_at >= $5::timestamptz)
        AND ($6::timestamptz IS NULL OR t.created_at <  $6::timestamptz)
      GROUP BY t.game_id, g.name, tl.label
      ORDER BY total_amount DESC, ticket_count DESC
      LIMIT 2000
      `,
      [
        partnerScope,
        input.salePointId ?? null,
        input.gameId ?? null,
        effectiveSellerId ?? null,
        input.from ?? null,
        input.to ?? null,
      ],
    );

    const items: SalesByNumberItem[] = rows.map((r) => ({
      gameId: r.game_id,
      gameName: r.game_name,
      label: r.label,
      ticketCount: Number(r.ticket_count),
      totalAmount: Number(r.total_amount),
    }));
    return { items };
  }
}
