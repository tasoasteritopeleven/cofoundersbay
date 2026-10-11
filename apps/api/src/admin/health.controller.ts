import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: { status: 'up' | 'down'; latency?: number };
    memory: { used: number; total: number; percentage: number };
  };
  version: string;
}

@Controller('admin/health')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    const dbStatus = await this.checkDatabase();
    const memoryUsage = process.memoryUsage();

    const memoryPercentage = Math.round(
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    );

    const overallStatus: HealthStatus['status'] =
      dbStatus.status === 'down'
        ? 'unhealthy'
        : memoryPercentage > 90
          ? 'degraded'
          : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        database: dbStatus,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: memoryPercentage,
        },
      },
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  private async checkDatabase(): Promise<{ status: 'up' | 'down'; latency?: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latency: Date.now() - start };
    } catch {
      return { status: 'down' };
    }
  }
}
