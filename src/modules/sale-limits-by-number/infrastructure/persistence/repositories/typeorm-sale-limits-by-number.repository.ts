import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { SaleLimitByNumber } from '../../../domain/entities/sale-limit-by-number.entity';
import type { SaleLimitsByNumberRepository } from '../../../domain/repositories/sale-limits-by-number.repository';
import { SaleLimitByNumberOrmEntity } from '../entities/sale-limit-by-number.orm-entity';
import { SaleLimitByNumberMapper } from '../mappers/sale-limit-by-number.mapper';

@Injectable()
export class TypeOrmSaleLimitsByNumberRepository
  implements SaleLimitsByNumberRepository
{
  constructor(
    @InjectRepository(SaleLimitByNumberOrmEntity)
    private readonly repo: Repository<SaleLimitByNumberOrmEntity>,
  ) {}

  async save(entity: SaleLimitByNumber): Promise<void> {
    await this.repo.save(SaleLimitByNumberMapper.toOrm(entity));
  }

  async findById(id: string): Promise<SaleLimitByNumber | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? SaleLimitByNumberMapper.toDomain(row) : null;
  }

  async findBySalePoint(salePointId: string): Promise<SaleLimitByNumber[]> {
    const rows = await this.repo.find({
      where: { salePointId },
      order: { gameId: 'ASC', label: 'ASC' },
    });
    return rows.map(SaleLimitByNumberMapper.toDomain);
  }

  async findByKey(
    salePointId: string,
    gameId: string,
    label: string,
  ): Promise<SaleLimitByNumber | null> {
    const row = await this.repo.findOne({
      where: { salePointId, gameId, label },
    });
    return row ? SaleLimitByNumberMapper.toDomain(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async mapForGame(
    salePointId: string,
    gameId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.repo.find({
      where: { salePointId, gameId },
      select: { label: true, amount: true },
    });
    return new Map(rows.map((r) => [r.label, r.amount]));
  }
}
