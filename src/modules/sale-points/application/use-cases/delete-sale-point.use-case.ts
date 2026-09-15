import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../domain/repositories/sale-points.repository';

export interface DeleteSalePointInput {
  id: string;
}

@Injectable()
export class DeleteSalePoint
  implements UseCase<DeleteSalePointInput, void>
{
  constructor(
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async execute(input: DeleteSalePointInput): Promise<void> {
    const salePoint = await this.salePoints.findById(input.id);
    if (!salePoint) throw new NotFoundException('Sucursal no encontrada.');

    // Verificar que no queden datos históricos ligados.
    const [{ sellers }, { tickets }, { movements }] = await Promise.all([
      this.dataSource
        .query<[{ sellers: string }]>(
          `SELECT COUNT(*)::text AS sellers FROM users WHERE sale_point_id = $1`,
          [input.id],
        )
        .then((r) => r[0]),
      this.dataSource
        .query<[{ tickets: string }]>(
          `SELECT COUNT(*)::text AS tickets FROM tickets WHERE sale_point_id = $1`,
          [input.id],
        )
        .then((r) => r[0]),
      this.dataSource
        .query<[{ movements: string }]>(
          `SELECT COUNT(*)::text AS movements FROM movements WHERE sale_point_id = $1`,
          [input.id],
        )
        .then((r) => r[0]),
    ]);

    const reasons: string[] = [];
    if (Number(sellers) > 0)
      reasons.push(`${sellers} vendedor(es) asignado(s)`);
    if (Number(tickets) > 0)
      reasons.push(`${tickets} ticket(s) registrado(s)`);
    if (Number(movements) > 0)
      reasons.push(`${movements} movimiento(s) registrado(s)`);

    if (reasons.length > 0) {
      throw new ConflictException(
        `No se puede eliminar "${salePoint.name}" porque tiene: ${reasons.join(', ')}. Desactívala en su lugar.`,
      );
    }

    await this.salePoints.deleteById(input.id);
  }
}
