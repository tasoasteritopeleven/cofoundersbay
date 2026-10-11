import { Injectable } from '@nestjs/common';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

export type DashboardStats = {
  activeProfiles: number;
  matchesThisWeek: number;
  trendPercent: number;
  chartData: { label: string; value: number }[];
  /*
   * The directory header on /discover used to state "1,200+ active founders",
   * "180+ expert mentors", "450+ successful matches" and "25+ communities" as
   * constants in the page source. They are counted here instead, behind the
   * same 60-second cache as the rest of this payload.
   */
  founders: number;
  mentors: number;
  successfulMatches: number;
  communities: number;
};

export type ActivityItem = {
  id: string;
  type: 'connection' | 'event' | 'milestone' | 'achievement';
  title: string;
  author?: string;
  timeAgo: string;
  href: string;
  createdAt: string;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getStats(): Promise<DashboardStats> {
    return this.cache.getOrSet('dashboard:stats', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const [
        profileCount,
        matchesThisWeek,
        matchesLastWeek,
        chartData,
        founders,
        mentors,
        successfulMatches,
        communities,
      ] = await Promise.all([
        this.prisma.profile.count(),
        this.prisma.connectionRequest.count({
          where: {
            status: 'accepted',
            respondedAt: { gte: weekAgo },
          },
        }),
        this.prisma.connectionRequest.count({
          where: {
            status: 'accepted',
            respondedAt: {
              gte: twoWeeksAgo,
              lt: weekAgo,
            },
          },
        }),
        this.getChartData(),
        this.prisma.profile.count({ where: { user: { role: 'founder' } } }),
        this.prisma.profile.count({ where: { user: { role: 'mentor' } } }),
        this.prisma.connectionRequest.count({ where: { status: 'accepted' } }),
        this.prisma.group.count(),
      ]);

      const trendPercent =
        matchesLastWeek > 0
          ? Math.round(((matchesThisWeek - matchesLastWeek) / matchesLastWeek) * 100)
          : matchesThisWeek > 0 ? 100 : 0;

      return {
        activeProfiles: profileCount,
        matchesThisWeek,
        trendPercent,
        chartData,
        founders,
        mentors,
        successfulMatches,
        communities,
      };
    }, { ttl: 60, tags: ['dashboard'] });
  }

  private async getChartData(): Promise<{ label: string; value: number }[]> {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }), start: d, end: next };
    });

    const counts = await Promise.all(days.map((day) => (
      this.prisma.connectionRequest.count({
        where: {
          status: 'accepted',
          respondedAt: {
            gte: day.start,
            lt: day.end,
          },
        },
      })
    )));

    return days.map((day, index) => ({
      label: day.label,
      value: counts[index] ?? 0,
    }));
  }

  async getUserSummary(userId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      pendingReceived,
      totalConnections,
      unreadMessages,
      unreadNotifications,
      upcomingEvents,
      myMilestones,
    ] = await Promise.all([
      this.prisma.connectionRequest.count({
        where: { receiverId: userId, status: 'pending' },
      }),
      this.prisma.connectionRequest.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { receiverId: userId }],
        },
      }),
      // Count unread messages in conversations where user is a participant
      this.prisma.message.count({
        where: {
          readAt: null,
          senderId: { not: userId },
          conversation: { participants: { some: { userId } } },
        },
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
      this.prisma.event.count({
        where: {
          startAt: { gte: now },
          OR: [
            { creatorId: userId },
            { rsvps: { some: { userId } } },
          ],
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.prisma as any).milestone.count({
        where: {
          OR: [{ ownerId: userId }, { collaboratorId: userId }],
          status: { notIn: ['completed', 'cancelled'] },
        },
      }).catch(() => 0),
    ]);

    const newConnectionsThisWeek = await this.prisma.connectionRequest.count({
      where: {
        status: 'accepted',
        respondedAt: { gte: weekAgo },
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
    });

    return {
      pendingReceived,
      totalConnections,
      newConnectionsThisWeek,
      unreadMessages,
      unreadNotifications,
      upcomingEvents,
      activeMilestones: myMilestones,
    };
  }

  async computeVentureReadiness(userId: string) {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      profile,
      connections,
      recentConnections,
      researchBoards,
      builderWorkspaces,
      eventRsvps,
      groupMemberships,
      mentoringSessions,
    ] = await Promise.all([
      (this.prisma.profile.findUnique({
        where: { userId },
        select: {
          displayName: true,
          headline: true,
          bio: true,
          avatarUrl: true,
          location: true,
          website: true,
          industry: true,
          rolePayload: true,
        },
      }) as Promise<any>),
      this.prisma.connectionRequest.count({
        where: { status: 'accepted', OR: [{ requesterId: userId }, { receiverId: userId }] },
      }),
      this.prisma.connectionRequest.count({
        where: {
          status: 'accepted',
          respondedAt: { gte: fourteenDaysAgo },
          OR: [{ requesterId: userId }, { receiverId: userId }],
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.prisma as any).researchBoard
        ? (this.prisma as any).researchBoard.findMany({
            where: { ownerId: userId },
            select: { id: true, _count: { select: { nodes: true } } },
          }).catch(() => [])
        : Promise.resolve([]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.prisma as any).builderWorkspace
        ? (this.prisma as any).builderWorkspace.findMany({
            where: { ownerId: userId },
            select: { _count: { select: { documents: true } } },
          }).catch(() => [])
        : Promise.resolve([]),
      this.prisma.event.count({
        where: { rsvps: { some: { userId } } },
      }).catch(() => 0),
      this.prisma.groupMember.count({
        where: { userId },
      }).catch(() => 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.prisma as any).mentoringSession
        ? (this.prisma as any).mentoringSession.findMany({
            where: { OR: [{ mentorId: userId }, { menteeId: userId }] },
            select: { id: true },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    // ── Profile Depth (15%) ───────────────────────────────────────────────────
    let profileScore = 0;
    if (profile) {
      const checks = [
        !!profile.displayName,
        !!profile.headline,
        !!profile.bio && profile.bio.length > 20,
        !!profile.avatarUrl,
        Array.isArray(profile.skills) && (profile.skills as unknown[]).length >= 3,
        Array.isArray(profile.skills) && (profile.skills as unknown[]).length >= 7,
        !!profile.startupStage,
        Array.isArray(profile.lookingFor) && (profile.lookingFor as unknown[]).length > 0,
        !!profile.industry,
        !!(profile.linkedinUrl || profile.website),
      ];
      profileScore = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    }

    // ── Research Depth (20%) ─────────────────────────────────────────────────
    const boards = researchBoards as any[];
    const totalNodes = boards.reduce((sum: number, b: any) => sum + (b._count?.nodes ?? 0), 0);
    const researchScore = Math.min(
      100,
      (boards.length > 0 ? 20 : 0) +
      (boards.length >= 3 ? 15 : 0) +
      (totalNodes >= 5 ? 20 : 0) +
      (totalNodes >= 15 ? 20 : 0) +
      (totalNodes >= 30 ? 25 : 0),
    );

    // ── Artifact Quality (25%) ───────────────────────────────────────────────
    const workspaces = builderWorkspaces as any[];
    const totalDocs = workspaces.reduce((sum: number, w: any) => sum + (w._count?.documents ?? 0), 0);
    const artifactScore = Math.min(
      100,
      (workspaces.length > 0 ? 20 : 0) +
      (totalDocs >= 1 ? 20 : 0) +
      (totalDocs >= 3 ? 20 : 0) +
      (totalDocs >= 6 ? 20 : 0) +
      (totalDocs >= 10 ? 20 : 0),
    );

    // ── Collaboration Score (20%) ─────────────────────────────────────────────
    const sessions = (mentoringSessions as any[]).length;
    const collaborationScore = Math.min(
      100,
      (connections >= 1 ? 15 : 0) +
      (connections >= 5 ? 15 : 0) +
      (connections >= 10 ? 15 : 0) +
      (connections >= 20 ? 15 : 0) +
      (sessions >= 1 ? 20 : 0) +
      (sessions >= 5 ? 20 : 0),
    );

    // ── Momentum Consistency (10%) ────────────────────────────────────────────
    const momentumScore = Math.min(100,
      (recentConnections >= 1 ? 50 : 0) +
      (recentConnections >= 3 ? 50 : 0),
    );

    // ── Ecosystem Engagement (10%) ────────────────────────────────────────────
    const ecosystemScore = Math.min(
      100,
      (eventRsvps >= 1 ? 25 : 0) +
      (eventRsvps >= 3 ? 25 : 0) +
      (groupMemberships >= 1 ? 25 : 0) +
      (groupMemberships >= 3 ? 25 : 0),
    );

    const overall = Math.round(
      profileScore       * 0.15 +
      researchScore      * 0.20 +
      artifactScore      * 0.25 +
      collaborationScore * 0.20 +
      momentumScore      * 0.10 +
      ecosystemScore     * 0.10,
    );

    const dimensions = [
      { key: 'profile',       label: 'Profile Depth',           score: profileScore,       weight: 15, href: '/profile' },
      { key: 'research',      label: 'Research Depth',          score: researchScore,      weight: 20, href: '/research' },
      { key: 'artifacts',     label: 'Artifact Quality',        score: artifactScore,      weight: 25, href: '/builder' },
      { key: 'collaboration', label: 'Collaboration',           score: collaborationScore, weight: 20, href: '/connections' },
      { key: 'momentum',      label: 'Momentum (14d)',          score: momentumScore,      weight: 10, href: '/activity' },
      { key: 'ecosystem',     label: 'Ecosystem Engagement',    score: ecosystemScore,     weight: 10, href: '/events' },
    ];

    const lowestDimension = [...dimensions].sort((a, b) => a.score - b.score)[0];

    return {
      overall,
      dimensions,
      lowestDimension,
      signals: {
        boardCount: boards.length,
        totalNodes,
        docCount: totalDocs,
        connectionCount: connections,
        sessionCount: sessions,
      },
    };
  }

  async getActivity(limit = 10, offset = 0): Promise<{ items: ActivityItem[]; total: number; hasMore: boolean }> {
    const cacheKey = `dashboard:activity:${limit}:${offset}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const now = new Date();
      const fetchLimit = limit + offset + 20; // over-fetch to calculate total

      const [connections, events, milestones, achievements] = await Promise.all([
        this.prisma.connectionRequest.findMany({
          where: { status: 'accepted' },
          orderBy: { respondedAt: 'desc' },
          take: fetchLimit,
          include: {
            requester: { select: { profile: { select: { displayName: true } } } },
            receiver:  { select: { profile: { select: { displayName: true } } } },
          },
        }),
        this.prisma.event.findMany({
          where: { startAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' },
          take: Math.ceil(fetchLimit / 3),
          include: {
            creator: { select: { profile: { select: { displayName: true } } } },
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.prisma as any).milestone
          ? (this.prisma as any).milestone.findMany({
              where: { status: { in: ['completed', 'in_progress'] } },
              orderBy: { updatedAt: 'desc' },
              take: Math.ceil(fetchLimit / 3),
              include: { owner: { select: { profile: { select: { displayName: true } } } } },
            }).catch(() => [])
          : Promise.resolve([]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.prisma as any).achievement
          ? (this.prisma as any).achievement.findMany({
              orderBy: { awardedAt: 'desc' },
              take: Math.ceil(fetchLimit / 4),
              include: { user: { select: { profile: { select: { displayName: true } } } } },
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      const items: ActivityItem[] = [];

      for (const c of connections) {
        if (!c.respondedAt) continue;
        const requesterName = c.requester.profile?.displayName ?? 'Someone';
        const receiverName  = c.receiver.profile?.displayName  ?? 'Someone';
        items.push({
          id: `conn-${c.id}`,
          type: 'connection',
          title: `${requesterName} and ${receiverName} connected`,
          timeAgo: formatTimeAgo(c.respondedAt),
          href: '/discover',
          createdAt: c.respondedAt.toISOString(),
        });
      }

      for (const e of events) {
        items.push({
          id: `evt-${e.id}`,
          type: 'event',
          title: e.title,
          author: e.creator.profile?.displayName ?? undefined,
          timeAgo: formatTimeAgo(e.createdAt),
          href: '/events',
          createdAt: e.createdAt.toISOString(),
        });
      }

      for (const m of milestones as any[]) {
        items.push({
          id: `ms-${m.id}`,
          type: 'milestone',
          title: m.status === 'completed' ? `Milestone completed: ${m.title}` : `Milestone in progress: ${m.title}`,
          author: m.owner?.profile?.displayName ?? undefined,
          timeAgo: formatTimeAgo(m.updatedAt ?? m.createdAt),
          href: '/milestones',
          createdAt: (m.updatedAt ?? m.createdAt).toISOString(),
        });
      }

      for (const a of achievements as any[]) {
        items.push({
          id: `ach-${a.id}`,
          type: 'achievement',
          title: `Achievement unlocked: ${a.title ?? a.type ?? 'New badge'}`,
          author: a.user?.profile?.displayName ?? undefined,
          timeAgo: formatTimeAgo(a.awardedAt ?? a.createdAt),
          href: '/achievements',
          createdAt: (a.awardedAt ?? a.createdAt).toISOString(),
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const total = items.length;
      const paged = items.slice(offset, offset + limit);
      return { items: paged, total, hasMore: offset + limit < total };
    }, { ttl: 30, tags: ['dashboard'] });
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
