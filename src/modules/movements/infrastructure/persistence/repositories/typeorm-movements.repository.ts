import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

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
    const rows = await this.repo.find({
      where: this.buildWhere(filters),
      order: { occurredAt: 'DESC' },
      take: filters.limit,
      skip: filters.offset,
    });
    return rows.map(MovementMapper.toDomain);
  }

  countMany(filters: FindMovementsFilters): Promise<number> {
    if (filters.salePointIds && filters.salePointIds.length === 0) {
      return Promise.resolve(0);
    }
    return this.repo.count({ where: this.buildWhere(filters) });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private buildWhere(
    filters: FindMovementsFilters,
  ): FindOptionsWhere<MovementOrmEntity> {
    const where: FindOptionsWhere<MovementOrmEntity> = {};
    if (filters.salePointId) {
      where.salePointId = filters.salePointId;
    } else if (filters.salePointIds && filters.salePointIds.length > 0) {
      where.salePointId = In(filters.salePointIds);
    }
    if (filters.type) where.type = filters.type;
    if (filters.from && filters.to) {
      where.occurredAt = Between(filters.from, filters.to);
    } else if (filters.from) {
      where.occurredAt = MoreThanOrEqual(filters.from);
    } else if (filters.to) {
      where.occurredAt = LessThanOrEqual(filters.to);
    }
    return where;
  }
}
