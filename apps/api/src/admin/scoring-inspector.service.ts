import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XPEventType } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface XPBreakdownItem {
  id: string;
  eventType: XPEventType;
  baseXp: number;
  finalXp: number;
  weightMultiplier: number;
  isDiminished: boolean;
  cooldownKey: string | null;
  explain: string;
  createdAt: Date;
}

export interface BadgeInspectItem {
  badgeId: string;
  name: string;
  category: string;
  rarity: string;
  awardedAt: Date;
  seen: boolean;
}

export interface StreakInspect {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  graceUsedAt: Date | null;
}

export interface ContributionInspect {
  workspaceId: string;
  score: number;
  breakdown: Record<string, unknown>;
  updatedAt: Date;
}

export interface AnomalySignal {
  flagId: string;
  type: string;
  severity: number;
  description: string | null;
  status: string;
  createdAt: Date;
}

export interface ScoreInspectReport {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  totalXp: number;
  level: number;
  levelLabel: string;
  xpByEventType: Record<string, { count: number; totalXp: number; avgXp: number }>;
  recentEvents: XPBreakdownItem[];
  badges: BadgeInspectItem[];
  streak: StreakInspect | null;
  contributions: ContributionInspect[];
  anomalies: AnomalySignal[];
  suppressedUntil: Date | null;
  humanSummary: string;
}

// XP level thresholds (mirror from gamification.types.ts)
const XP_LEVELS = [
  { level: 1, label: 'Seed',      minXp: 0 },
  { level: 2, label: 'Sprout',    minXp: 200 },
  { level: 3, label: 'Builder',   minXp: 600 },
  { level: 4, label: 'Launcher',  minXp: 1400 },
  { level: 5, label: 'Scaler',    minXp: 3000 },
  { level: 6, label: 'Founder',   minXp: 6000 },
  { level: 7, label: 'Visionary', minXp: 12000 },
];

function computeLevel(totalXp: number): { level: number; label: string } {
  let info = XP_LEVELS[0];
  for (const tier of XP_LEVELS) {
    if (totalXp >= tier.minXp) info = tier;
  }
  return { level: info.level, label: info.label };
}

