import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SavedSearchesService } from './saved-searches.service';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Hourly pass over saved searches with alerts on. Each search decides from
 * its own frequency whether it is due (`alertIsDue`), so `instant` means
 * within the hour and `daily`/`weekly` wait out their interval.
 */
@Injectable()
export class SavedSearchesScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SavedSearchesScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly savedSearches: SavedSearchesService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || process.env.SAVED_SEARCH_ALERTS === 'off') return;
    this.timer = setInterval(() => void this.tick(), HOUR_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    try {
      const { checked, notified } = await this.savedSearches.runDueAlerts();
      if (checked) this.logger.log(`Saved-search alerts: ${checked} checked, ${notified} notified`);
    } catch (err) {
      this.logger.error(`Saved-search alerts failed: ${String(err)}`);
    }
  }
}
