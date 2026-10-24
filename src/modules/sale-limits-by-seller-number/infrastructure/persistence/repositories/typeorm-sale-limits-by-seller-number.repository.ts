import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { SaleLimitBySellerNumber } from '../../../domain/entities/sale-limit-by-seller-number.entity';
import type { SaleLimitsBySellerNumberRepository } from '../../../domain/repositories/sale-limits-by-seller-number.repository';
import { SaleLimitBySellerNumberOrmEntity } from '../entities/sale-limit-by-seller-number.orm-entity';
import { SaleLimitBySellerNumberMapper } from '../mappers/sale-limit-by-seller-number.mapper';

@Injectable()
export class TypeOrmSaleLimitsBySellerNumberRepository
  implements SaleLimitsBySellerNumberRepository
{
  constructor(
    @InjectRepository(SaleLimitBySellerNumberOrmEntity)
    private readonly repo: Repository<SaleLimitBySellerNumberOrmEntity>,
  ) {}

  async save(entity: SaleLimitBySellerNumber): Promise<void> {
    await this.repo.save(SaleLimitBySellerNumberMapper.toOrm(entity));
  }

  async findById(id: string): Promise<SaleLimitBySellerNumber | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? SaleLimitBySellerNumberMapper.toDomain(row) : null;
  }

  async findBySalePoint(
    salePointId: string,
  ): Promise<SaleLimitBySellerNumber[]> {
    const rows = await this.repo.find({
      where: { salePointId },
      order: { gameId: 'ASC', label: 'ASC', sellerId: 'ASC' },
    });
    return rows.map(SaleLimitBySellerNumberMapper.toDomain);
  }

  async findByKey(
    sellerId: string,
    gameId: string,
    label: string,
  ): Promise<SaleLimitBySellerNumber | null> {
    const row = await this.repo.findOne({
      where: { sellerId, gameId, label },
    });
    return row ? SaleLimitBySellerNumberMapper.toDomain(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  /**
   * Cuotas vigentes de un número en una sucursal.
   *
   * Solo cuentan las de vendedores que HOY pertenecen a esa sucursal y
   * están activos. Una cuota de alguien que se fue o fue desactivado
   * sigue existiendo en la tabla, pero dejó de ser una reserva legítima:
   * `enforceSaleLimit` calcula `pool = tope − suma de cuotas`, así que
   * contarla congela cupo para quien no puede venderlo y bloquea al resto
   * mucho antes de llegar al tope real.
   *
   * Esto pasó en producción: una cuota de 1000 sobre un tope de 1300, de
   * un vendedor ya trasladado, dejaba a los demás con 300 — y en otra
   * sucursal el pool quedaba negativo, bloqueando el número por completo.
   *
   * El filtro va acá y no en `enforceSaleLimit` porque es una propiedad
   * de qué cuotas son reales, no de cómo se aplican.
   */
  async quotasFor(
    salePointId: string,
    gameId: string,
    label: string,
  ): Promise<Map<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('q')
      .innerJoin(
        'users',
        'u',
        'u.id = q.seller_id AND u.is_active = true AND u.sale_point_id = q.sale_point_id',
      )
      .select(['q.seller_id AS seller_id', 'q.amount AS amount'])
      .where('q.sale_point_id = :salePointId', { salePointId })
      .andWhere('q.game_id = :gameId', { gameId })
      .andWhere('q.label = :label', { label })
      .getRawMany<{ seller_id: string; amount: number }>();

    return new Map(rows.map((r) => [r.seller_id, Number(r.amount)]));
  }

  async findQuotaForSeller(
    sellerId: string,
    gameId: string,
    label: string,
  ): Promise<number | null> {
    const row = await this.repo.findOne({
      where: { sellerId, gameId, label },
      select: { amount: true },
    });
    return row ? row.amount : null;
  }
}
