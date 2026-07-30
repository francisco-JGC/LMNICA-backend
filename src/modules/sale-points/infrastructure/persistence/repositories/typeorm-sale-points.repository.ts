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

  async findAll(options?: {
    includeInactive?: boolean;
  }): Promise<SalePoint[]> {
    const where = options?.includeInactive ? {} : { isActive: true };
    const rows = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => SalePointMapper.toDomain(row));
  }

  async findByPartner(
    partnerId: string,
    options?: { includeInactive?: boolean },
  ): Promise<SalePoint[]> {
    const where = options?.includeInactive
      ? { ownerPartnerId: partnerId }
      : { ownerPartnerId: partnerId, isActive: true };
    const rows = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => SalePointMapper.toDomain(row));
  }

  async findVisibleSalePointIdsForPartner(
    partnerId: string,
    options?: { includeInactive?: boolean },
  ): Promise<string[]> {
    // Owned (encargado) ∪ assigned. Dedup via Set — a partner can be both
    // encargado and (redundantly) in the assigned list without inflating
    // the result. Filtramos inactivas por defecto para que el partner no
    // vea (ni agregue) datos de sucursales que fueron desactivadas.
    const includeInactive = options?.includeInactive ?? false;
    const [owned, assignedRows] = await Promise.all([
      this.repo.find({
        where: includeInactive
          ? { ownerPartnerId: partnerId }
          : { ownerPartnerId: partnerId, isActive: true },
        select: { id: true },
      }),
      this.assignments.find({
        where: { userId: partnerId },
        select: { salePointId: true },
      }),
    ]);

    const assignedIds = assignedRows.map((r) => r.salePointId);
    // La tabla `sale_point_assigned_partners` no tiene filtro por `is_active`,
    // así que confirmamos actividad de los assigned con un fetch aparte
    // (skip si no hay assignments para evitar el `IN ()` inválido).
    const assignedActive =
      includeInactive || assignedIds.length === 0
        ? new Set(assignedIds)
        : new Set(
            (
              await this.repo.find({
                where: { id: In(assignedIds), isActive: true },
                select: { id: true },
              })
            ).map((r) => r.id),
          );

    const ids = new Set<string>();
    for (const row of owned) ids.add(row.id);
    for (const id of assignedIds) {
      if (assignedActive.has(id)) ids.add(id);
    }
    return Array.from(ids);
  }

  async findAllActiveIds(): Promise<string[]> {
    const rows = await this.repo.find({
      where: { isActive: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
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
