import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ProfileViewSource = 'direct' | 'search' | 'recommendation' | 'group' | 'event' | 'external';

@Injectable()
export class ProfileViewService {
  constructor(private readonly prisma: PrismaService) {}

  async trackView(
    profileId: string,
    viewerId: string | null,
    source: ProfileViewSource = 'direct',
    referrer?: string,
  ): Promise<void> {
    // Don't track self-views
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });

    if (profile && profile.userId === viewerId) {
      return;
    }

    // Rate limit: don't record duplicate views from same viewer within 1 hour
    if (viewerId) {
      const recentView = await this.prisma.profileView.findFirst({
        where: {
          profileId,
          viewerId,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recentView) return;
    }

    await this.prisma.profileView.create({
      data: {
        profileId,
        viewerId,
        source,
        referrer,
      },
    });

    // Also log as user activity if viewer is known
    if (viewerId) {
      await this.prisma.userActivity.create({
        data: {
          userId: viewerId,
          type: 'profile_view',
          entityId: profileId,
          entityType: 'profile',
        },
      });
    }
  }

  async getViewsForProfile(
    profileId: string,
    period: '7d' | '30d' | '90d' = '7d',
  ): Promise<{ total: number; byDay: { date: string; count: number }[] }> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const views = await this.prisma.profileView.findMany({
      where: {
        profileId,
        createdAt: { gte: since },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const byDayMap = new Map<string, number>();
    for (const view of views) {
      const dateStr = view.createdAt.toISOString().split('T')[0];
      byDayMap.set(dateStr, (byDayMap.get(dateStr) || 0) + 1);
    }

    const byDay = Array.from(byDayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      total: views.length,
      byDay,
    };
  }

  async getViewersForProfile(
    profileId: string,
    limit = 10,
  ): Promise<
    {
      viewerId: string;
      displayName: string;
      avatarUrl: string | null;
      viewedAt: Date;
    }[]
  > {
    const views = await this.prisma.profileView.findMany({
      where: {
        profileId,
        viewerId: { not: null },
      },
      select: {
        viewerId: true,
        createdAt: true,
        viewer: {
          select: {
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      distinct: ['viewerId'],
    });

    return views
      .filter((v) => v.viewerId && v.viewer?.profile)
      .map((v) => ({
        viewerId: v.viewerId!,
        displayName: v.viewer!.profile!.displayName,
        avatarUrl: v.viewer!.profile!.avatarUrl,
        viewedAt: v.createdAt,
      }));
  }

  async getViewCountForUser(userId: string, period: '7d' | '30d' | '90d' = '7d'): Promise<number> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) return 0;

    return this.prisma.profileView.count({
      where: {
        profileId: profile.id,
        createdAt: { gte: since },
      },
    });
  }
}
