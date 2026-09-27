import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { FindOptionsWhere, SelectQueryBuilder } from 'typeorm';

import type { Movement } from '../../../domain/entities/movement.entity';
import type {
  FindMovementsFilters,
  MovementsRepository,
} from '../../../domain/repositories/movements.repository';
import { MovementOrmEntity } from '../entities/movement.orm-entity';
import { MovementMapper } from '../mappers/movement.mapper';

@Injectable()
export class TypeOrmMovementsRepository implements MovementsRepository {
  constructor(
    @InjectRepository(MovementOrmEntity)
    private readonly repo: Repository<MovementOrmEntity>,
  ) {}

  async save(movement: Movement): Promise<void> {
    await this.repo.save(MovementMapper.toOrm(movement));
  }

  async findById(id: string): Promise<Movement | null> {
    const found = await this.repo.findOne({ where: { id } });
    return found ? MovementMapper.toDomain(found) : null;
  }

  async findByClientRequestId(
    clientRequestId: string,
  ): Promise<Movement | null> {
    const found = await this.repo.findOne({ where: { clientRequestId } });
    return found ? MovementMapper.toDomain(found) : null;
  }

  async findMany(filters: FindMovementsFilters): Promise<Movement[]> {
    if (filters.salePointIds && filters.salePointIds.length === 0) return [];

    if (filters.salePointId || filters.salePointIds?.length) {
      const rows = await this.buildScopedQb(filters)
        .orderBy('m.occurredAt', 'DESC')
        .take(filters.limit)
        .skip(filters.offset)
        .getMany();
      return rows.map(MovementMapper.toDomain);
    }

    const rows = await this.repo.find({
      where: this.buildWhere(filters),
      order: { occurredAt: 'DESC' },
      take: filters.limit,
      skip: filters.offset,
    });
    return rows.map(MovementMapper.toDomain);
  }

  async countMany(filters: FindMovementsFilters): Promise<number> {
    if (filters.salePointIds && filters.salePointIds.length === 0) return 0;

    if (filters.salePointId || filters.salePointIds?.length) {
      return this.buildScopedQb(filters).getCount();
    }

    return this.repo.count({ where: this.buildWhere(filters) });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * QueryBuilder that includes seller-level movements (salePointId IS NULL)
   * attributed to their branch via the users table.
   */
  private buildScopedQb(
    filters: FindMovementsFilters,
  ): SelectQueryBuilder<MovementOrmEntity> {
    const qb = this.repo.createQueryBuilder('m');

    if (filters.salePointId) {
      qb.where(
        '(m.salePointId = :salePointId OR ' +
          '(m.salePointId IS NULL AND m.sellerId IS NOT NULL AND ' +
          'EXISTS (SELECT 1 FROM users u WHERE u.id = m.sellerId AND u.sale_point_id = :salePointId)))',
        { salePointId: filters.salePointId },
      );
    } else {
      qb.where(
        '(m.salePointId IN (:...salePointIds) OR ' +
          '(m.salePointId IS NULL AND m.sellerId IS NOT NULL AND ' +
          'EXISTS (SELECT 1 FROM users u WHERE u.id = m.sellerId AND u.sale_point_id IN (:...salePointIds))))',
        { salePointIds: filters.salePointIds },
      );
    }

    this.applyCommonFilters(qb, filters);
    return qb;
  }

  private applyCommonFilters(
    qb: SelectQueryBuilder<MovementOrmEntity>,
    filters: FindMovementsFilters,
  ): void {
    if (filters.type) {
      qb.andWhere('m.type = :type', { type: filters.type });
    }
    if (filters.sellerId) {
      qb.andWhere('m.sellerId = :sellerId', { sellerId: filters.sellerId });
    }
    if (filters.from && filters.to) {
      qb.andWhere('m.occurredAt BETWEEN :from AND :to', {
        from: filters.from,
        to: filters.to,
      });
    } else if (filters.from) {
      qb.andWhere('m.occurredAt >= :from', { from: filters.from });
    } else if (filters.to) {
      qb.andWhere('m.occurredAt <= :to', { to: filters.to });
    }
  }

  private buildWhere(
    filters: FindMovementsFilters,
  ): FindOptionsWhere<MovementOrmEntity> {
    const where: FindOptionsWhere<MovementOrmEntity> = {};
    if (filters.sellerId) where.sellerId = filters.sellerId;
    if (filters.type) where.type = filters.type;
    if (filters.from && filters.to) {
      where.occurredAt = Between(filters.from, filters.to);
    } else if (filters.from) {
      where.occurredAt = MoreThanOrEqual(filters.from);
    } else if (filters.to) {
      where.occurredAt = LessThanOrEqual(filters.to);
    }
    if (filters.sellerId) return where;
    if (filters.salePointId) {
      where.salePointId = filters.salePointId;
    } else if (filters.salePointIds && filters.salePointIds.length > 0) {
      where.salePointId = In(filters.salePointIds);
    }
    return where;
  }
}
