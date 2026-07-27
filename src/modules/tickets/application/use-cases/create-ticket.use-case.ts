import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { toBusinessWallClock } from '../../../../shared/domain/business-time';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  DRAW_SCHEDULES_REPOSITORY,
  type DrawSchedulesRepository,
} from '../../../games/domain/repositories/draw-schedules.repository';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import { ResolveNextDraw } from '../../../games/application/use-cases/resolve-next-draw.use-case';
import {
  SALE_LIMITS_REPOSITORY,
  type SaleLimitsRepository,
} from '../../../sale-limits/domain/repositories/sale-limits.repository';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { Ticket } from '../../domain/entities/ticket.entity';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { TicketLine } from '../../domain/value-objects/ticket-line';
import type { CreateTicketApplicationInput } from '../dtos/create-ticket.input';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';
import {
  FOLIO_GENERATOR,
  type FolioGenerator,
} from '../ports/folio-generator.port';

@Injectable()
export class CreateTicket implements UseCase<CreateTicketApplicationInput, TicketOutput> {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(DRAW_SCHEDULES_REPOSITORY)
    private readonly schedules: DrawSchedulesRepository,
    @Inject(SALE_LIMITS_REPOSITORY)
    private readonly saleLimits: SaleLimitsRepository,
    @Inject(FOLIO_GENERATOR) private readonly folio: FolioGenerator,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly resolveNextDraw: ResolveNextDraw,
  ) {}

  async execute(input: CreateTicketApplicationInput): Promise<TicketOutput> {
    const game = await this.games.findById(input.gameId);
    if (!game) throw new NotFoundError('Game', input.gameId);
    if (!game.isActive) {
      throw new ValidationError('Game is not active');
    }

    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);
    if (!salePoint.isActive) {
      throw new ValidationError('Sale point is not active');
    }

    // A sale point can host multiple sellers. The seller must be assigned
    // to THIS puesto via `users.sale_point_id`. `sale_points.owner_id` is
    // no longer authoritative for ticket creation.
    const seller = await this.users.findById(input.sellerId);
    if (!seller) throw new NotFoundError('User', input.sellerId);
    if (!seller.isActive) {
      throw new ValidationError('Seller access is disabled');
    }
    if (seller.salePointId !== input.salePointId) {
      throw new ValidationError('Seller does not belong to this sale point');
    }

    const lines = input.lines.map(
      (raw, i) =>
        new TicketLine({
          label: raw.label,
          amount: raw.amount,
          prize: raw.prize,
          pairEasyPrize: raw.pairEasyPrize ?? null,
          subGameId: raw.subGameId ?? null,
          subGameName: raw.subGameName ?? null,
          orderIndex: i,
        }),
    );

    const draw = input.drawAt
      ? await this.validateExplicitDraw(input.gameId, input.drawAt)
      : await this.resolveNextDraw.execute({
          gameId: input.gameId,
          at: new Date(),
        });

    // Enforce per-number sales cap. If admin/partner configured a limit
    // for this (game, sucursal), each `label` in this ticket must fit
    // within `limit - already_sold` for THIS draw.
    await this.enforceSaleLimit(
      input.gameId,
      input.salePointId,
      draw.drawAt,
      lines,
    );

    const ticket = Ticket.create({
      folio: this.folio.generate(),
      gameId: input.gameId,
      salePointId: input.salePointId,
      sellerId: input.sellerId,
      client: this.cleanClient(input.client),
      lines,
      drawAt: draw.drawAt,
      cutoffMinutes: draw.cutoffMinutes,
    });

    await this.tickets.save(ticket);
    return toTicketOutput(ticket);
  }

  private async validateExplicitDraw(
    gameId: string,
    drawAt: Date,
  ): Promise<{ drawAt: Date; cutoffMinutes: number }> {
    const schedules = await this.schedules.findByGameId(gameId);
    const active = schedules.filter((s) => s.isActive);
    if (active.length === 0) {
      throw new ValidationError('Game has no active draw schedules');
    }

    // Extract wall-clock in BUSINESS_TZ so schedule matching works
    // regardless of the server's process timezone.
    const wall = toBusinessWallClock(drawAt);
    const dayOfWeek = wall.dayOfWeek;
    const drawMinutes = wall.hour * 60 + wall.minute;
    const matching = active.find(
      (s) => s.appliesTo(dayOfWeek) && s.toMinutes() === drawMinutes,
    );
    if (!matching) {
      throw new ValidationError(
        'Requested drawAt does not match any schedule for this game',
      );
    }

    const now = new Date();
    const cutoffAt = new Date(
      drawAt.getTime() - matching.cutoffMinutes * 60_000,
    );
    if (now >= cutoffAt) {
      throw new ValidationError(
        `Cannot create ticket within ${matching.cutoffMinutes} minutes of the draw`,
      );
    }

    return { drawAt, cutoffMinutes: matching.cutoffMinutes };
  }

  private cleanClient(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  /**
   * Reject the ticket if any of its lines would push a `label`'s cumulative
   * bet past the configured cap for `(game, sale_point, drawAt)`. The cap
   * is per number per draw and resets automatically when `drawAt` changes.
   *
   * No configured limit → no check. Voided tickets never count (deleting a
   * ticket frees up the number for that draw).
   */
  private async enforceSaleLimit(
    gameId: string,
    salePointId: string,
    drawAt: Date,
    lines: TicketLine[],
  ): Promise<void> {
    const limit = await this.saleLimits.findByGameAndSalePoint(
      gameId,
      salePointId,
    );
    if (!limit) return;

    // Compound this ticket's own repeated labels into a single request.
    const requestedByLabel = new Map<string, number>();
    for (const line of lines) {
      requestedByLabel.set(
        line.label,
        (requestedByLabel.get(line.label) ?? 0) + line.amount,
      );
    }
    const labels = Array.from(requestedByLabel.keys());
    if (labels.length === 0) return;

    const rows = await this.dataSource.query<
      Array<{ label: string; sold: string }>
    >(
      `
      SELECT tl.label, COALESCE(SUM(tl.amount), 0)::bigint AS sold
      FROM ticket_lines tl
      JOIN tickets t ON t.id = tl.ticket_id
      WHERE t.game_id = $1::uuid
        AND t.sale_point_id = $2::uuid
        AND t.draw_at = $3::timestamptz
        AND t.status = 'valid'
        AND tl.label = ANY($4::text[])
      GROUP BY tl.label
      `,
      [gameId, salePointId, drawAt, labels],
    );
    const soldByLabel = new Map(rows.map((r) => [r.label, Number(r.sold)]));

    for (const [label, requested] of requestedByLabel) {
      const sold = soldByLabel.get(label) ?? 0;
      if (sold + requested > limit.amount) {
        const available = Math.max(0, limit.amount - sold);
        throw new ValidationError(
          `El número "${label}" alcanzó el límite de C$${limit.amount} para este sorteo. Disponible: C$${available}.`,
        );
      }
    }
  }
}
