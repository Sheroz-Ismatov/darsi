import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { ScheduleService } from './schedule.service';

/**
 * Daily `lessons.extend-horizon` (ARCHITECTURE.md §3.9). Runs inside the API process until the
 * queues of T-38 exist; a repeated run is harmless thanks to the unique (group, start) index.
 */
@Injectable()
export class HorizonJob {
  constructor(
    private readonly schedule: ScheduleService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Cron('0 2 * * *', { name: 'lessons.extend-horizon', timeZone: 'UTC' })
  async run(): Promise<void> {
    if (!this.env.JOBS_ENABLED) return;
    await this.schedule.extendHorizon();
  }
}
