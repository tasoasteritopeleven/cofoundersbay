import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const DB_CONNECT_RETRIES = 5;
const DB_CONNECT_DELAY_MS = 2_000;
const isDev = process.env.NODE_ENV !== 'production';
const SLOW_QUERY_WARN_MS = 50;
const SLOW_QUERY_SEVERE_MS = 100;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /** Per-request query metrics — set/read by the PerformanceInterceptor */
  private _reqQueryCount = 0;
  private _reqDbTimeMs = 0;

  get reqQueryCount() { return this._reqQueryCount; }
  get reqDbTimeMs() { return this._reqDbTimeMs; }
  resetReqMetrics() { this._reqQueryCount = 0; this._reqDbTimeMs = 0; }

  constructor() {
    super({
      log: isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });

    if (isDev) {
      (this.$on as any)('query', (e: Prisma.QueryEvent) => {
        // Accumulate per-request metrics
        this._reqQueryCount++;
        this._reqDbTimeMs += e.duration;

        // Two-tier slow query logging
        if (e.duration >= SLOW_QUERY_SEVERE_MS) {
          this.logger.error(
            `[SEVERE] Slow query (${e.duration}ms): ${e.query.substring(0, 300)}` +
              (e.params ? ` | params: ${e.params.substring(0, 100)}` : ''),
          );
        } else if (e.duration >= SLOW_QUERY_WARN_MS) {
          this.logger.warn(
            `[WARN] Slow query (${e.duration}ms): ${e.query.substring(0, 300)}` +
              (e.params ? ` | params: ${e.params.substring(0, 100)}` : ''),
          );
        }
      });
    }
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Database connected on attempt ${attempt}.`);
        }
        return;
      } catch (err) {
        const isLast = attempt === DB_CONNECT_RETRIES;
        this.logger.warn(
          `Database connection attempt ${attempt}/${DB_CONNECT_RETRIES} failed: ${err instanceof Error ? err.message : String(err)}` +
          (isLast ? ' — giving up.' : ` — retrying in ${DB_CONNECT_DELAY_MS / 1000}s...`),
        );
        if (isLast) throw err;
        await new Promise((r) => setTimeout(r, DB_CONNECT_DELAY_MS));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
