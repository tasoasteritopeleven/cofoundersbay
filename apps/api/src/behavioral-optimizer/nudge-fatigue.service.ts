import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NudgeDecision {
  shouldShow: boolean;
  reason: string;
  cooldownEndsAt?: Date;
}

// ── Policy constants (overridden by active BehaviorPolicy row if present) ─────
const DEFAULT_MIN_INTERVAL_MS = 8 * 60 * 60_000;  // 8 hours between nudges
const DEFAULT_MAX_PER_DAY = 2;
const DEFAULT_FATIGUE_WINDOW_DAYS = 3;
const DEFAULT_FATIGUE_THRESHOLD = 5; // dismissed 5 times in window → fatigue

@Injectable()
export class NudgeFatigueService {
  private readonly logger = new Logger(NudgeFatigueService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get db(): any { return this.prisma; }

  async canShowNudge(userId: string, nudgeKey: string, surface: string): Promise<NudgeDecision> {
    const db = this.db;

    if (!db.userBehavioralState || !db.nudgeLog) {
      return { shouldShow: true, reason: 'fatigue tracking not yet available' };
    }

    const state = await db.userBehavioralState.findUnique({
      where: { userId },
      select: { lastNudgeAt: true, nudgesSentToday: true, fatigueSince: true },
    });

    if (!state) return { shouldShow: true, reason: 'no state record — first nudge' };

    // Fatigue block
    if (state.fatigueSince) {
      const fatigueAge = Date.now() - state.fatigueSince.getTime();
      if (fatigueAge < DEFAULT_FATIGUE_WINDOW_DAYS * 86_400_000) {
        return { shouldShow: false, reason: 'nudge fatigue active — user dismissed too many recently' };
      }
    }

    // Minimum interval
    if (state.lastNudgeAt) {
      const elapsed = Date.now() - state.lastNudgeAt.getTime();
      if (elapsed < DEFAULT_MIN_INTERVAL_MS) {
        const cooldownEndsAt = new Date(state.lastNudgeAt.getTime() + DEFAULT_MIN_INTERVAL_MS);
        return { shouldShow: false, reason: 'minimum interval not elapsed', cooldownEndsAt };
      }
    }

    // Daily cap
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const nudgesToday = await db.nudgeLog.count({
      where: { userId, shown: true, createdAt: { gte: todayStart } },
    });
    if (nudgesToday >= DEFAULT_MAX_PER_DAY) {
      return { shouldShow: false, reason: `daily nudge cap (${DEFAULT_MAX_PER_DAY}) reached` };
    }

    // Same-key cooldown: don't repeat the same action within 24h
    const lastSameKey = await db.nudgeLog.findFirst({
      where: { userId, nudgeKey, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (lastSameKey) {
      return { shouldShow: false, reason: `same nudge key shown within last 24h: ${nudgeKey}` };
    }

    return { shouldShow: true, reason: 'all checks passed' };
  }

  async recordNudgeShown(
    userId: string,
    nudgeKey: string,
    surface: string,
    stateId?: string,
    policyVersion?: string,
    contextJson?: object,
  ): Promise<void> {
    const db = this.db;
    if (!db.nudgeLog) return;

    await db.nudgeLog.create({
      data: { userId, nudgeKey, surface, stateId: stateId ?? null, policyVersion: policyVersion ?? null, contextJson: contextJson ?? null },
    });

    if (db.userBehavioralState) {
      await db.userBehavioralState.upsert({
        where: { userId },
        create: { userId, state: 'exploring', lastNudgeAt: new Date(), nudgesSentToday: 1, nudgesSentTotal: 1, signals: {} },
        update: { lastNudgeAt: new Date(), nudgesSentTotal: { increment: 1 }, nudgesSentToday: { increment: 1 }, updatedAt: new Date() },
      });
    }
  }

  async recordNudgeDismissed(logId: string, userId: string): Promise<void> {
    const db = this.db;
    if (!db.nudgeLog) return;

    await db.nudgeLog.update({
      where: { id: logId },
      data: { dismissed: true, dismissedAt: new Date() },
    });

    // Check fatigue
    const windowStart = new Date(Date.now() - DEFAULT_FATIGUE_WINDOW_DAYS * 86_400_000);
    const recentDismissals = await db.nudgeLog.count({
      where: { userId, dismissed: true, dismissedAt: { gte: windowStart } },
    });
    if (recentDismissals >= DEFAULT_FATIGUE_THRESHOLD && db.userBehavioralState) {
      await db.userBehavioralState.update({
        where: { userId },
        data: { fatigueSince: new Date(), updatedAt: new Date() },
      }).catch(() => null);
    }
  }

  async recordNudgeConverted(logId: string): Promise<void> {
    const db = this.db;
    if (!db.nudgeLog) return;
    await db.nudgeLog.update({
      where: { id: logId },
      data: { converted: true, convertedAt: new Date() },
    });
  }

  async getRecentNudgeLogs(userId: string, limit = 20): Promise<unknown[]> {
    const db = this.db;
    if (!db.nudgeLog) return [];
    return db.nudgeLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getPlatformNudgeStats(): Promise<{
    totalShown: number;
    totalDismissed: number;
    totalConverted: number;
    conversionRate: number;
    dismissalRate: number;
    byKey: Array<{ key: string; shown: number; converted: number; dismissed: number }>;
  }> {
    const db = this.db;
    if (!db.nudgeLog) return { totalShown: 0, totalDismissed: 0, totalConverted: 0, conversionRate: 0, dismissalRate: 0, byKey: [] };

    const [total, dismissed, converted, byKeyRaw] = await Promise.all([
      db.nudgeLog.count({ where: { shown: true } }),
      db.nudgeLog.count({ where: { dismissed: true } }),
      db.nudgeLog.count({ where: { converted: true } }),
      db.nudgeLog.groupBy({ by: ['nudgeKey'], _count: { id: true, converted: true, dismissed: true } }),
    ]);

    return {
      totalShown: total,
      totalDismissed: dismissed,
      totalConverted: converted,
      conversionRate: total > 0 ? parseFloat(((converted / total) * 100).toFixed(1)) : 0,
      dismissalRate: total > 0 ? parseFloat(((dismissed / total) * 100).toFixed(1)) : 0,
      byKey: (byKeyRaw as any[]).map((r: any) => ({
        key: r.nudgeKey,
        shown: r._count.id,
        converted: r._count.converted ?? 0,
        dismissed: r._count.dismissed ?? 0,
      })),
    };
  }
}
