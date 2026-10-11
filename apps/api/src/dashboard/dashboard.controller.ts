import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.dashboard.getStats();
  }

  @Get('dashboard/me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: { id: string }) {
    return this.dashboard.getUserSummary(user.id);
  }

  @Get('dashboard/venture-readiness')
  @UseGuards(JwtAuthGuard)
  async getVentureReadiness(@CurrentUser() user: { id: string }) {
    return this.dashboard.computeVentureReadiness(user.id);
  }

  @Get('dashboard/activity')
  @UseGuards(JwtAuthGuard)
  async getActivity(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit  = Math.min(Math.max(parseInt(limit  ?? '20', 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset ?? '0', 10) || 0, 0);
    return this.dashboard.getActivity(parsedLimit, parsedOffset);
  }
}
