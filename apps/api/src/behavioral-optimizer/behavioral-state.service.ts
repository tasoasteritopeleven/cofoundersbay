import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserSignals {
  userId: string;
  profileCompletionPct: number;
  connectionCount: number;
  boardCount: number;
  docCount: number;
  totalXp: number;
  currentStreak: number;
  lastActiveDate: Date | null;
  pendingReviewCount: number;
  unreadFeedbackCount: number;
  workspaceCount: number;
  collaboratorCount: number;
  mentorSessionCount: number;
  readinessScore: number;
  daysSinceLastActivity: number;
  daysSinceSignup: number;
}

export type BehavioralStateKey =
  | 'newly_onboarded'
  | 'profile_incomplete'
  | 'exploring'
  | 'matching_focused'
  | 'artifact_building'
  | 'stuck'
  | 'feedback_processing'
  | 'high_momentum'
  | 'review_ready'
  | 'readiness_plateaued';

export interface ClassifiedState {
  state: BehavioralStateKey;
  confidence: number;
  signals: UserSignals;
  reason: string;
}

@Injectable()
export class BehavioralStateService {
  private readonly logger = new Logger(BehavioralStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async collectSignals(userId: string): Promise<UserSignals> {
    const now = new Date();

    const [user, profile, xpAgg, streak, boards, docs, connections,
           collaborators, mentorSessions, readiness, pendingReviews] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, lastSeenAt: true } }),
        this.prisma.profile.findUnique({ where: { userId }, select: { displayName: true, headline: true, bio: true, avatarUrl: true } }),
        this.prisma.xPEvent.aggregate({ where: { userId }, _sum: { xpAmount: true } }),
        this.prisma.streakRecord.findUnique({ where: { userId }, select: { currentStreak: true, lastActiveDate: true } }),
        this.prisma.researchBoard.count({ where: { ownerId: userId } }),
        this.prisma.builderDocument.count({ where: { workspace: { ownerId: userId } } }),
        this.prisma.connectionRequest.count({ where: { OR: [{ requesterId: userId }, { receiverId: userId }], status: 'accepted' } }),
        this.prisma.builderCollaborator.count({ where: { workspace: { ownerId: userId } } }),
        this.prisma.mentorshipSession.count({ where: { OR: [{ mentorId: userId }, { menteeId: userId }] } }),
        this.prisma.startupReadinessReport.findFirst({ where: { userId }, orderBy: { snapshotAt: 'desc' }, select: { overallScore: true } }),
        this.prisma.builderReview.count({ where: { document: { workspace: { ownerId: userId } }, status: 'pending' } }),
      ]);

    const totalXp = xpAgg._sum.xpAmount ?? 0;
    const lastActive = streak?.lastActiveDate ?? user?.lastSeenAt ?? null;
    const daysSinceLastActivity = lastActive
      ? Math.floor((now.getTime() - lastActive.getTime()) / 86_400_000)
      : 999;
    const daysSinceSignup = user?.createdAt
      ? Math.floor((now.getTime() - user.createdAt.getTime()) / 86_400_000)
      : 0;

    // Profile completion heuristic: presence of key fields → %
    let profilePct = 0;
    if (profile?.displayName) profilePct += 25;
    if (profile?.headline) profilePct += 25;
    if (profile?.bio) profilePct += 25;
    if (profile?.avatarUrl) profilePct += 25;

    const workspaceCount = await this.prisma.builderWorkspace.count({ where: { ownerId: userId } });

    return {
      userId,
      profileCompletionPct: profilePct,
      connectionCount: connections,
      boardCount: boards,
      docCount: docs,
      totalXp,
      currentStreak: streak?.currentStreak ?? 0,
      lastActiveDate: lastActive,
      pendingReviewCount: pendingReviews,
      unreadFeedbackCount: 0,
      workspaceCount,
      collaboratorCount: collaborators,
      mentorSessionCount: mentorSessions,
      readinessScore: readiness?.overallScore ?? 0,
      daysSinceLastActivity,
      daysSinceSignup,
    };
  }

  classify(signals: UserSignals): ClassifiedState {
    const s = signals;

    if (s.daysSinceSignup <= 3 && s.totalXp < 50) {
      return { state: 'newly_onboarded', confidence: 0.95, signals: s, reason: 'signed up within 3 days, minimal XP' };
    }
    if (s.profileCompletionPct < 50) {
      return { state: 'profile_incomplete', confidence: 0.90, signals: s, reason: `profile only ${s.profileCompletionPct}% complete` };
    }
    if (s.pendingReviewCount >= 1) {
      return { state: 'review_ready', confidence: 0.88, signals: s, reason: `${s.pendingReviewCount} pending review(s) awaiting attention` };
    }
    if (s.daysSinceLastActivity >= 7) {
      return { state: 'stuck', confidence: 0.85, signals: s, reason: `inactive for ${s.daysSinceLastActivity} days` };
    }
    if (s.totalXp >= 500 && s.currentStreak >= 5) {
      return { state: 'high_momentum', confidence: 0.85, signals: s, reason: `${s.totalXp} XP with ${s.currentStreak}-day streak` };
    }
    if (s.readinessScore >= 60 && s.docCount >= 3) {
      return { state: 'readiness_plateaued', confidence: 0.80, signals: s, reason: `readiness ${s.readinessScore} but no recent improvement signal` };
    }
    if (s.docCount >= 2 || s.boardCount >= 1) {
      return { state: 'artifact_building', confidence: 0.78, signals: s, reason: `${s.docCount} docs, ${s.boardCount} boards` };
    }
    if (s.connectionCount >= 3) {
      return { state: 'matching_focused', confidence: 0.72, signals: s, reason: `${s.connectionCount} connections, network-focused` };
    }
    return { state: 'exploring', confidence: 0.60, signals: s, reason: 'early-stage browsing behaviour' };
  }

  async classifyUser(userId: string): Promise<ClassifiedState> {
    const signals = await this.collectSignals(userId);
    return this.classify(signals);
  }

  async persistState(userId: string, classified: ClassifiedState): Promise<void> {
    const db = this.prisma as any;
    if (!db.userBehavioralState) return; // guard until prisma generate

    const existing = await db.userBehavioralState.findUnique({ where: { userId }, select: { state: true } });
    await db.userBehavioralState.upsert({
      where: { userId },
      create: {
        userId,
        state: classified.state,
        signals: classified.signals as object,
        stateChangedAt: new Date(),
      },
      update: {
        previousState: existing?.state ?? null,
        state: classified.state,
        signals: classified.signals as object,
        stateChangedAt: existing?.state !== classified.state ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async getOrClassify(userId: string): Promise<ClassifiedState> {
    const db = this.prisma as any;
    let cached: { state: string; signals: object; updatedAt: Date } | null = null;

    if (db.userBehavioralState) {
      cached = await db.userBehavioralState.findUnique({
        where: { userId },
        select: { state: true, signals: true, updatedAt: true },
      });
    }

    // Re-classify if stale (>30 min) or missing
    const staleMs = 30 * 60_000;
    if (!cached || (Date.now() - cached.updatedAt.getTime()) > staleMs) {
      const classified = await this.classifyUser(userId);
      await this.persistState(userId, classified);
      return classified;
    }

    return {
      state: cached.state as BehavioralStateKey,
      confidence: 0.8,
      signals: { ...cached.signals, userId } as UserSignals,
      reason: 'cached',
    };
  }
}
