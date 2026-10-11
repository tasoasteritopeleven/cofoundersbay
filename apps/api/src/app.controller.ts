import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './common/cache/cache.service';

@Controller()
export class AppController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  getRoot() {
    const apiPrefix = this.configService.get('app.apiPrefix', 'api');
    return {
      name: 'CoFounderBay API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        api: `/${apiPrefix}`,
        health: `/${apiPrefix}/health`,
        docs: `/${apiPrefix}/docs`,
      },
      message: `API is running. Access endpoints at /${apiPrefix}/*`,
    };
  }

  @Get('health')
  async getHealth() {
    const [dbOk, redisOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.cache.isHealthy(),
    ]);

    const status = dbOk ? 'ok' : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbOk ? 'up' : 'down',
        cache: redisOk ? 'up' : 'down',
      },
    };
  }
}