@Injectable()
export class ScoringInspectorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full score inspection report for a single user.
   * Used by GET /admin/score/:userId
   */
  async inspectUser(userId: string): Promise<ScoreInspectReport> {
    const [
      user,
      allEvents,
      badges,
      streak,
      contributions,
      abuseFlags,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          profile: { select: { displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.xPEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.userGamificationBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      }),
      this.prisma.streakRecord.findUnique({ where: { userId } }),
      this.prisma.contributionScore.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      // Cast needed until prisma generate can run post-restart
      (this.prisma as unknown as Record<string, unknown>)['abuseFlag']
        ? (this.prisma as unknown as { abuseFlag: { findMany: (args: unknown) => Promise<unknown[]> } })
            .abuseFlag.findMany({ where: { userId }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }], take: 20 })
        : Promise.resolve([] as unknown[]),
    ]);

    if (!user) {
      return {
        userId,
        email: 'unknown',
        displayName: null,
        avatarUrl: null,
        role: 'unknown',
        totalXp: 0,
        level: 1,
        levelLabel: 'Seed',
        xpByEventType: {},
        recentEvents: [],
        badges: [],
        streak: null,
        contributions: [],
        anomalies: [],
        suppressedUntil: null,
        humanSummary: `User ${userId} not found`,
      };
    }

    // ── XP aggregation ─────────────────────────────────────────────────────
    const effectiveEvents = allEvents.filter((e) => e.xpAmount > 0);
    const totalXp = effectiveEvents.reduce((s, e) => s + e.xpAmount, 0);
    const { level, label: levelLabel } = computeLevel(totalXp);

    // Group by eventType
    const xpByEventType: Record<string, { count: number; totalXp: number; avgXp: number }> = {};
    for (const e of allEvents) {
      const key = e.eventType as string;
      if (!xpByEventType[key]) xpByEventType[key] = { count: 0, totalXp: 0, avgXp: 0 };
      xpByEventType[key].count++;
      xpByEventType[key].totalXp += e.xpAmount;
    }
    for (const v of Object.values(xpByEventType)) {
      v.avgXp = v.count > 0 ? Math.round(v.totalXp / v.count) : 0;
    }

    // Recent events (last 20 non-zero)
    const recentEvents: XPBreakdownItem[] = effectiveEvents.slice(0, 20).map((e) => {
      const parts: string[] = [`base=${e.baseXp}`];
      if (e.isDiminished) parts.push('DR-reduced');
      if (e.weightMultiplier !== 1.0) parts.push(`×${e.weightMultiplier.toFixed(2)}`);
      parts.push(`→${e.xpAmount}XP`);
      return {
        id: e.id,
        eventType: e.eventType,
        baseXp: e.baseXp,
        finalXp: e.xpAmount,
        weightMultiplier: e.weightMultiplier,
        isDiminished: e.isDiminished,
        cooldownKey: e.cooldownKey,
        explain: parts.join(' '),
        createdAt: e.createdAt,
      };
    });

    // Check for active burst suppression
    const suppressionEvent = allEvents.find((e) =>
      e.cooldownKey?.startsWith('BURST_SUPPRESSION:'),
    );
    let suppressedUntil: Date | null = null;
    if (suppressionEvent) {
      const meta = suppressionEvent.metadata as Record<string, unknown> | null;
      const su = meta?.suppressedUntil;
      if (su) {
        const d = new Date(su as string);
        if (d > new Date()) suppressedUntil = d;
      }
    }

    // ── Badges ─────────────────────────────────────────────────────────────
    const badgeItems: BadgeInspectItem[] = badges.map((ub) => ({
      badgeId: ub.badgeId,
      name: ub.badge.name,
      category: ub.badge.category,
      rarity: ub.badge.rarity,
      awardedAt: ub.awardedAt,
      seen: ub.seenAt !== null,
    }));

    // ── Anomalies ──────────────────────────────────────────────────────────
    const anomalies: AnomalySignal[] = (abuseFlags as Array<Record<string, unknown>>).map((f) => ({
      flagId: f['id'] as string,
      type: f['type'] as string,
      severity: f['severity'] as number,
      description: (f['description'] as string | null) ?? null,
      status: f['status'] as string,
      createdAt: f['createdAt'] as Date,
    }));

    // ── Human summary ──────────────────────────────────────────────────────
    const summaryParts: string[] = [
      `${user.profile?.displayName ?? user.email} · Level ${level} (${levelLabel}) · ${totalXp} XP`,
      `${streak?.currentStreak ?? 0}d streak`,
      `${badgeItems.length} badges`,
    ];
    if (suppressedUntil) summaryParts.push(`⚠ Suppressed until ${suppressedUntil.toISOString()}`);
    if (anomalies.filter((a) => a.status === 'pending').length > 0) {
      summaryParts.push(`🚨 ${anomalies.filter((a) => a.status === 'pending').length} open abuse flags`);
    }

    return {
      userId: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
      role: user.role,
      totalXp,
      level,
      levelLabel,
      xpByEventType,
      recentEvents,
      badges: badgeItems,
      streak: streak
        ? {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastActiveDate: streak.lastActiveDate,
            graceUsedAt: streak.graceUsedAt,
          }
        : null,
      contributions: contributions.map((c) => ({
        workspaceId: c.workspaceId,
        score: c.score,
        breakdown: (c.breakdown as Record<string, unknown>) ?? {},
        updatedAt: c.updatedAt,
      })),
      anomalies,
      suppressedUntil,
      humanSummary: summaryParts.join(' · '),
    };
  }

  /**
   * Platform-wide XP distribution histogram (for admin analytics).
   * Returns buckets: [0–99, 100–299, 300–599, 600–999, 1000–1999, 2000–4999, 5000+]
   */
  async getXPDistribution(): Promise<Array<{ bucket: string; count: number }>> {
    const buckets = [
      { label: '0–99', min: 0, max: 99 },
      { label: '100–299', min: 100, max: 299 },
      { label: '300–599', min: 300, max: 599 },
      { label: '600–999', min: 600, max: 999 },
      { label: '1000–1999', min: 1000, max: 1999 },
      { label: '2000–4999', min: 2000, max: 4999 },
      { label: '5000+', min: 5000, max: 999999 },
    ];

    // Aggregate total XP per user from XPEvent (xpAmount > 0 only)
    const rows = await this.prisma.xPEvent.groupBy({
      by: ['userId'],
      where: { xpAmount: { gt: 0 } },
      _sum: { xpAmount: true },
    });

    const userTotals = rows.map((r) => r._sum.xpAmount ?? 0);

    return buckets.map((b) => ({
      bucket: b.label,
      count: userTotals.filter((xp) => xp >= b.min && xp <= b.max).length,
    }));
  }

  /**
   * Platform-wide badge unlock rates.
   * Returns each badge with its unlock count and % of total users.
   */
  async getBadgeUnlockRates(): Promise<Array<{
    badgeId: string;
    name: string;
    category: string;
    rarity: string;
    unlockCount: number;
    unlockRate: number;
  }>> {
    const [badges, totalUsers] = await Promise.all([
      this.prisma.gamificationBadge.findMany({
        include: { _count: { select: { userBadges: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count(),
    ]);

    return badges.map((b) => ({
      badgeId: b.id,
      name: b.name,
      category: b.category,
      rarity: b.rarity,
      unlockCount: b._count.userBadges,
      unlockRate: totalUsers > 0 ? parseFloat(((b._count.userBadges / totalUsers) * 100).toFixed(1)) : 0,
    }));
  }
}
