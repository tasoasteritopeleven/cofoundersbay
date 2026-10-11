import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { HealthCheckResponse } from '@cofounderbay/shared';

@Controller('health')
export class EnhancedHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getHealth(): Promise<HealthCheckResponse> {
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
      database: dbResult.status === 'fulfilled' ? 'healthy' as const : 'unhealthy' as const,
      redis: redisResult.status === 'fulfilled' ? 'healthy' as const : 'unhealthy' as const,
      search: searchResult.status === 'fulfilled' ? 'healthy' as const : 'unhealthy' as const,
      storage: storageResult.status === 'fulfilled' ? 'healthy' as const : 'unhealthy' as const,
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

  @Get('detailed')
  async getDetailedHealth() {
    const startTime = Date.now();
    
    const checks = await Promise.allSettled([
      this.checkDatabase(true),
      this.checkRedis(true),
      this.checkSearch(true),
      this.checkStorage(true),
    ]);

    const [dbCheck, redisCheck, searchCheck, storageCheck] = checks;
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: this.configService.get('app.nodeEnv'),
      responseTime: Date.now() - startTime,
      checks: {
        database: this.formatCheckResult(dbCheck),
        redis: this.formatCheckResult(redisCheck),
        search: this.formatCheckResult(searchCheck),
        storage: this.formatCheckResult(storageCheck),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      config: {
        database: this.configService.get('app.database.url') ? 'configured' : 'not configured',
        redis: this.configService.get('app.redis.host') ? 'configured' : 'not configured',
        search: this.configService.get('app.search.host') ? 'configured' : 'not configured',
      },
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

  private async checkDatabase(detailed = false) {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      if (detailed) {
        const stats = await this.prisma.$queryRaw`
          SELECT 
            count(*) as total_users,
            count(CASE WHEN "createdAt" > NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_today,
            count(CASE WHEN "lastSeenAt" > NOW() - INTERVAL '1 hour' THEN 1 END) as active_users_last_hour
          FROM "User"
        `;
        
        return {
          status: 'healthy',
          responseTime,
          stats: (stats as any[])[0],
        };
      }

      return { status: 'healthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(detailed = false) {
    try {
      const start = Date.now();
      const isHealthy = await this.cache.isHealthy();
      const responseTime = Date.now() - start;

      if (detailed && isHealthy) {
        const info = await this.cache.getInfo();
        return {
          status: 'healthy',
          responseTime,
          info: info ? this.parseRedisInfo(info) : null,
        };
      }

      return { status: isHealthy ? 'healthy' : 'unhealthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkSearch(detailed = false) {
    try {
      const start = Date.now();
      const searchConfig = this.configService.get('app.search');
      
      // Basic connectivity check (would use Meilisearch client in real implementation)
      const responseTime = Date.now() - start;
      
      if (detailed) {
        return {
          status: 'healthy',
          responseTime,
          config: {
            host: searchConfig.host,
            port: searchConfig.port,
            configured: !!searchConfig.host,
          },
        };
      }

      return { status: 'healthy', responseTime };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkStorage(detailed = false) {
    try {
      const start = Date.now();
      const storageConfig = this.configService.get('app.storage');
      
      // Basic storage check (would test actual storage in real implementation)
      const responseTime = Date.now() - start;
      
      if (detailed) {
        return {
          status: 'healthy',
          responseTime,
          config: {
            provider: storageConfig.provider,
            bucket: storageConfig.bucket,
            configured: !!storageConfig.provider,
          },
        };
      }

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
      cpuUsage: Math.round((process.cpuUsage().user + process.cpuUsage().system) / 1000), // ms
      activeConnections: 0, // Would be tracked in real implementation
    };
  }

  private formatCheckResult(result: PromiseSettledResult<any>) {
    if (result.status === 'fulfilled') {
      return {
        status: 'healthy',
        data: result.value,
      };
    } else {
      return {
        status: 'unhealthy',
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    }
  }

  private parseRedisInfo(info: string) {
    const lines = info.split('\r\n');
    const parsed: Record<string, string> = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key.trim()] = value.trim();
      }
    }
    
    return parsed;
  }
}
