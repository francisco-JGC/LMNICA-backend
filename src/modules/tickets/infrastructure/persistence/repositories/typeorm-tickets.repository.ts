import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

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
    // Partner scoping with an empty allow-list means "nothing accessible".
    if (filters.salePointIds && filters.salePointIds.length === 0) return [];
    const rows = await this.repo.find({
      where: this.buildWhere(filters),
      order: { createdAt: 'DESC' },
      take: filters.limit,
      skip: filters.offset,
    });
    return rows.map((row) => TicketMapper.toDomain(row));
  }

  countMany(filters: FindTicketsFilters): Promise<number> {
    if (filters.salePointIds && filters.salePointIds.length === 0) {
      return Promise.resolve(0);
    }
    return this.repo.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(
    filters: FindTicketsFilters,
  ):
    | FindOptionsWhere<TicketOrmEntity>
    | FindOptionsWhere<TicketOrmEntity>[] {
    const base: FindOptionsWhere<TicketOrmEntity> = {};
    if (filters.sellerId) base.sellerId = filters.sellerId;
    if (filters.salePointId) {
      base.salePointId = filters.salePointId;
    } else if (filters.salePointIds && filters.salePointIds.length > 0) {
      base.salePointId = In(filters.salePointIds);
    }
    if (filters.gameId) base.gameId = filters.gameId;
    if (filters.status) base.status = filters.status;
    if (filters.from && filters.to) {
      base.createdAt = Between(filters.from, filters.to);
    } else if (filters.from) {
      base.createdAt = MoreThanOrEqual(filters.from);
    } else if (filters.to) {
      base.createdAt = LessThanOrEqual(filters.to);
    }
    if (filters.drawTime) {
      // Match "wall-clock time in Managua" — same schedule (e.g. 11:00)
      // across every day in the from/to range.
      base.drawAt = Raw(
        (alias) =>
          `to_char(${alias} AT TIME ZONE '${BUSINESS_TZ}', 'HH24:MI') = :drawTime`,
        { drawTime: filters.drawTime },
      );
    }

    const term = filters.search?.trim();
    if (!term) return base;
    // OR entre folio (prefix, uppercase — el generator emite MAYÚSCULAS)
    // y cliente (anywhere, case-insensitive). Devolver un array de
    // `FindOptionsWhere` le indica a TypeORM que combine los items con
    // OR, manteniendo cada uno los filtros comunes (AND).
    return [
      {
        ...base,
        folio: Raw((alias) => `${alias} ILIKE :folioTerm`, {
          folioTerm: `${term}%`,
        }),
      },
      {
        ...base,
        client: Raw((alias) => `${alias} ILIKE :clientTerm`, {
          clientTerm: `%${term}%`,
        }),
      },
    ];
  }
}
