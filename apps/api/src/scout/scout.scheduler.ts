import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ScoutService } from './scout.service';

const HOUR_MS = 60 * 60 * 1000;

/** Hourly check for briefs whose daily pass is due (`ScoutService.runDue`). Off in tests and with SCOUT_RUNS=off. */
@Injectable()
export class ScoutScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ScoutScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly scout: ScoutService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || process.env.SCOUT_RUNS === 'off') return;
    this.timer = setInterval(() => void this.tick(), HOUR_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    try {
      const { checked, notified } = await this.scout.runDue();
      if (checked) this.logger.log(`Scout: ${checked} briefs run, ${notified} founders told of new proposals`);
    } catch (err) {
      this.logger.error(`Scout pass failed: ${String(err)}`);
    }
  }
}
