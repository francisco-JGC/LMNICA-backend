import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { FeatureFlag } from '../../../domain/entities/feature-flag.entity';
import type { FeatureFlagsRepository } from '../../../domain/repositories/feature-flags.repository';
import { FeatureFlagOrmEntity } from '../entities/feature-flag.orm-entity';

@Injectable()
export class TypeOrmFeatureFlagsRepository implements FeatureFlagsRepository {
  constructor(
    @InjectRepository(FeatureFlagOrmEntity)
    private readonly repo: Repository<FeatureFlagOrmEntity>,
  ) {}

  async findAll(): Promise<FeatureFlag[]> {
    const rows = await this.repo.find({ order: { key: 'ASC' } });
    return rows.map(toDomain);
  }

  async findByKey(key: string): Promise<FeatureFlag | null> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? toDomain(row) : null;
  }

  async setEnabled(key: string, enabled: boolean): Promise<FeatureFlag> {
    // Upsert: la migración seedea las keys conocidas, pero permitimos crear
    // nuevas via UI si en el futuro hace falta sin depender de una migración.
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.enabled = enabled;
      await this.repo.save(existing);
      return toDomain(existing);
    }
    const created = this.repo.create({ key, enabled, description: null });
    await this.repo.save(created);
    return toDomain(created);
  }

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.findByKey(key);
    return flag?.enabled ?? false;
  }
}

function toDomain(row: FeatureFlagOrmEntity): FeatureFlag {
  return {
    key: row.key,
    enabled: row.enabled,
    description: row.description,
    updatedAt: row.updatedAt,
  };
}
