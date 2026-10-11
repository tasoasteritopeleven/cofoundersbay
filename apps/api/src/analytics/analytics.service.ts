import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserMetrics {
  profileViews: number;
  profileViewsChange: number | null;
  newConnections: number;
  newConnectionsChange: number | null;
  messagesSent: number;
  messagesSentChange: number | null;
  engagementRate: number | null;
  engagementRateChange: number | null;
  searchAppearances: number | null;
  searchAppearancesChange: number | null;
  activityScore: number | null;
  activityScoreChange: number | null;
}

export interface ProfileView {
  date: string;
  views: number;
  uniqueVisitors: number | null;
}

export interface EngagementData {
  connections: number;
  messages: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export interface TopContent {
  id: string;
  type: 'post' | 'comment' | 'profile';
  title: string;
  views: number;
  engagement: number;
  date: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean | null;
  unlockedAt?: Date;
}

export interface WeeklySummary {
  mostActiveDay: string | null;
  peakHour: string | null;
  avgResponseTime: string | null;
  totalInteractions: number | null;
}

export interface AnalyticsOverview {
  metrics: UserMetrics;
  profileViews: ProfileView[];
  engagement: EngagementData;
  topContent: TopContent[] | null;
  weeklySummary: WeeklySummary;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(
    userId: string,
    period: string,
    topContentLimit = 5,
  ): Promise<AnalyticsOverview> {
    this.parsePeriod(period);
    this.validateLimit(topContentLimit);
    const asOf = new Date();
    const [metrics, profileViews, engagement, topContent, weeklySummary] =
      await Promise.all([
        this.getUserMetrics(userId, period, asOf),
        this.getProfileViews(userId, period, asOf),
        this.getEngagementData(userId, period, asOf),
        this.getTopContent(userId, topContentLimit),
        this.getWeeklySummary(userId),
      ]);

    return {
      metrics,
      profileViews,
      engagement,
      topContent,
      weeklySummary,
    };
  }

  async getUserMetrics(userId: string, period: string, asOf = new Date()): Promise<UserMetrics> {
    const { startDate, endDate, previousStartDate } = this.periodWindow(period, asOf);

    // Profile Views
    const profileViews = await this.getProfileViewsCount(userId, startDate, endDate);
    const previousProfileViews = await this.getProfileViewsCount(
      userId,
      previousStartDate,
      startDate,
    );
    const profileViewsChange = this.calculateChange(profileViews, previousProfileViews);

    // New Connections (placeholder - would need Connection model)
    const newConnections = await this.getConnectionsCount(userId, startDate, endDate);
    const previousNewConnections = await this.getConnectionsCount(userId, previousStartDate, startDate);
    const newConnectionsChange = this.calculateChange(newConnections, previousNewConnections);

    // Messages Sent
    const messagesSent = await this.prisma.message.count({
      where: { senderId: userId, createdAt: { gte: startDate, lt: endDate } },
    });
    const previousMessagesSent = await this.prisma.message.count({
      where: { senderId: userId, createdAt: { gte: previousStartDate, lt: startDate } },
    });
    const messagesSentChange = this.calculateChange(messagesSent, previousMessagesSent);

    // Engagement Rate (placeholder - would need activity tracking)
    const engagementRate = null;
    const engagementRateChange = null;

    // Search Appearances (placeholder - would need search tracking)
    const searchAppearances = null;
    const searchAppearancesChange = null;

    // Activity Score (calculated from various metrics)
    const activityScore = this.calculateActivityScore(profileViews, newConnections, messagesSent);
    const previousActivityScore = this.calculateActivityScore(previousProfileViews, previousNewConnections, previousMessagesSent);
    const activityScoreChange = this.calculateChange(activityScore, previousActivityScore);

    return {
      profileViews,
      profileViewsChange,
      newConnections,
      newConnectionsChange,
      messagesSent,
      messagesSentChange,
      engagementRate,
      engagementRateChange,
      searchAppearances,
      searchAppearancesChange,
      activityScore,
      activityScoreChange,
    };
  }

