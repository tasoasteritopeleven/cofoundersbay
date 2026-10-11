import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AnalyticsOverview,
  AnalyticsService,
  UserMetrics,
  ProfileView,
  EngagementData,
  TopContent,
  Achievement,
  WeeklySummary,
} from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  async getOverview(
    @CurrentUser() user: { id: string },
    @Query('period') period?: string,
    @Query('topContentLimit') topContentLimit?: string,
  ): Promise<AnalyticsOverview> {
    return this.analytics.getOverview(
      user.id,
      period || '7d',
      Number(topContentLimit ?? '5'),
    );
  }

  @Get('metrics')
  async getMetrics(
    @CurrentUser() user: { id: string },
    @Query('period') period?: string,
  ): Promise<UserMetrics> {
    return this.analytics.getUserMetrics(user.id, period || '7d');
  }

  @Get('profile-views')
  async getProfileViews(
    @CurrentUser() user: { id: string },
    @Query('period') period?: string,
  ): Promise<ProfileView[]> {
    return this.analytics.getProfileViews(user.id, period || '7d');
  }

  @Get('engagement')
  async getEngagement(
    @CurrentUser() user: { id: string },
    @Query('period') period?: string,
  ): Promise<EngagementData> {
    return this.analytics.getEngagementData(user.id, period || '7d');
  }

  @Get('top-content')
  async getTopContent(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
  ): Promise<TopContent[] | null> {
    return this.analytics.getTopContent(user.id, Number(limit ?? '10'));
  }

  @Get('achievements')
  async getAchievements(@CurrentUser() user: { id: string }): Promise<Achievement[]> {
    return this.analytics.getUserAchievements(user.id);
  }

  @Get('weekly-summary')
  async getWeeklySummary(@CurrentUser() user: { id: string }): Promise<WeeklySummary> {
    return this.analytics.getWeeklySummary(user.id);
  }

  @Get('growth-trends')
  async getGrowthTrends(
    @CurrentUser() user: { id: string },
    @Query('period') period?: string,
  ) {
    return this.analytics.getGrowthTrends(user.id, period || '30d');
  }
}
