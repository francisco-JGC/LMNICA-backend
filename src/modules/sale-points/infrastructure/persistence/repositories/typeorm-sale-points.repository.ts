import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { SalePoint } from '../../../domain/entities/sale-point.entity';
import { SalePointsRepository } from '../../../domain/repositories/sale-points.repository';
import { SalePointAssignedPartnerOrmEntity } from '../entities/sale-point-assigned-partner.orm-entity';
import { SalePointOrmEntity } from '../entities/sale-point.orm-entity';
import { SalePointMapper } from '../mappers/sale-point.mapper';

@Injectable()
export class TypeOrmSalePointsRepository implements SalePointsRepository {
  constructor(
    @InjectRepository(SalePointOrmEntity)
    private readonly repo: Repository<SalePointOrmEntity>,
    @InjectRepository(SalePointAssignedPartnerOrmEntity)
    private readonly assignments: Repository<SalePointAssignedPartnerOrmEntity>,
  ) {}

  async save(salePoint: SalePoint): Promise<void> {
    await this.repo.save(SalePointMapper.toOrm(salePoint));
  }

  async findById(id: string): Promise<SalePoint | null> {
    const found = await this.repo.findOne({ where: { id } });
    return found ? SalePointMapper.toDomain(found) : null;
  }

  async findByCode(code: string): Promise<SalePoint | null> {
    const found = await this.repo.findOne({ where: { code } });
    return found ? SalePointMapper.toDomain(found) : null;
  }

  async findAll(): Promise<SalePoint[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => SalePointMapper.toDomain(row));
  }

  async findByPartner(partnerId: string): Promise<SalePoint[]> {
    const rows = await this.repo.find({
      where: { ownerPartnerId: partnerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => SalePointMapper.toDomain(row));
  }

  async findVisibleSalePointIdsForPartner(partnerId: string): Promise<string[]> {
    // Owned (encargado) ∪ assigned. Dedup via Set — a partner can be both
    // encargado and (redundantly) in the assigned list without inflating
    // the result.
    const [owned, assigned] = await Promise.all([
      this.repo.find({
        where: { ownerPartnerId: partnerId },
        select: { id: true },
      }),
      this.assignments.find({
        where: { userId: partnerId },
        select: { salePointId: true },
      }),
    ]);
    const ids = new Set<string>();
    for (const row of owned) ids.add(row.id);
    for (const row of assigned) ids.add(row.salePointId);
    return Array.from(ids);
  }

  async getAssignedPartnerIds(salePointId: string): Promise<string[]> {
    const rows = await this.assignments.find({
      where: { salePointId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async getAssignedPartnerIdsByMany(
    salePointIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (salePointIds.length === 0) return map;
    const rows = await this.assignments.find({
      where: { salePointId: In(salePointIds) },
      select: { salePointId: true, userId: true },
    });
    for (const row of rows) {
      const list = map.get(row.salePointId);
      if (list) list.push(row.userId);
      else map.set(row.salePointId, [row.userId]);
    }
    return map;
  }

  async setAssignedPartnerIds(
    salePointId: string,
    partnerIds: string[],
  ): Promise<void> {
    // Full-replace in a single transaction so a partial failure can't leave
    // the sucursal with a half-updated list.
    await this.assignments.manager.transaction(async (tx) => {
      const repo = tx.getRepository(SalePointAssignedPartnerOrmEntity);
      await repo.delete({ salePointId });
      if (partnerIds.length === 0) return;
      const rows = partnerIds.map((userId) => {
        const row = new SalePointAssignedPartnerOrmEntity();
        row.salePointId = salePointId;
        row.userId = userId;
        return row;
      });
      await repo.insert(rows);
    });
  }
}