  async getProfileViews(userId: string, period: string, asOf = new Date()): Promise<ProfileView[]> {
    const { startDate, endDate } = this.periodWindow(period, asOf);
    const records = await this.prisma.profileView.findMany({
      where: { profile: { userId }, createdAt: { gte: startDate, lt: endDate } },
      select: { createdAt: true, viewerId: true },
    });
    const buckets = new Map(this.dateBuckets(startDate, endDate).map((date) => [
      date, { views: 0, visitors: new Set<string>(), hasAnonymous: false },
    ]));
    for (const record of records) {
      const bucket = buckets.get(record.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      bucket.views++;
      if (record.viewerId === null) bucket.hasAnonymous = true;
      else bucket.visitors.add(record.viewerId);
    }

    const views: ProfileView[] = [];
    for (const [date, bucket] of buckets) {
      // This would need a ProfileView tracking table in production
      // For now, returning demo data structure
      views.push({
        date,
        views: bucket.views,
        uniqueVisitors: bucket.hasAnonymous ? null : bucket.visitors.size,
      });
    }
    return views;
  }

  async getEngagementData(
    userId: string,
    period: string,
    asOf = new Date(),
  ): Promise<EngagementData> {
    const { startDate, endDate } = this.periodWindow(period, asOf);

    // Connections would need Connection model in production
    const connections = await this.getConnectionsCount(userId, startDate, endDate);
    const messages = await this.prisma.message.count({
      where: { senderId: userId, createdAt: { gte: startDate, lt: endDate } },
    });

    // Likes, comments, shares would need activity/post tracking tables
    const likes = null;
    const comments = null;
    const shares = null;

    return { connections, messages, likes, comments, shares };
  }

  async getTopContent(userId: string, limit: number): Promise<TopContent[] | null> {
    this.validateLimit(limit);
    // This would need a content tracking system in production
    // Returning demo data structure
    return null;
  }

  async getUserAchievements(userId: string): Promise<Achievement[]> {
    // Connection count would need Connection model in production
    const connectionCount = await this.prisma.connectionRequest.count({
      where: this.connectionScope(userId),
    });
    const profileViews = await this.prisma.profileView.count({
      where: { profile: { userId } },
    });

    const achievements: Achievement[] = [
      {
        id: 'early-adopter',
        title: 'Early Adopter',
        description: 'Joined in the first month',
        icon: 'award',
        unlocked: null,
      },
      {
        id: 'networker',
        title: 'Networker',
        description: 'Currently connected with 50+ members',
        icon: 'users',
        unlocked: connectionCount >= 50,
      },
      {
        id: 'active-contributor',
        title: 'Active Contributor',
        description: 'Posted 100+ times',
        icon: 'message-circle',
        unlocked: null,
      },
      {
        id: 'influencer',
        title: 'Influencer',
        description: '1000+ recorded profile views',
        icon: 'eye',
        unlocked: profileViews >= 1000,
      },
    ];

    return achievements;
  }

  async getWeeklySummary(userId: string): Promise<WeeklySummary> {
    // This would need detailed activity tracking in production
    return {
      mostActiveDay: null,
      peakHour: null,
      avgResponseTime: null,
      totalInteractions: null,
    };
  }

  async getGrowthTrends(userId: string, period: string) {
    const asOf = new Date();
    const { startDate, endDate } = this.periodWindow(period, asOf);
    const [views, connections] = await Promise.all([
      this.getProfileViews(userId, period, asOf),
      this.prisma.connectionRequest.findMany({
        where: { ...this.connectionScope(userId), respondedAt: { gte: startDate, lt: endDate } },
        select: { respondedAt: true },
      }),
    ]);
    const byDay = new Map<string, number>();
    for (const connection of connections) {
      if (!connection.respondedAt) continue;
      const date = connection.respondedAt.toISOString().slice(0, 10);
      byDay.set(date, (byDay.get(date) ?? 0) + 1);
    }
    return views.map((view) => ({
      date: view.date,
      connections: byDay.get(view.date) ?? 0,
      profileViews: view.views,
      engagement: null,
    }));
  }

  private async getProfileViewsCount(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // This would query a ProfileView tracking table in production
    // For now, returning a placeholder
    return this.prisma.profileView.count({
      where: { profile: { userId }, createdAt: { gte: startDate, lt: endDate } },
    });
  }

  private connectionScope(userId: string) {
    return { status: 'accepted' as const, OR: [{ requesterId: userId }, { receiverId: userId }] };
  }

  private getConnectionsCount(userId: string, startDate: Date, endDate: Date) {
    return this.prisma.connectionRequest.count({
      where: { ...this.connectionScope(userId), respondedAt: { gte: startDate, lt: endDate } },
    });
  }

  private calculateChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? null : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private calculateActivityScore(views: number, connections: number, messages: number): number {
    // Weighted activity score calculation
    const viewsScore = Math.min((views / 1000) * 30, 30);
    const connectionsScore = Math.min((connections / 50) * 40, 40);
    const messagesScore = Math.min((messages / 100) * 30, 30);
    return Math.round(viewsScore + connectionsScore + messagesScore);
  }

  private periodWindow(period: string, endDate: Date) {
    const duration = this.parsePeriod(period) * DAY_MS;
    return {
      startDate: new Date(endDate.getTime() - duration),
      endDate,
      previousStartDate: new Date(endDate.getTime() - 2 * duration),
    };
  }

  private dateBuckets(startDate: Date, endDate: Date): string[] {
    const dates: string[] = [];
    const day = new Date(startDate);
    day.setUTCHours(0, 0, 0, 0);
    while (day < endDate) {
      dates.push(day.toISOString().slice(0, 10));
      day.setUTCDate(day.getUTCDate() + 1);
    }
    return dates;
  }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('Content limit must be an integer between 1 and 50');
    }
  }

  private parsePeriod(period: string): number {
    const match = typeof period === 'string' ? period.match(/^(\d{1,3})([dwmy])$/) : null;
    const multipliers: Record<string, number> = { d: 1, w: 7, m: 30, y: 365 };
    const days = match ? Number(match[1]) * multipliers[match[2]] : NaN;
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new BadRequestException('Period must be between 1 and 365 days (d, w, m or y)');
    }
    return days;
  }
}
