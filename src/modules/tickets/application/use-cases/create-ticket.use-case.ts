import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  fromBusinessWallClock,
  parseHhmmToMinutes,
  toBusinessWallClock,
} from '../../../../shared/domain/business-time';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  FEATURE_FLAGS_REPOSITORY,
  type FeatureFlagsRepository,
} from '../../../feature-flags/domain/repositories/feature-flags.repository';
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
  SALE_LIMITS_BY_NUMBER_REPOSITORY,
  type SaleLimitsByNumberRepository,
} from '../../../sale-limits-by-number/domain/repositories/sale-limits-by-number.repository';
import {
  SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY,
  type SaleLimitsBySellerNumberRepository,
} from '../../../sale-limits-by-seller-number/domain/repositories/sale-limits-by-seller-number.repository';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import type { DrawSchedule } from '../../../games/domain/entities/draw-schedule.entity';
import { Ticket } from '../../domain/entities/ticket.entity';

/**
 * Cierre nocturno: hora Managua a partir de la cual el juego se reabre
 * al día siguiente. Espeja `_kNightlyReopenHour` del móvil.
 */
const NIGHTLY_REOPEN_HOUR = 6;

/** Gracia post-sorteo (mismo valor que el frontend). */
const POST_DRAW_GRACE_MS = 3 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
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
    @Inject(SALE_LIMITS_BY_NUMBER_REPOSITORY)
    private readonly saleLimitsByNumber: SaleLimitsByNumberRepository,
    @Inject(SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY)
    private readonly sellerQuotas: SaleLimitsBySellerNumberRepository,
    @Inject(FEATURE_FLAGS_REPOSITORY)
    private readonly featureFlags: FeatureFlagsRepository,
    @Inject(FOLIO_GENERATOR) private readonly folio: FolioGenerator,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly resolveNextDraw: ResolveNextDraw,
  ) {}

  async execute(input: CreateTicketApplicationInput): Promise<TicketOutput> {
    // Idempotencia: si el cliente mandó un requestId y ya existe un ticket
    // asociado, devolvemos ese mismo ticket. Cubre el caso "la respuesta se
    // perdió y el vendedor volvió a tocar Enviar" — creaba dos tickets con
    // los mismos números. Este check corre antes de cualquier validación
    // costosa (queries de game, sale point, seller, límites) para minimizar
    // trabajo redundante en reintentos.
    if (input.clientRequestId) {
      const existing = await this.tickets.findByClientRequestId(
        input.clientRequestId,
      );
      if (existing) return toTicketOutput(existing);
    }

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

    // Cierre nocturno: después del último sorteo del día, el juego queda
    // bloqueado hasta las 06:00 (Managua) del día siguiente. Espeja la
    // regla que aplica el móvil en `GameLockController._buildWindows`;
    // vive acá también para que un curl no pueda saltearse la restricción.
    await this.enforceNightlyLock(input.gameId);

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
      input.sellerId,
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
      clientRequestId: input.clientRequestId ?? null,
    });

    try {
      await this.tickets.save(ticket);
    } catch (err) {
      // Race: dos requests con el mismo `clientRequestId` entraron en
      // paralelo (ambos pasaron el lookup inicial), el segundo choca con
      // el UNIQUE parcial. Devolvemos el ticket ganador (el primero) para
      // que el cliente reciba una respuesta útil en vez de un 500.
      if (input.clientRequestId && this.isDuplicateRequestIdError(err)) {
        const existing = await this.tickets.findByClientRequestId(
          input.clientRequestId,
        );
        if (existing) return toTicketOutput(existing);
      }
      throw err;
    }
    return toTicketOutput(ticket);
  }

  /** Reconoce la violación del UNIQUE parcial sobre `client_request_id`. */
  private isDuplicateRequestIdError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const anyErr = err as { code?: string; constraint?: string; message?: string };
    // Postgres 23505 = unique_violation.
    if (anyErr.code !== '23505') return false;
    return (
      anyErr.constraint === 'IDX_tickets_client_request_id' ||
      (anyErr.message ?? '').includes('client_request_id')
    );
  }

  /**
   * Rechaza si `now` cae dentro de una ventana nocturna del juego. La
   * ventana va desde el `lockEnd` del último sorteo del día (drawAt + 3m
   * de gracia) hasta las 06:00 Managua del día siguiente. Chequeamos
   * "hoy" y "ayer" (biz-day) porque la ventana cruza medianoche — la
   * relevante es la del día cuyo último sorteo ya pasó.
   *
   * Gate por feature flag `nightly_lock`: cuando el admin la apaga desde
   * el panel web (típicamente para pruebas), esta validación es un no-op.
   */
  private async enforceNightlyLock(gameId: string): Promise<void> {
    const enabled = await this.featureFlags.isEnabled('nightly_lock');
    if (!enabled) return;

    const schedules = (
      await this.schedules.findByGameId(gameId)
    ).filter((s) => s.isActive);
    if (schedules.length === 0) return;

    const now = new Date();
    const nowBiz = toBusinessWallClock(now);
    // Día base = hoy si ya pasaron las 06:00; ayer si aún es madrugada.
    // Con eso cubrimos el caso donde la ventana viene del día anterior.
    const bizMidnight = fromBusinessWallClock(
      nowBiz.year,
      nowBiz.month,
      nowBiz.day,
      0,
      0,
    );
    const baseDay =
      nowBiz.hour < NIGHTLY_REOPEN_HOUR
        ? new Date(bizMidnight.getTime() - MS_PER_DAY)
        : bizMidnight;
    const baseDayBiz = toBusinessWallClock(baseDay);

    const lastLockEnd = this.lastLockEndForDay(schedules, baseDayBiz);
    if (!lastLockEnd) return;

    const nextDay = new Date(
      fromBusinessWallClock(
        baseDayBiz.year,
        baseDayBiz.month,
        baseDayBiz.day,
        0,
        0,
      ).getTime() + MS_PER_DAY,
    );
    const nextDayBiz = toBusinessWallClock(nextDay);
    const reopenAt = fromBusinessWallClock(
      nextDayBiz.year,
      nextDayBiz.month,
      nextDayBiz.day,
      NIGHTLY_REOPEN_HOUR,
      0,
    );

    if (now >= lastLockEnd && now < reopenAt) {
      throw new ValidationError(
        `El juego está cerrado hasta las 0${NIGHTLY_REOPEN_HOUR}:00 del día siguiente`,
      );
    }
  }

  /**
   * `lockEnd` (drawAt + 3m gracia) del último sorteo del día base indicado.
   * Devuelve null si el juego no tiene sorteos ese día.
   */
  private lastLockEndForDay(
    schedules: DrawSchedule[],
    day: { year: number; month: number; day: number; dayOfWeek: number },
  ): Date | null {
    let last: Date | null = null;
    for (const s of schedules) {
      if (!s.appliesTo(day.dayOfWeek)) continue;
      const minutes = parseHhmmToMinutes(s.drawTime);
      const drawAt = fromBusinessWallClock(
        day.year,
        day.month,
        day.day,
        Math.floor(minutes / 60),
        minutes % 60,
      );
      const lockEnd = new Date(drawAt.getTime() + POST_DRAW_GRACE_MS);
      if (!last || lockEnd > last) last = lockEnd;
    }
    return last;
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
   * bet past the configured cap for `(game, sale_point, drawAt)`.
   *
   * Se aplican TRES capas de topes (todas deben cumplirse):
   *
   *   1. **Cuota por vendedor** (`sale_limits_by_seller_number`): si el
   *      partner asignó una cuota específica a este vendedor para este
   *      `(game, label)`, la venta acumulada del vendedor en este sorteo
   *      no puede exceder su cuota.
   *   2. **Tope específico de sucursal** (`sale_limits_by_number`) o tope
   *      general (`sale_limits`) para el label, aplicando el más
   *      específico si existe.
   *   3. Si un vendedor NO tiene cuota específica, sigue capado por el
   *      tope de sucursal (comparte pool con otros no-asignados).
   *
   * El cap es por número por sorteo y se resetea automáticamente cuando
   * cambia el `draw_at`. Voided tickets nunca cuentan (anular libera).
   */
  private async enforceSaleLimit(
    gameId: string,
    salePointId: string,
    sellerId: string,
    drawAt: Date,
    lines: TicketLine[],
  ): Promise<void> {
    const [generalLimit, perNumberMap] = await Promise.all([
      this.saleLimits.findByGameAndSalePoint(gameId, salePointId),
      this.saleLimitsByNumber.mapForGame(salePointId, gameId),
    ]);

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

    // TODAS las cuotas por vendedor de la sucursal para cada label (no
    // solo la del vendedor actual). Necesitamos el mapa completo para
    // calcular el "pool sobrante" que comparten los vendedores SIN cuota:
    //   pool = tope_sucursal − suma_de_cuotas_asignadas
    // Antes veníamos consultando solo la cuota del vendedor actual y el
    // check de tope de sucursal miraba `sold_total` (todos los
    // vendedores), lo que hacía que un vendedor sin cuota le consumiera
    // la RESERVA a un vendedor con cuota — bug reportado con la sucursal
    // de C$1200 y vendedora con C$100 que no podía vender aunque otros
    // hubieran llenado el pool.
    const quotasByLabel = new Map<string, Map<string, number>>();
    await Promise.all(
      labels.map(async (label) => {
        const quotas = await this.sellerQuotas.quotasFor(
          salePointId,
          gameId,
          label,
        );
        quotasByLabel.set(label, quotas);
      }),
    );
    const hasAnyQuota = Array.from(quotasByLabel.values()).some(
      (m) => m.size > 0,
    );

    // Sin ningún tope aplicable → nada que validar.
    if (!generalLimit && perNumberMap.size === 0 && !hasAnyQuota) {
      return;
    }

    // Ventas del sorteo por (label, seller_id). Vamos a agregar en TS
    // distinguiendo vendedor actual / con-cuota / sin-cuota, así que el
    // GROUP BY por seller_id nos da la granularidad necesaria en un
    // solo roundtrip.
    const rows = await this.dataSource.query<
      Array<{ label: string; seller_id: string; sold: string }>
    >(
      `
      SELECT
        tl.label,
        t.seller_id::text AS seller_id,
        COALESCE(SUM(tl.amount), 0)::bigint AS sold
      FROM ticket_lines tl
      JOIN tickets t ON t.id = tl.ticket_id
      WHERE t.game_id = $1::uuid
        AND t.sale_point_id = $2::uuid
        AND t.draw_at = $3::timestamptz
        AND t.status = 'valid'
        AND tl.label = ANY($4::text[])
      GROUP BY tl.label, t.seller_id
      `,
      [gameId, salePointId, drawAt, labels],
    );

    interface SoldBucket {
      bySeller: number;
      byNonAssigned: number;
    }
    const soldByLabel = new Map<string, SoldBucket>();
    for (const label of labels) {
      soldByLabel.set(label, { bySeller: 0, byNonAssigned: 0 });
    }
    for (const r of rows) {
      const bucket = soldByLabel.get(r.label);
      if (!bucket) continue;
      const amount = Number(r.sold);
      if (r.seller_id === sellerId) bucket.bySeller += amount;
      const isAssigned =
        quotasByLabel.get(r.label)?.has(r.seller_id) ?? false;
      if (!isAssigned) bucket.byNonAssigned += amount;
    }

    for (const [label, requested] of requestedByLabel) {
      const sold = soldByLabel.get(label) ?? {
        bySeller: 0,
        byNonAssigned: 0,
      };
      const quotasForLabel = quotasByLabel.get(label);
      const currentSellerQuota = quotasForLabel?.get(sellerId);

      if (currentSellerQuota !== undefined) {
        // Vendedor CON cuota: solo su cuota personal. Su reserva es
        // INDEPENDIENTE del pool compartido — otro vendedor no puede
        // consumirle lo que le asignaron. El tope de sucursal ya está
        // garantizado a nivel invariante en el upsert de la cuota
        // (`suma_de_cuotas ≤ tope_sucursal`).
        if (sold.bySeller + requested > currentSellerQuota) {
          const available = Math.max(0, currentSellerQuota - sold.bySeller);
          throw new ValidationError(
            `Tu cuota para el número "${label}" es de C$${currentSellerQuota} en este sorteo. Disponible para vos: C$${available}.`,
          );
        }
        continue;
      }

      // Vendedor SIN cuota: pool sobrante = tope − suma_cuotas_asignadas.
      const specific = perNumberMap.get(label);
      const effectiveLimit =
        specific !== undefined ? specific : generalLimit?.amount ?? null;
      if (effectiveLimit === null) continue;

      const totalAssigned = Array.from(quotasForLabel?.values() ?? []).reduce(
        (acc, amt) => acc + amt,
        0,
      );
      const sharedPool = Math.max(0, effectiveLimit - totalAssigned);

      if (sold.byNonAssigned + requested > sharedPool) {
        const available = Math.max(0, sharedPool - sold.byNonAssigned);
        // Mensaje distinto según si hay cuotas asignadas — cambia lo que
        // el vendedor entiende del "tope".
        const message =
          totalAssigned > 0
            ? `El número "${label}" alcanzó el límite compartido para vendedores sin cuota en este sorteo. Disponible: C$${available}.`
            : `El número "${label}" alcanzó el límite de C$${effectiveLimit} para este sorteo. Disponible: C$${available}.`;
        throw new ValidationError(message);
      }
    }
  }
}
