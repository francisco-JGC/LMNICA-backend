import { Inject, Injectable, Logger } from '@nestjs/common';

import { LuckyDaily } from '../../domain/entities/lucky-daily.entity';
import {
  LUCKY_DAILIES_REPOSITORY,
  type LuckyDailiesRepository,
} from '../../domain/repositories/lucky-dailies.repository';
import { LuckyKind } from '../../domain/value-objects/lucky-kind';
import { CrossGenerator } from '../services/cross-generator.service';

@Injectable()
export class EnsureTodayLucky {
  private readonly logger = new Logger(EnsureTodayLucky.name);

  constructor(
    @Inject(LUCKY_DAILIES_REPOSITORY)
    private readonly repo: LuckyDailiesRepository,
    private readonly crossGen: CrossGenerator,
  ) {}

  async execute(now: Date = new Date()): Promise<void> {
    const today = this.startOfDay(now);
    await this.ensure(LuckyKind.CROSS, today);
  }

  private async ensure(kind: LuckyKind, forDate: Date): Promise<void> {
    const existing = await this.repo.findForDate(kind, forDate);
    if (existing) return;
    const payload = this.crossGen.generate();
    const entry = LuckyDaily.create({ kind, forDate, payload });
    await this.repo.save(entry);
    this.logger.log(`Generated ${kind} for ${forDate.toDateString()}`);
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
}
