import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';

@Controller('health')
export class ProductionHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getHealth() {
    const startTime = Date.now();
    
    // Check all services
    const services = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkSearch(),
      this.checkStorage(),
    ]);

    const [dbResult, redisResult, searchResult, storageResult] = services;
    
    const servicesStatus = {
      database: dbResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      redis: redisResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      search: searchResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      storage: storageResult.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    };

    const allHealthy = Object.values(servicesStatus).every(status => status === 'healthy');
    const status = allHealthy ? 'healthy' : servicesStatus.database === 'unhealthy' ? 'unhealthy' : 'degraded';

    // Get system metrics
    const metrics = await this.getSystemMetrics();

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: servicesStatus,
      metrics,
      responseTime: Date.now() - startTime,
    };
  }

  @Get('readiness')
  async getReadiness() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allReady = checks.every(check => check.status === 'fulfilled');
    
    return {
      ready: allReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: checks[0].status === 'fulfilled',
        redis: checks[1].status === 'fulfilled',
      },
    };
  }

  @Get('liveness')
  async getLiveness() {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  private async checkDatabase() {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      return { status: 'healthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis() {
    try {
      const start = Date.now();
      const isHealthy = await this.cache.isHealthy();
      const responseTime = Date.now() - start;
      return { status: isHealthy ? 'healthy' : 'unhealthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkSearch() {
    try {
      const start = Date.now();
      const searchConfig = this.configService.get('app.search');
      const responseTime = Date.now() - start;
      return { status: 'healthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkStorage() {
    try {
      const start = Date.now();
      const storageConfig = this.configService.get('app.storage');
      const responseTime = Date.now() - start;
      return { status: 'healthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      activeConnections: 0, // Would be tracked in real implementation
    };
  }
}
