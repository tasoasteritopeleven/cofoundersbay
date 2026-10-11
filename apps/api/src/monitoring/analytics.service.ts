import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';

export interface AnalyticsMetrics {
  timestamp: Date;
  users: {
    total: number;
    active: number;
    new: number;
    byRole: Record<string, number>;
  };
  engagement: {
    messages: number;
    connections: number;
    events: number;
    groups: number;
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
    cacheHitRate: number;
  };
  business: {
    mentorSessions: number;
    jobPostings: number;
    profileViews: number;
    conversionRate: number;
  };
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface AnalyticsDashboard {
  overview: AnalyticsMetrics;
  trends: {
    users: TimeSeriesData[];
    engagement: TimeSeriesData[];
    performance: TimeSeriesData[];
  };
  alerts: {
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get comprehensive analytics dashboard
   */
  async getAnalyticsDashboard(timeRange = '7d'): Promise<AnalyticsDashboard> {
    const cacheKey = `analytics:dashboard:${timeRange}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const [overview, trends, alerts] = await Promise.all([
        this.getOverviewMetrics(timeRange),
        this.getTrendsData(timeRange),
        this.getActiveAlerts(),
      ]);

      return {
        overview,
        trends,
        alerts,
      };
    }, { ttl: 300, tags: ['analytics:dashboard'] });
  }

  /**
   * Get overview metrics
   */
  private async getOverviewMetrics(timeRange: string): Promise<AnalyticsMetrics> {
    const now = new Date();
    const timeRangeMs = this.parseTimeRange(timeRange);
    const startDate = new Date(now.getTime() - timeRangeMs);

    const [
      totalUsers,
      activeUsers,
      newUsers,
      usersByRole,
      messageCount,
      connectionCount,
      eventCount,
      groupCount,
      mentorSessions,
      jobPostings,
      profileViews,
    ] = await Promise.all([
      this.getTotalUsers(),
      this.getActiveUsers(startDate),
      this.getNewUsers(startDate),
      this.getUsersByRole(),
      this.getMessageCount(startDate),
      this.getConnectionCount(startDate),
      this.getEventCount(startDate),
      this.getGroupCount(startDate),
      this.getMentorSessions(startDate),
      this.getJobPostings(startDate),
      this.getProfileViews(startDate),
    ]);

    const performance = await this.getPerformanceMetrics(startDate);
    const business = {
      mentorSessions,
      jobPostings,
      profileViews,
      conversionRate: this.calculateConversionRate(newUsers, totalUsers),
    };

    return {
      timestamp: now,
      users: {
        total: totalUsers,
        active: activeUsers,
        new: newUsers,
        byRole: usersByRole,
      },
      engagement: {
        messages: messageCount,
        connections: connectionCount,
        events: eventCount,
        groups: groupCount,
      },
      performance,
      business,
    };
  }

  /**
   * Get trends data
   */
  private async getTrendsData(timeRange: string): Promise<{
    users: TimeSeriesData[];
    engagement: TimeSeriesData[];
    performance: TimeSeriesData[];
  }> {
    const timeRangeMs = this.parseTimeRange(timeRange);
    const intervals = this.getTimeIntervals(timeRangeMs);
    
    const [usersTrend, engagementTrend, performanceTrend] = await Promise.all([
      this.getUsersTrend(intervals),
      this.getEngagementTrend(intervals),
      this.getPerformanceTrend(intervals),
    ]);

    return {
      users: usersTrend,
      engagement: engagementTrend,
      performance: performanceTrend,
    };
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(): Promise<AnalyticsDashboard['alerts']> {
    const alerts: AnalyticsDashboard['alerts'] = [];

    // Check for high error rate
    const errorRate = await this.getErrorRate();
    if (errorRate > 0.05) { // 5% error rate threshold
      alerts.push({
        type: 'error',
        message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
        timestamp: new Date(),
      });
    }

    // Check for low cache hit rate
    const cacheHitRate = await this.getCacheHitRate();
    if (cacheHitRate < 0.7) { // 70% hit rate threshold
      alerts.push({
        type: 'warning',
        message: `Low cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`,
        timestamp: new Date(),
      });
    }

    // Check for response time issues
    const avgResponseTime = await this.getAverageResponseTime();
    if (avgResponseTime > 1000) { // 1 second threshold
      alerts.push({
        type: 'warning',
        message: `High average response time: ${avgResponseTime.toFixed(0)}ms`,
        timestamp: new Date(),
      });
    }

    // Check for user activity drop
    const activeUsers = await this.getActiveUsers(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const totalUsers = await this.getTotalUsers();
    const activityRate = activeUsers / totalUsers;
    
    if (activityRate < 0.1) { // 10% daily activity threshold
      alerts.push({
        type: 'info',
        message: `Low user activity: ${(activityRate * 100).toFixed(2)}% daily active users`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Get total users count
   */
  private async getTotalUsers(): Promise<number> {
    const cacheKey = 'analytics:total_users';
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.user.count({
        where: { moderationStatus: 'active' },
      });
    }, { ttl: 3600, tags: ['analytics:users'] });
  }

  /**
   * Get active users count
   */
  private async getActiveUsers(since: Date): Promise<number> {
    const cacheKey = `analytics:active_users:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.user.count({
        where: {
          moderationStatus: 'active',
          lastSeenAt: { gte: since },
        },
      });
    }, { ttl: 1800, tags: ['analytics:users'] });
  }

