import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { BUSINESS_TZ } from '../../../../../shared/domain/business-time';
import type { Ticket } from '../../../domain/entities/ticket.entity';
import type {
  FindTicketsFilters,
  TicketsRepository,
} from '../../../domain/repositories/tickets.repository';
import { TicketLineOrmEntity } from '../entities/ticket-line.orm-entity';
import { TicketOrmEntity } from '../entities/ticket.orm-entity';
import { TicketMapper } from '../mappers/ticket.mapper';

@Injectable()
export class TypeOrmTicketsRepository implements TicketsRepository {
  constructor(
    @InjectRepository(TicketOrmEntity)
    private readonly repo: Repository<TicketOrmEntity>,
    @InjectRepository(TicketLineOrmEntity)
    private readonly linesRepo: Repository<TicketLineOrmEntity>,
  ) {}

  async save(ticket: Ticket): Promise<void> {
    const orm = TicketMapper.toOrm(ticket);
    await this.repo.manager.transaction(async (manager) => {
      await manager.save(TicketOrmEntity, orm);
      await manager.delete(TicketLineOrmEntity, { ticketId: orm.id });
      await manager.save(TicketLineOrmEntity, orm.lines);
    });
  }

  async findById(id: string): Promise<Ticket | null> {
    const found = await this.repo.findOne({ where: { id } });
    return found ? TicketMapper.toDomain(found) : null;
  }

  async findByFolio(folio: string): Promise<Ticket | null> {
    const found = await this.repo.findOne({ where: { folio } });
    return found ? TicketMapper.toDomain(found) : null;
  }

  async findByClientRequestId(clientRequestId: string): Promise<Ticket | null> {
    const found = await this.repo.findOne({ where: { clientRequestId } });
    return found ? TicketMapper.toDomain(found) : null;
  }

  async findMany(filters: FindTicketsFilters): Promise<Ticket[]> {
    if (filters.salePointIds && filters.salePointIds.length === 0) return [];

    // Use QueryBuilder + LEFT JOIN instead of find() with eager relations.
    // TypeORM's find() + take/skip with eager @OneToMany generates a double
    // query: first SELECT DISTINCT ids (with LIMIT), then main query with
    // AND id IN ($1, ..., $N). When N > 65535, PostgreSQL throws "too many
    // bind parameters". QueryBuilder with leftJoinAndSelect + LIMIT/OFFSET
    // applied directly avoids that second IN clause entirely.
    const qb = this.buildQueryBuilder(filters);
    qb.orderBy('t.createdAt', 'DESC')
      .limit(filters.limit)
      .offset(filters.offset);

    const rows = await qb.getMany();
    return rows.map((row) => TicketMapper.toDomain(row));
  }

  async countMany(filters: FindTicketsFilters): Promise<number> {
    if (filters.salePointIds && filters.salePointIds.length === 0) {
      return 0;
    }
    return this.buildQueryBuilder(filters).getCount();
  }

  private buildQueryBuilder(
    filters: FindTicketsFilters,
  ): SelectQueryBuilder<TicketOrmEntity> {
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.lines', 'lines');

    if (filters.sellerId) qb.andWhere('t.sellerId = :sellerId', { sellerId: filters.sellerId });

    if (filters.salePointId) {
      qb.andWhere('t.salePointId = :salePointId', { salePointId: filters.salePointId });
    } else if (filters.salePointIds && filters.salePointIds.length > 0) {
      qb.andWhere('t.salePointId IN (:...salePointIds)', { salePointIds: filters.salePointIds });
    }

    if (filters.gameId) qb.andWhere('t.gameId = :gameId', { gameId: filters.gameId });
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });

    if (filters.drawTime) {
      // drawTime filter combines with optional drawFrom/drawTo range.
      const timeExpr = `to_char(t.drawAt AT TIME ZONE '${BUSINESS_TZ}', 'HH24:MI') = :drawTime`;
      if (filters.drawFrom && filters.drawTo) {
        qb.andWhere(`t.drawAt BETWEEN :drawFrom AND :drawTo AND ${timeExpr}`, {
          drawFrom: filters.drawFrom,
          drawTo: filters.drawTo,
          drawTime: filters.drawTime,
        });
      } else {
        qb.andWhere(timeExpr, { drawTime: filters.drawTime });
      }
    } else if (filters.drawFrom && filters.drawTo) {
      qb.andWhere('t.drawAt BETWEEN :drawFrom AND :drawTo', {
        drawFrom: filters.drawFrom,
        drawTo: filters.drawTo,
      });
    } else if (filters.drawFrom) {
      qb.andWhere('t.drawAt >= :drawFrom', { drawFrom: filters.drawFrom });
    } else if (filters.drawTo) {
      qb.andWhere('t.drawAt <= :drawTo', { drawTo: filters.drawTo });
    } else if (filters.from && filters.to) {
      qb.andWhere('t.createdAt BETWEEN :from AND :to', {
        from: filters.from,
        to: filters.to,
      });
    } else if (filters.from) {
      qb.andWhere('t.createdAt >= :from', { from: filters.from });
    } else if (filters.to) {
      qb.andWhere('t.createdAt <= :to', { to: filters.to });
    }

    const term = filters.search?.trim();
    if (term) {
      qb.andWhere('(t.folio ILIKE :folioTerm OR t.client ILIKE :clientTerm)', {
        folioTerm: `${term}%`,
        clientTerm: `%${term}%`,
      });
    }

    return qb;
  }
}
