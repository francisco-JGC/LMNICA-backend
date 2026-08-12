import { randomUUID } from 'crypto';

import { Ticket } from '../../../domain/entities/ticket.entity';
import { TicketLine } from '../../../domain/value-objects/ticket-line';
import { TicketLineOrmEntity } from '../entities/ticket-line.orm-entity';
import { TicketOrmEntity } from '../entities/ticket.orm-entity';

export class TicketMapper {
  static toDomain(orm: TicketOrmEntity): Ticket {
    const lines = [...orm.lines]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(
        (line) =>
          new TicketLine({
            label: line.label,
            amount: line.amount,
            prize: line.prize,
            pairEasyPrize: line.pairEasyPrize ?? null,
            subGameId: line.subGameId,
            subGameName: line.subGameName,
            orderIndex: line.orderIndex,
          }),
      );

    return Ticket.restore(orm.id, {
      folio: orm.folio,
      gameId: orm.gameId,
      salePointId: orm.salePointId,
      sellerId: orm.sellerId,
      client: orm.client,
      lines,
      status: orm.status,
      voidedAt: orm.voidedAt,
      voidedReason: orm.voidedReason,
      drawAt: orm.drawAt,
      cutoffMinutes: orm.cutoffMinutes,
      paidAt: orm.paidAt,
      paidById: orm.paidById,
      paidPrize: orm.paidPrize,
      clientRequestId: orm.clientRequestId,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(ticket: Ticket): TicketOrmEntity {
    const entity = new TicketOrmEntity();
    entity.id = ticket.id;
    entity.folio = ticket.folio;
    entity.gameId = ticket.gameId;
    entity.salePointId = ticket.salePointId;
    entity.sellerId = ticket.sellerId;
    entity.client = ticket.client;
    entity.status = ticket.status;
    entity.voidedAt = ticket.voidedAt;
    entity.voidedReason = ticket.voidedReason;
    entity.total = ticket.total;
    entity.totalPrize = ticket.totalPrize;
    entity.drawAt = ticket.drawAt;
    entity.cutoffMinutes = ticket.cutoffMinutes;
    entity.paidAt = ticket.paidAt;
    entity.paidById = ticket.paidById;
    entity.paidPrize = ticket.paidPrize;
    entity.clientRequestId = ticket.clientRequestId;
    entity.createdAt = ticket.createdAt;
    entity.updatedAt = ticket.updatedAt;
    entity.lines = ticket.lines.map((line) => {
      const lineEntity = new TicketLineOrmEntity();
      lineEntity.id = randomUUID();
      lineEntity.ticketId = ticket.id;
      lineEntity.label = line.label;
      lineEntity.amount = line.amount;
      lineEntity.prize = line.prize;
      lineEntity.pairEasyPrize = line.pairEasyPrize;
      lineEntity.subGameId = line.subGameId;
      lineEntity.subGameName = line.subGameName;
      lineEntity.orderIndex = line.orderIndex;
      return lineEntity;
    });
    return entity;
  }
}