  /**
   * Get new users count
   */
  private async getNewUsers(since: Date): Promise<number> {
    const cacheKey = `analytics:new_users:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.user.count({
        where: {
          moderationStatus: 'active',
          createdAt: { gte: since },
        },
      });
    }, { ttl: 1800, tags: ['analytics:users'] });
  }

  /**
   * Get users by role breakdown
   */
  private async getUsersByRole(): Promise<Record<string, number>> {
    const cacheKey = 'analytics:users_by_role';
    
    return this.cache.getOrSet(cacheKey, async () => {
      const roleStats = await this.prisma.user.groupBy({
        by: ['role'],
        where: { moderationStatus: 'active' },
        _count: true,
      });

      return roleStats.reduce((acc, stat) => {
        acc[stat.role] = stat._count;
        return acc;
      }, {} as Record<string, number>);
    }, { ttl: 3600, tags: ['analytics:users'] });
  }

  /**
   * Get message count
   */
  private async getMessageCount(since: Date): Promise<number> {
    const cacheKey = `analytics:messages:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.message.count({
        where: { createdAt: { gte: since } },
      });
    }, { ttl: 1800, tags: ['analytics:engagement'] });
  }

  /**
   * Get connection count
   */
  private async getConnectionCount(since: Date): Promise<number> {
    const cacheKey = `analytics:connections:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.connectionRequest.count({
        where: { 
          createdAt: { gte: since },
          status: 'accepted',
        },
      });
    }, { ttl: 1800, tags: ['analytics:engagement'] });
  }

  /**
   * Get event count
   */
  private async getEventCount(since: Date): Promise<number> {
    const cacheKey = `analytics:events:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.event.count({
        where: { createdAt: { gte: since } },
      });
    }, { ttl: 1800, tags: ['analytics:engagement'] });
  }

  /**
   * Get group count
   */
  private async getGroupCount(since: Date): Promise<number> {
    const cacheKey = `analytics:groups:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.group.count({
        where: { createdAt: { gte: since } },
      });
    }, { ttl: 1800, tags: ['analytics:engagement'] });
  }

  /**
   * Get mentor sessions count
   */
  private async getMentorSessions(since: Date): Promise<number> {
    const cacheKey = `analytics:mentor_sessions:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.mentorBooking.count({
        where: { 
          createdAt: { gte: since },
          status: 'confirmed',
        },
      });
    }, { ttl: 1800, tags: ['analytics:business'] });
  }

  /**
   * Get job postings count
   */
  private async getJobPostings(since: Date): Promise<number> {
    const cacheKey = `analytics:job_postings:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      return this.prisma.jobPosting.count({
        where: { 
          createdAt: { gte: since },
          isActive: true,
        },
      });
    }, { ttl: 1800, tags: ['analytics:business'] });
  }

  /**
   * Get profile views count (simulated)
   */
  private async getProfileViews(since: Date): Promise<number> {
    // This would be tracked in a real analytics system
    const cacheKey = `analytics:profile_views:${since.getTime()}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      // Simulate profile views based on user activity
      const activeUsers = await this.getActiveUsers(since);
      return Math.floor(activeUsers * 2.5); // Estimate 2.5 profile views per active user
    }, { ttl: 1800, tags: ['analytics:business'] });
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(since: Date): Promise<AnalyticsMetrics['performance']> {
    const [avgResponseTime, errorRate, uptime, cacheHitRate] = await Promise.all([
      this.getAverageResponseTime(),
      this.getErrorRate(),
      this.getUptime(),
      this.getCacheHitRate(),
    ]);

    return {
      avgResponseTime,
      errorRate,
      uptime,
      cacheHitRate,
    };
  }

  /**
   * Get average response time
   */
  private async getAverageResponseTime(): Promise<number> {
    // This would be calculated from actual request logs
    const cacheKey = 'analytics:avg_response_time';
    
    return this.cache.getOrSet(cacheKey, async () => {
      // Simulate response time based on system load
      return 250 + Math.random() * 100; // 250-350ms
    }, { ttl: 300, tags: ['analytics:performance'] });
  }

  /**
   * Get error rate
   */
  private async getErrorRate(): Promise<number> {
    const cacheKey = 'analytics:error_rate';
    
    return this.cache.getOrSet(cacheKey, async () => {
      // Simulate error rate (should be very low in production)
      return 0.01 + Math.random() * 0.02; // 1-3% error rate
    }, { ttl: 300, tags: ['analytics:performance'] });
  }

  /**
   * Get uptime
   */
  private async getUptime(): Promise<number> {
    const cacheKey = 'analytics:uptime';
    
    return this.cache.getOrSet(cacheKey, async () => {
      // Calculate uptime based on process uptime and known downtime
      const processUptime = process.uptime();
      const totalExpectedUptime = 24 * 60 * 60; // 24 hours in seconds
      return Math.min(processUptime / totalExpectedUptime, 1);
    }, { ttl: 300, tags: ['analytics:performance'] });
  }

  /**
   * Get cache hit rate
   */
  private async getCacheHitRate(): Promise<number> {
    const cacheKey = 'analytics:cache_hit_rate';
    
    return this.cache.getOrSet(cacheKey, async () => {
      // This would be calculated from actual cache metrics
      return 0.85 + Math.random() * 0.1; // 85-95% hit rate
    }, { ttl: 300, tags: ['analytics:performance'] });
  }

  /**
   * Get users trend data
   */
  private async getUsersTrend(intervals: Date[]): Promise<TimeSeriesData[]> {
    const trendData: TimeSeriesData[] = [];

    for (const interval of intervals) {
      const nextInterval = new Date(interval.getTime() + this.parseTimeRange('1h'));
      
      const [total, active, newUsers] = await Promise.all([
        this.prisma.user.count({
          where: { 
            moderationStatus: 'active',
            createdAt: { lt: nextInterval },
          },
        }),
        this.prisma.user.count({
          where: {
            moderationStatus: 'active',
            lastSeenAt: { 
              gte: interval,
              lt: nextInterval,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            moderationStatus: 'active',
            createdAt: { 
              gte: interval,
              lt: nextInterval,
            },
          },
        }),
      ]);

      trendData.push({
        timestamp: interval,
        value: total,
        label: `Total: ${total}, Active: ${active}, New: ${newUsers}`,
      });
    }

    return trendData;
  }

  /**
   * Get engagement trend data
   */
  private async getEngagementTrend(intervals: Date[]): Promise<TimeSeriesData[]> {
    const trendData: TimeSeriesData[] = [];

    for (const interval of intervals) {
      const nextInterval = new Date(interval.getTime() + this.parseTimeRange('1h'));
      
      const [messages, connections, events] = await Promise.all([
        this.prisma.message.count({
          where: {
            createdAt: { 
              gte: interval,
              lt: nextInterval,
            },
          },
        }),
        this.prisma.connectionRequest.count({
          where: {
            createdAt: { 
              gte: interval,
              lt: nextInterval,
            },
            status: 'accepted',
          },
        }),
        this.prisma.event.count({
          where: {
            createdAt: { 
              gte: interval,
              lt: nextInterval,
            },
          },
        }),
      ]);

      const totalEngagement = messages + connections + events;
      
      trendData.push({
        timestamp: interval,
        value: totalEngagement,
        label: `Messages: ${messages}, Connections: ${connections}, Events: ${events}`,
      });
    }

    return trendData;
  }

  /**
   * Get performance trend data
   */
  private async getPerformanceTrend(intervals: Date[]): Promise<TimeSeriesData[]> {
    const trendData: TimeSeriesData[] = [];

    for (const interval of intervals) {
      // Simulate performance metrics for each interval
      const responseTime = 200 + Math.random() * 150;
      const errorRate = 0.01 + Math.random() * 0.02;
      const performanceScore = Math.max(0, 100 - (responseTime / 10) - (errorRate * 1000));
      
      trendData.push({
        timestamp: interval,
        value: performanceScore,
        label: `Response: ${responseTime.toFixed(0)}ms, Error Rate: ${(errorRate * 100).toFixed(2)}%`,
      });
    }

    return trendData;
  }

  /**
   * Calculate conversion rate
   */
  private calculateConversionRate(newUsers: number, totalUsers: number): number {
    if (totalUsers === 0) return 0;
    return newUsers / totalUsers;
  }

  /**
   * Parse time range string to milliseconds
   */
  private parseTimeRange(timeRange: string): number {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
    }
  }

  /**
   * Get time intervals for trend data
   */
  private getTimeIntervals(timeRangeMs: number): Date[] {
    const intervals: Date[] = [];
    const now = new Date();
    const intervalMs = Math.max(timeRangeMs / 24, this.parseTimeRange('1h')); // Max 24 intervals, min 1 hour
    
    for (let i = 23; i >= 0; i--) {
      intervals.push(new Date(now.getTime() - i * intervalMs));
    }
    
    return intervals;
  }

  /**
   * Track custom event
   */
  async trackEvent(event: {
    type: string;
    userId?: string;
    metadata?: Record<string, any>;
    value?: number;
  }): Promise<void> {
    // This would store events in a dedicated analytics table
    this.logger.log(`Analytics event: ${event.type}`, event);
    
    // Invalidate relevant caches
    await this.cache.invalidateByTag('analytics:dashboard');
  }

  /**
   * Get user-specific analytics
   */
  async getUserAnalytics(userId: string): Promise<{
    profile: {
      views: number;
      connections: number;
      messages: number;
    };
    engagement: {
      eventsAttended: number;
      groupsJoined: number;
      mentorSessions: number;
    };
    activity: {
      lastLogin: Date;
      weeklyActivity: number;
      monthlyActivity: number;
    };
  }> {
    const cacheKey = `analytics:user:${userId}`;
    
    return this.cache.getOrSet(cacheKey, async () => {
      const [
        connections,
        messages,
        eventsAttended,
        groupsJoined,
        mentorSessions,
        user,
      ] = await Promise.all([
        this.prisma.connectionRequest.count({
          where: {
            OR: [
              { requesterId: userId },
              { receiverId: userId },
            ],
            status: 'accepted',
          },
        }),
        this.prisma.message.count({
          where: { senderId: userId },
        }),
        this.prisma.eventRsvp.count({
          where: { 
            userId,
            status: 'going',
          },
        }),
        this.prisma.groupMember.count({
          where: { userId },
        }),
        this.prisma.mentorBooking.count({
          where: { 
            menteeId: userId,
            status: 'confirmed',
          },
        }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { lastSeenAt: true, createdAt: true },
        }),
      ]);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [weeklyActivity, monthlyActivity] = await Promise.all([
        this.prisma.message.count({
          where: {
            senderId: userId,
            createdAt: { gte: weekAgo },
          },
        }),
        this.prisma.message.count({
          where: {
            senderId: userId,
            createdAt: { gte: monthAgo },
          },
        }),
      ]);

      return {
        profile: {
          views: Math.floor(Math.random() * 100) + 10, // Simulated
          connections,
          messages,
        },
        engagement: {
          eventsAttended,
          groupsJoined,
          mentorSessions,
        },
        activity: {
          lastLogin: user?.lastSeenAt || new Date(),
          weeklyActivity,
          monthlyActivity,
        },
      };
    }, { ttl: 1800, tags: [`analytics:user:${userId}`] });
  }
}
