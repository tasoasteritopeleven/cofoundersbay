import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { EventReconnectService } from './event-reconnect.service';

@Injectable()
export class EventReconnectScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(EventReconnectScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly reconnect: EventReconnectService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconnect.purgeExpired();
      await this.reconnect.nudgeEligible();
    } catch (error) {
      this.logger.error(`Event reconnect maintenance failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
