import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { MeilisearchService } from '../search/meilisearch.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly meili: MeilisearchService,
  ) {}

  @Get()
  async health() {
    const services: Record<string, 'up' | 'down' | 'disabled'> = {
      db: 'down',
      redis: this.config.get<string>('REDIS_URL') ? 'down' : 'disabled',
      meilisearch: this.meili.isEnabled() ? 'down' : 'disabled',
    };

    await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => {
        services.db = 'up';
      })
      .catch(() => {
        services.db = 'down';
      });

    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      const redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
      });
      await redis
        .connect()
        .then(() => redis.ping())
        .then(() => {
          services.redis = 'up';
        })
        .catch(() => {
          services.redis = 'down';
        })
        .finally(() => redis.quit().catch(() => {}));
    }

    if (this.meili.isEnabled()) {
      const client = this.meili.getClient();
      if (client) {
        await client
          .health()
          .then(() => {
            services.meilisearch = 'up';
          })
          .catch(() => {
            services.meilisearch = 'down';
          });
      }
    }

    const ok =
      services.db === 'up' &&
      (services.redis === 'disabled' || services.redis === 'up') &&
      (services.meilisearch === 'disabled' || services.meilisearch === 'up');

    return { ok, services, timestamp: new Date().toISOString() };
  }

  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'not_ready', reason: 'database_unavailable', timestamp: new Date().toISOString() };
    }
  }
}

