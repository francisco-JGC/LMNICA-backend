import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import { BUSINESS_TZ } from '../../../../shared/domain/business-time';
import {
  DRAW_SCHEDULES_REPOSITORY,
  type DrawSchedulesRepository,
} from '../../domain/repositories/draw-schedules.repository';
import {
  toDrawScheduleOutput,
  type DrawScheduleOutput,
} from '../dtos/draw-schedule.output';

export interface UpdateDrawScheduleApplicationInput {
  id: string;
  dayOfWeek?: number | null;
  drawTime?: string;
  cutoffMinutes?: number;
  isActive?: boolean;
}

@Injectable()
export class UpdateDrawSchedule
  implements UseCase<UpdateDrawScheduleApplicationInput, DrawScheduleOutput>
{
  constructor(
    @Inject(DRAW_SCHEDULES_REPOSITORY)
    private readonly schedules: DrawSchedulesRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async execute(
    input: UpdateDrawScheduleApplicationInput,
  ): Promise<DrawScheduleOutput> {
    const schedule = await this.schedules.findById(input.id);
    if (!schedule) throw new NotFoundError('DrawSchedule', input.id);

    // Snapshot ANTES del update — los usamos para localizar los tickets
    // futuros que hay que realinear al nuevo horario.
    const previousDrawTime = schedule.drawTime;
    const previousDayOfWeek = schedule.dayOfWeek;
    const gameId = schedule.gameId;

    schedule.update({
      dayOfWeek: input.dayOfWeek,
      drawTime: input.drawTime,
      cutoffMinutes: input.cutoffMinutes,
      isActive: input.isActive,
    });
    await this.schedules.save(schedule);

    // Si cambió la hora del sorteo, cascadeamos el shift a los tickets y
    // draw_results FUTUROS que apuntaban al horario viejo. Sin esto, un
    // vendedor que ya vendió boletos para el sorteo de las 16:30 se
    // encontraba con que el admin cambió a 16:28 → al cargar el resultado
    // del 16:28 los boletos quedaban huérfanos (drawAt no matcheaba) y
    // los ganadores no eran detectados. Se hace acá en el backend para
    // no requerir update de la app móvil — los boletos ya persistidos
    // se realinean solos.
    if (
      input.drawTime !== undefined &&
      input.drawTime !== previousDrawTime
    ) {
      await this.shiftFutureDraws({
        gameId,
        // Usamos el `dayOfWeek` VIEJO para identificar qué boletos había
        // vendidos bajo el schedule anterior.
        dayOfWeek: previousDayOfWeek,
        oldTime: previousDrawTime,
        newTime: input.drawTime,
      });
    }

    return toDrawScheduleOutput(schedule);
  }

  /**
   * Corre un UPDATE que suma/resta la diferencia entre el horario viejo y
   * el nuevo a los `draw_at` de:
   *   - `tickets` del mismo juego, futuros.
   *   - `draw_results` del mismo juego, futuros (por si el admin cargó el
   *     resultado antes de cambiar el schedule — poco común pero posible).
   *
   * Filtros:
   *   - `game_id` — solo el juego afectado.
   *   - `draw_at > now()` — solo sorteos que aún no ocurrieron. Los
   *     boletos de sorteos pasados NO se tocan (su resultado ya está
   *     determinado).
   *   - `to_char(...) = oldTime` — solo los que apuntan al horario viejo.
   *   - `EXTRACT(DOW ...) = dayOfWeek` — solo los del día de semana
   *     afectado. Si el schedule tenía `day_of_week = NULL` (diario),
   *     aplica a todos los días.
   *
   * Ambos updates corren dentro de una transacción para que un fallo a
   * mitad no deje datos inconsistentes.
   */
  private async shiftFutureDraws(params: {
    gameId: string;
    dayOfWeek: number | null;
    oldTime: string;
    newTime: string;
  }): Promise<void> {
    const [oldH, oldM] = params.oldTime.split(':').map(Number);
    const [newH, newM] = params.newTime.split(':').map(Number);
    const deltaMinutes = newH * 60 + newM - (oldH * 60 + oldM);
    if (deltaMinutes === 0) return;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `
        UPDATE tickets
        SET draw_at = draw_at + make_interval(mins => $5::int)
        WHERE game_id = $1::uuid
          AND draw_at > now()
          AND to_char(draw_at AT TIME ZONE $3, 'HH24:MI') = $2
          AND ($4::int IS NULL OR EXTRACT(DOW FROM draw_at AT TIME ZONE $3) = $4)
        `,
        [
          params.gameId,
          params.oldTime,
          BUSINESS_TZ,
          params.dayOfWeek,
          deltaMinutes,
        ],
      );

      await manager.query(
        `
        UPDATE draw_results
        SET draw_at = draw_at + make_interval(mins => $5::int)
        WHERE game_id = $1::uuid
          AND draw_at > now()
          AND to_char(draw_at AT TIME ZONE $3, 'HH24:MI') = $2
          AND ($4::int IS NULL OR EXTRACT(DOW FROM draw_at AT TIME ZONE $3) = $4)
        `,
        [
          params.gameId,
          params.oldTime,
          BUSINESS_TZ,
          params.dayOfWeek,
          deltaMinutes,
        ],
      );
    });
  }
}
