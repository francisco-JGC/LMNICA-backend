import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  fromBusinessWallClock,
  toBusinessWallClock,
} from '../../../../shared/domain/business-time';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors/domain.error';
import type { DrawSchedule } from '../../domain/entities/draw-schedule.entity';
import {
  DRAW_SCHEDULES_REPOSITORY,
  type DrawSchedulesRepository,
} from '../../domain/repositories/draw-schedules.repository';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../domain/repositories/games.repository';

export interface ResolveNextDrawInput {
  gameId: string;
  at: Date;
}

export interface ResolveNextDrawOutput {
  drawAt: Date;
  cutoffMinutes: number;
}

const LOOK_AHEAD_DAYS = 7;

@Injectable()
export class ResolveNextDraw
  implements UseCase<ResolveNextDrawInput, ResolveNextDrawOutput>
{
  constructor(
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(DRAW_SCHEDULES_REPOSITORY)
    private readonly schedules: DrawSchedulesRepository,
  ) {}

  async execute(input: ResolveNextDrawInput): Promise<ResolveNextDrawOutput> {
    const game = await this.games.findById(input.gameId);
    if (!game) throw new NotFoundError('Game', input.gameId);

    const all = await this.schedules.findByGameId(input.gameId);
    const active = all.filter((s) => s.isActive);
    if (active.length === 0) {
      throw new ValidationError(
        `Game "${game.slug}" has no active draw schedules`,
      );
    }

    // Anchor everything to the BUSINESS_TZ wall clock so the DOW / cutoff /
    // draw instant we return are consistent regardless of process timezone.
    const nowWall = toBusinessWallClock(input.at);
    const nowMinutes = nowWall.hour * 60 + nowWall.minute;

    for (let offset = 0; offset <= LOOK_AHEAD_DAYS; offset++) {
      // Land at noon-ish so we can safely observe the target date's DOW in
      // BUSINESS_TZ without any DST edge cases at midnight.
      const anchor = fromBusinessWallClock(
        nowWall.year,
        nowWall.month,
        nowWall.day + offset,
        12,
        0,
      );
      const dayWall = toBusinessWallClock(anchor);
      const candidates = this.candidatesFor(active, dayWall.dayOfWeek);
      if (candidates.length === 0) continue;

      for (const schedule of candidates) {
        const drawMinutes = schedule.toMinutes();
        const cutoffThreshold = drawMinutes - schedule.cutoffMinutes;
        // `<=` (no `<`): granularidad minuto. Un vendedor que ve su reloj
        // marcando 20:58 (con sorteo a las 21:00 y cutoff de 2 min) espera
        // caer en ese sorteo — la comparación en minutos igualaba 1258 con
        // 1258 y con `<` estricto saltaba al día siguiente. Con `<=`, todo
        // el minuto del cutoff (20:58:00 a 20:58:59) sigue siendo válido y
        // recién al empezar 20:59 se salta al próximo sorteo. Semántica:
        // "cutoff N min" = "se puede vender durante el minuto en que faltan
        // N min al sorteo; corte al empezar el minuto siguiente".
        const passesCutoff = offset > 0 || nowMinutes <= cutoffThreshold;
        if (!passesCutoff) continue;

        const [h, m] = schedule.drawTime.split(':').map(Number);
        const drawAt = fromBusinessWallClock(
          dayWall.year,
          dayWall.month,
          dayWall.day,
          h,
          m,
        );
        return { drawAt, cutoffMinutes: schedule.cutoffMinutes };
      }
    }

    throw new ValidationError(
      `No upcoming draw found for game "${game.slug}"`,
    );
  }

  private candidatesFor(
    schedules: DrawSchedule[],
    dayOfWeek: number,
  ): DrawSchedule[] {
    return schedules
      .filter((s) => s.appliesTo(dayOfWeek))
      .sort((a, b) => a.toMinutes() - b.toMinutes());
  }
}
