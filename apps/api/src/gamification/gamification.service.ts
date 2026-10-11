import { Injectable, Logger } from '@nestjs/common';
import { XPEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  XP_CONFIG,
  READINESS_WEIGHTS,
  READINESS_GATE_DIMS,
  CONTRIBUTION_WEIGHTS,
  CONTRIBUTION_RECENCY_DECAY,
  MOMENTUM_WEIGHTS,
  MOMENTUM_DECAY_LAMBDA,
  VELOCITY_SCALE,
  ACTIVITY_SCALE,
  FEEDBACK_LOOP_SCALE,
  MENTOR_WEIGHTS,
  MENTOR_MAX_RESPONSE_HRS,
  MENTOR_DEPTH_SATURATION,
  MIN_XP_FLOOR,
  STREAK_GRACE_DAYS,
  STREAK_SOFT_DECAY_FACTOR,
  STREAK_SOFT_DECAY_MIN,
  STREAK_MILESTONE_BONUSES,
  STREAK_RECOVERY_WINDOW_DAYS,
  ROLE_GROUP_MAP,
  PERCENTILE_MIN_COHORT,
  SOLO_SCALE,
  ABUSE_BURST_WINDOW_MINS,
  ABUSE_BURST_MAX_EVENTS,
  ABUSE_SUPPRESS_HOURS,
  applyDiminishingReturns,
  classifyMomentum,
  computeLevel,
  utcDayStart,
  daysDiff,
  BadgeCriteriaNode,
  BadgeEvalContext,
  DimensionDetail,
  RecordXPOpts,
  RecordXPResult,
  XPSummary,
  BadgeSummary,
  ReadinessSummary,
  ContributionSummary,
  ContributionBreakdown,
  MomentumSummary,
  MomentumBreakdown,
  MentorMetricsSummary,
  ScoreExplainDTO,
  XPEventExplain,
  StreakExplain,
} from './gamification.types';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1 — XP SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Record a single XP event for a user.
   *
   * Formula pipeline:
   *   1. Lifetime guard  (cooldownWindowHrs=0) — entity-scoped cooldownKey
   *   2. Log diminishing returns — applyDiminishingReturns(base, n, max)
   *        factor = 1/(1 + ln(2)·ln(overshoot+1))
   *        blocked when effective XP < MIN_XP_FLOOR (5)
   *   3. Quality multiplier  — caller-supplied ∈ [1.0, cfg.qualityMult]
   *   4. Collab multiplier   — caller-supplied ∈ [1.0, cfg.collabMult]
   *   5. Weight multiplier   — general caller-supplied scale (default 1.0)
   *   6. Final XP = floor(DR_xp × min(qMult, cfg.qualityMult)
   *                              × min(cMult, cfg.collabMult)
   *                              × weightMultiplier)
   */
  async recordXPEvent(
    userId: string,
    eventType: XPEventType,
    opts: RecordXPOpts = {},
  ): Promise<RecordXPResult> {
    const cfg = XP_CONFIG[eventType];
    const {
      workspaceId,
      entityType,
      entityId,
      weightMultiplier = 1.0,
      qualityMultiplier = 1.0,
      collaborationMultiplier = 1.0,
      metadata,
    } = opts;

    // Build deterministic cooldown key (entity-scoped when available)
    const cooldownKey = entityId
      ? `${eventType}:${entityId}`
      : workspaceId
        ? `${eventType}:ws:${workspaceId}:${userId}`
        : `${eventType}:${userId}`;

    // ── 1. Lifetime guard ─────────────────────────────────────────────────
    if (cfg.cooldownWindowHrs === 0) {
      const exists = await this.prisma.xPEvent.findFirst({
        where: { userId, cooldownKey },
        select: { id: true },
      });
      if (exists) {
        return { xpAwarded: 0, isDiminished: false, blocked: true,
          explain: `Lifetime guard: ${cooldownKey} already recorded` };
      }
    }

    // ── 1b. Burst-abuse suppression (PART 9) ─────────────────────────────
    const burstBlocked = await this.checkBurstAbuse(userId);
    if (burstBlocked) {
      return { xpAwarded: 0, isDiminished: false, blocked: true,
        explain: `Burst abuse suppression active for user=${userId}` };
    }

    // ── 2. Logarithmic diminishing returns (window-based) ─────────────────
    let occurrencesInWindow = 0;
    if (cfg.cooldownWindowHrs > 0) {
      const windowStart = new Date(Date.now() - cfg.cooldownWindowHrs * 3_600_000);
      occurrencesInWindow = await this.prisma.xPEvent.count({
        where: { userId, eventType, createdAt: { gte: windowStart } },
      });
    }

    const { effectiveXp: drXp, isDiminished, blocked: drBlocked } =
      applyDiminishingReturns(cfg.baseXp, occurrencesInWindow, cfg.maxPerWindow);

    if (drBlocked) {
      return { xpAwarded: 0, isDiminished: false, blocked: true,
        explain: `DR blocked: ${occurrencesInWindow} occurrences in ${cfg.cooldownWindowHrs}h window (max ${cfg.maxPerWindow}), effective XP < ${MIN_XP_FLOOR}` };
    }

    // ── 3–5. Apply multipliers (clamped to configured maximums) ──────────
    const safeQMult = Math.min(Math.max(qualityMultiplier, 1.0), cfg.qualityMult);
    const safeCMult = Math.min(Math.max(collaborationMultiplier, 1.0), cfg.collabMult);
    const finalXp   = Math.floor(drXp * safeQMult * safeCMult * weightMultiplier);

    const explainParts: string[] = [
      `base=${cfg.baseXp}`,
      isDiminished ? `DR×${(drXp / cfg.baseXp).toFixed(2)}` : 'DR×1.0',
    ];
    if (safeQMult > 1) explainParts.push(`quality×${safeQMult.toFixed(2)}`);
    if (safeCMult > 1) explainParts.push(`collab×${safeCMult.toFixed(2)}`);
    if (weightMultiplier !== 1) explainParts.push(`weight×${weightMultiplier}`);
    explainParts.push(`→${finalXp}XP`);

    // ── Persist ───────────────────────────────────────────────────────────
    await this.prisma.xPEvent.create({
      data: {
        userId,
        workspaceId:    workspaceId ?? null,
        eventType,
        entityType:     entityType ?? null,
        entityId:       entityId ?? null,
        xpAmount:       finalXp,
        baseXp:         cfg.baseXp,
        weightMultiplier: Math.round(safeQMult * safeCMult * weightMultiplier * 1000) / 1000,
        cooldownKey,
        isDiminished,
        metadata: (metadata as object) ?? undefined,
      },
    });

    // ── Fire-and-forget side-effects (never block caller) ─────────────────
    this.triggerSideEffects(userId, eventType, workspaceId, cfg.qualifiesForStreak).catch(
      (err) => this.logger.warn(
        `GamificationService.triggerSideEffects failed for user=${userId}: ${err?.message}`,
      ),
    );

    return { xpAwarded: finalXp, isDiminished, blocked: false,
      explain: explainParts.join(' ') };
  }

  private async triggerSideEffects(
    userId: string,
    eventType: XPEventType,
    workspaceId?: string,
    qualifiesForStreak = false,
  ): Promise<void> {
    const tasks: Promise<unknown>[] = [this.evaluateBadges(userId)];
    if (qualifiesForStreak) tasks.push(this.updateStreak(userId));
    if (workspaceId) {
      tasks.push(this.updateContributionScore(userId, workspaceId));
      tasks.push(this.updateTeamMomentum(workspaceId));
      tasks.push(this.calculateReadinessScore(workspaceId));
    }
    if (
      workspaceId &&
      (eventType === 'RECEIVE_MENTOR_FEEDBACK' || eventType === 'APPLY_FEEDBACK')
    ) {
      tasks.push(this.processMentorFeedbackMetrics(workspaceId));
    }
    await Promise.allSettled(tasks);
  }

  /**
   * Return full XP summary for a user: total, level, recent events, streak.
   */
  async calculateUserXP(userId: string): Promise<XPSummary> {
    const [xpAgg, badgeBonuses, recentRaw, streak] = await Promise.all([
      this.prisma.xPEvent.aggregate({
        where: { userId },
        _sum: { xpAmount: true },
      }),
      this.prisma.userGamificationBadge.findMany({
        where: { userId },
        include: { badge: { select: { xpReward: true } } },
      }),
      this.prisma.xPEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          xpAmount: true,
          entityType: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.streakRecord.findUnique({ where: { userId } }),
    ]);

    const eventXp = xpAgg._sum.xpAmount ?? 0;
    const bonusXp = badgeBonuses.reduce((s, ub) => s + ub.badge.xpReward, 0);
    const totalXp = eventXp + bonusXp;

    const { level, label, xpToNextLevel, levelProgress } = computeLevel(totalXp);

    return {
      userId,
      totalXp,
      level,
      levelLabel: label,
      xpToNextLevel,
      levelProgress,
      recentEvents: recentRaw.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        xpAmount: e.xpAmount,
        entityType: e.entityType,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      streak: {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        lastActiveDate: streak?.lastActiveDate ?? null,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2 — BADGE ENGINE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Evaluate all active badges for a user; award any that now pass criteria.
   * Returns the list of *newly* awarded badges in this run.
   */
  async evaluateBadges(userId: string): Promise<BadgeSummary[]> {
    const [allBadges, earnedRaw, xpEvents, streak] = await Promise.all([
      this.prisma.gamificationBadge.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.userGamificationBadge.findMany({
        where: { userId },
        select: { badgeId: true },
      }),
      this.prisma.xPEvent.findMany({
        where: { userId },
        select: { eventType: true, xpAmount: true, workspaceId: true },
      }),
      this.prisma.streakRecord.findUnique({
        where: { userId },
        select: { longestStreak: true },
      }),
    ]);

    const earnedIds = new Set(earnedRaw.map((b) => b.badgeId));
    const totalXp = xpEvents.reduce((s, e) => s + e.xpAmount, 0);

    const ctx: BadgeEvalContext = {
      userId,
      xpEvents,
      totalXp,
      earnedIds,
      longestStreak: streak?.longestStreak ?? 0,
    };

    const newlyAwarded: BadgeSummary[] = [];

    for (const badge of allBadges) {
      if (earnedIds.has(badge.id)) continue;

      const passes = this.evaluateCriteria(badge.criteria as unknown as BadgeCriteriaNode, ctx);
      if (!passes) continue;

      // Award
      await this.prisma.userGamificationBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          metadata: {
            totalXpAtAward: totalXp,
            criteriaSnapshot: badge.criteria,
          },
        },
      });

      // Grant bonus XP for badge (direct insert, no recursion)
      if (badge.xpReward > 0) {
        const bonusCooldownKey = `BADGE_REWARD:${badge.id}:${userId}`;
        const bonusExists = await this.prisma.xPEvent.findFirst({
          where: { userId, cooldownKey: bonusCooldownKey },
          select: { id: true },
        });
        if (!bonusExists) {
          await this.prisma.xPEvent.create({
            data: {
              userId,
              eventType: 'VALIDATED_PROGRESS',
              xpAmount: badge.xpReward,
              baseXp: badge.xpReward,
              weightMultiplier: 1,
              cooldownKey: bonusCooldownKey,
              metadata: { source: 'badge_reward', badgeKey: badge.key },
            },
          });
        }
      }

      earnedIds.add(badge.id); // update ctx for downstream badge deps

      newlyAwarded.push({
        id: badge.id,
        key: badge.key,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        rarity: badge.rarity,
        iconName: badge.iconName,
        xpReward: badge.xpReward,
        awardedAt: new Date(),
      });
    }

    return newlyAwarded;
  }

  /** Return all badges earned by a user (for display). */
  async getUserBadges(userId: string): Promise<BadgeSummary[]> {
    const rows = await this.prisma.userGamificationBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.badge.id,
      key: r.badge.key,
      name: r.badge.name,
      description: r.badge.description,
      category: r.badge.category,
      rarity: r.badge.rarity,
      iconName: r.badge.iconName,
      xpReward: r.badge.xpReward,
      awardedAt: r.awardedAt,
    }));
  }

  /** Mark badge notifications as seen for a user. */
  async markBadgesSeen(userId: string): Promise<void> {
    await this.prisma.userGamificationBadge.updateMany({
      where: { userId, seenAt: null },
      data: { seenAt: new Date() },
    });
  }

  // ── Badge criteria rule tree evaluator ────────────────────────────────────

  private evaluateCriteria(
    rule: BadgeCriteriaNode,
    ctx: BadgeEvalContext,
  ): boolean {
    switch (rule.type) {
      case 'and':
        return (rule.rules ?? []).every((r) => this.evaluateCriteria(r, ctx));

      case 'or':
        return (rule.rules ?? []).some((r) => this.evaluateCriteria(r, ctx));

      case 'total_xp':
        return ctx.totalXp >= (rule.minXP ?? 0);

      case 'streak_days':
        return ctx.longestStreak >= (rule.minDays ?? 0);

      case 'badge_earned':
        return ctx.earnedIds.has(rule.badgeId ?? '');

      case 'xp_event_count': {
        const cnt = rule.eventType
          ? ctx.xpEvents.filter((e) => e.eventType === rule.eventType).length
          : ctx.xpEvents.length;
        return cnt >= (rule.minCount ?? 0);
      }

      case 'workspace_count': {
        const distinct = new Set(
          ctx.xpEvents.map((e) => e.workspaceId).filter(Boolean),
        ).size;
        return distinct >= (rule.minCount ?? 0);
      }

      case 'collaboration_count': {
        const n = ctx.xpEvents.filter(
          (e) =>
            e.eventType === 'INVITE_COLLABORATOR' ||
            e.eventType === 'TEAM_CONTRIBUTION' ||
            e.eventType === 'HIGH_QUALITY_CONTRIBUTION',
        ).length;
        return n >= (rule.minCount ?? 0);
      }

      case 'readiness_score':
        return (ctx.maxReadinessScore ?? 0) >= (rule.minScore ?? 0);

      case 'contribution_score':
        return (ctx.maxContributionScore ?? 0) >= (rule.minScore ?? 0);

      default:
        this.logger.warn(`Unknown badge criteria type: ${(rule as BadgeCriteriaNode).type}`);
        return false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 3 — WORKSPACE READINESS SCORE (8 dimensions)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Compute and persist the 8-dimension readiness score for a workspace.
   *
   * Formula:
   *   rawComposite = Σ (READINESS_WEIGHTS[k] × dim[k])
   *   bottleneckFactor = Π min(1, dim[j] / GATE_FLOOR[j])  ∀j ∈ GATE_DIMS
   *   finalScore = round(rawComposite × bottleneckFactor)
   *
   * Bottleneck gating smoothly suppresses the composite when critical dims
   * (problemClarity, teamCompleteness) are very weak, preventing a startup
   * from looking "ready" by gaming non-critical dimensions.
   */
  async calculateReadinessScore(workspaceId: string): Promise<ReadinessSummary> {
    const [docs, collaboratorCount, reviewRows, feedbackMetric] = await Promise.all([
      this.prisma.builderDocument.findMany({
        where: { workspaceId },
        select: { type: true, completionPercent: true, status: true },
      }),
      this.prisma.builderCollaborator.count({ where: { workspaceId } }),
      this.prisma.builderReview.findMany({
        where: { document: { workspaceId } },
        select: { status: true, completedAt: true },
      }),
      this.prisma.mentorFeedbackMetric.findUnique({ where: { workspaceId } }),
    ]);

    const breakdown: Record<string, DimensionDetail> = {};

    // Helper: build a DimensionDetail
    const dim = (
      key: string,
      score: number,
      detail: string,
      signals: Record<string, string | number | boolean>,
    ): number => {
      const clamped = Math.min(100, Math.max(0, score));
      const weight = READINESS_WEIGHTS[key] ?? 0;
      breakdown[key] = {
        score: clamped,
        weight,
        weightedContribution: parseFloat((clamped * weight).toFixed(2)),
        detail,
        signals,
      };
      return clamped;
    };

    // ── Artifact Completeness ─────────────────────────────────────────────
    // Score = mean completion % across all workspace documents.
    // Bonus: each approved doc adds +5 (capped at 100).
    const pcts = docs.map((d) => d.completionPercent);
    const approvedDocs = docs.filter((d) => d.status === 'approved').length;
    const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
    const artifactCompleteness = dim(
      'artifactCompleteness',
      Math.round(avgPct + approvedDocs * 5),
      `${pcts.length} doc(s), avg ${Math.round(avgPct)}%, ${approvedDocs} approved`,
      { docCount: pcts.length, avgCompletion: Math.round(avgPct), approvedDocs },
    );

    // ── Problem Clarity ───────────────────────────────────────────────────
    // Primary: idea_core or business_model_canvas completion %.
    // If doc is approved: +10 bonus (capped 100).
    const ideaDoc = docs.find((d) => d.type === 'idea_core' || d.type === 'business_model_canvas');
    const ideaBonus = ideaDoc?.status === 'approved' ? 10 : 0;
    const problemClarity = dim(
      'problemClarity',
      ideaDoc ? Math.round(ideaDoc.completionPercent + ideaBonus) : 0,
      ideaDoc ? `${ideaDoc.type} at ${ideaDoc.completionPercent}%${ideaBonus ? ' (approved +10)' : ''}` : 'no problem doc',
      { docType: ideaDoc?.type ?? '', completion: ideaDoc?.completionPercent ?? 0, approved: ideaBonus > 0 },
    );

    // ── Solution Clarity ──────────────────────────────────────────────────
    // Primary: mvp_plan or prd completion %.
    // Fallback: 40% of problemClarity (problem-first approach).
    const solutionDoc = docs.find((d) => d.type === 'mvp_plan' || d.type === 'prd');
    const solutionClarity = dim(
      'solutionClarity',
      solutionDoc ? solutionDoc.completionPercent : Math.round(problemClarity * 0.4),
      solutionDoc ? `${solutionDoc.type} at ${solutionDoc.completionPercent}%` : 'inferred (40% of problemClarity)',
      { docType: solutionDoc?.type ?? '', completion: solutionDoc?.completionPercent ?? 0, inferred: !solutionDoc },
    );

    // ── Market Understanding ──────────────────────────────────────────────
    // Primary: market_analysis or competitive_analysis completion.
    const marketDoc = docs.find((d) => d.type === 'market_analysis' || d.type === 'competitive_analysis');
    const marketUnderstanding = dim(
      'marketUnderstanding',
      marketDoc ? marketDoc.completionPercent : 0,
      marketDoc ? `${marketDoc.type} at ${marketDoc.completionPercent}%` : 'no market doc',
      { docType: marketDoc?.type ?? '', completion: marketDoc?.completionPercent ?? 0 },
    );

    // ── Product Definition ────────────────────────────────────────────────
    // prd takes priority over mvp_plan; mvp_plan is a proxy.
    const productDoc = docs.find((d) => d.type === 'prd') ?? docs.find((d) => d.type === 'mvp_plan');
    const productDefinition = dim(
      'productDefinition',
      productDoc ? productDoc.completionPercent : 0,
      productDoc ? `${productDoc.type} at ${productDoc.completionPercent}%` : 'no product doc',
      { docType: productDoc?.type ?? '', completion: productDoc?.completionPercent ?? 0 },
    );

    // ── Team Completeness ─────────────────────────────────────────────────
    // Formula: score = min(100, members × 20)
    //   1 member (solo) → 20, 2 → 40, 3 → 60, 4 → 80, 5+ → 100
    const memberCount = 1 + collaboratorCount;
    const teamCompleteness = dim(
      'teamCompleteness',
      Math.round(memberCount * 20),
      `${memberCount} workspace member(s)`,
      { memberCount, collaborators: collaboratorCount },
    );

    // ── Execution Readiness ───────────────────────────────────────────────
    // Formula: min(100, completedReviews × 30 + approvalRate × 40)
    //   Rewards both volume (≥3 approved reviews) and rate (high approval %).
    const completedReviews = reviewRows.filter((r) => r.status === 'approved').length;
    const totalReviews = reviewRows.length;
    const approvalRate = totalReviews > 0 ? completedReviews / totalReviews : 0;
    const executionReadiness = dim(
      'executionReadiness',
      Math.round(Math.min(100, completedReviews * 30 + approvalRate * 40)),
      `${completedReviews}/${totalReviews} reviews approved (${Math.round(approvalRate * 100)}% rate)`,
      { completedReviews, totalReviews, approvalRate: parseFloat(approvalRate.toFixed(2)) },
    );

    // ── Validation Score ──────────────────────────────────────────────────
    // Formula: min(100, feedbackCount × 12 + appliedRate × 52)
    //   feedbackCount saturates at ~4 rounds (48 pts); apply-rate provides up to 52 pts.
    const validationScore = dim(
      'validationScore',
      feedbackMetric
        ? Math.round(Math.min(100, feedbackMetric.feedbackCount * 12 + feedbackMetric.appliedFeedbackRate * 52))
        : 0,
      feedbackMetric
        ? `${feedbackMetric.feedbackCount} feedback rounds, ${Math.round(feedbackMetric.appliedFeedbackRate * 100)}% applied`
        : 'no mentor feedback yet',
      {
        feedbackCount: feedbackMetric?.feedbackCount ?? 0,
        appliedRate: feedbackMetric?.appliedFeedbackRate ?? 0,
      },
    );

    // ── Composite (weighted sum) ──────────────────────────────────────────
    const dims = {
      problemClarity, solutionClarity, marketUnderstanding, productDefinition,
      teamCompleteness, executionReadiness, validationScore, artifactCompleteness,
    };

    const rawComposite = Object.entries(dims).reduce(
      (sum, [key, val]) => sum + val * (READINESS_WEIGHTS[key] ?? 0),
      0,
    );

    // ── Bottleneck factor: Π min(1, dim / gate_floor) for gated dims ─────
    let bottleneckFactor = 1.0;
    for (const [gKey, gFloor] of Object.entries(READINESS_GATE_DIMS)) {
      const gScore = dims[gKey as keyof typeof dims] ?? 0;
      if (gScore < gFloor) {
        bottleneckFactor *= gScore / gFloor;
      }
    }
    bottleneckFactor = parseFloat(Math.max(0, bottleneckFactor).toFixed(4));

    const composite = Math.round(rawComposite * bottleneckFactor);

    // ── Upsert ────────────────────────────────────────────────────────────
    await this.prisma.gamificationReadinessScore.upsert({
      where: { workspaceId },
      create: { workspaceId, score: composite, ...dims, dimensionBreakdown: breakdown as object },
      update: { score: composite, ...dims, dimensionBreakdown: breakdown as object, updatedAt: new Date() },
    });

    return {
      workspaceId,
      score: composite,
      bottleneckFactor,
      dimensions: dims,
      dimensionBreakdown: breakdown,
      updatedAt: new Date(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 4 — STREAK SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Update streak for a user after a qualifying event.
   *
   * State machine (PART 7 — Streak Formula):
   *   gap = UTC_days(today − lastActiveDate)
   *
   *   gap === 0          → already recorded today, no-op
   *   gap === 1          → consecutive → currentStreak + 1
   *   gap === GRACE_DAYS AND graceUsedAt NULL
   *                      → grace window → currentStreak + 1, graceUsedAt = today
   *   otherwise          → soft-decay break:
   *                          newStreak = max(SOFT_DECAY_MIN, floor(current × SOFT_DECAY_FACTOR))
   *                          recoveryBase = newStreak
   *                          recoveryUntil = today + RECOVERY_WINDOW_DAYS
   *                          graceUsedAt = null (fresh grace for next run)
   *
   * Milestone bonuses: when crossing a milestone threshold (7/14/30/60/90 days)
   *   bonus XP is awarded via a BADGE_REWARD-style event to prevent double-award.
   */
  async updateStreak(userId: string): Promise<void> {
    const now        = new Date();
    const todayStart = utcDayStart(now);

    const existing = await this.prisma.streakRecord.findUnique({ where: { userId } });

    // ── New user ──────────────────────────────────────────────────────────
    if (!existing) {
      await this.prisma.streakRecord.create({
        data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: todayStart },
      });
      return;
    }

    const lastActive = existing.lastActiveDate ? utcDayStart(existing.lastActiveDate) : null;

    // Already recorded a qualifying event today — no-op
    if (lastActive && daysDiff(todayStart, lastActive) === 0) return;

    const gap = lastActive ? daysDiff(todayStart, lastActive) : 999;

    let newStreak     = existing.currentStreak;
    let newGraceUsedAt: Date | null = existing.graceUsedAt;
    let inRecovery    = false;

    if (gap === 1) {
      // ── Consecutive day ───────────────────────────────────────────────
      newStreak += 1;
      // Grace resets after a consecutive run
      if (existing.graceUsedAt) {
        const graceDays = daysDiff(todayStart, utcDayStart(existing.graceUsedAt));
        if (graceDays > STREAK_GRACE_DAYS + 1) newGraceUsedAt = null;
      }
    } else if (gap === STREAK_GRACE_DAYS && !existing.graceUsedAt) {
      // ── One-day gap — grace window ────────────────────────────────────
      newStreak   += 1;
      newGraceUsedAt = todayStart;
    } else {
      // ── Break — soft decay ────────────────────────────────────────────
      newStreak      = Math.max(
        STREAK_SOFT_DECAY_MIN,
        Math.floor(existing.currentStreak * STREAK_SOFT_DECAY_FACTOR),
      );
      newGraceUsedAt = null;  // fresh grace for the new run
      inRecovery     = true;
    }

    const prevStreak  = existing.currentStreak;
    const newLongest  = Math.max(newStreak, existing.longestStreak);

    await this.prisma.streakRecord.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActiveDate: todayStart,
        graceUsedAt: newGraceUsedAt,
      },
    });

    // ── Milestone bonus XP ────────────────────────────────────────────────
    // Award bonus only when crossing the milestone for the first time in this run
    if (!inRecovery) {
      for (const [milestoneStr, bonusXp] of Object.entries(STREAK_MILESTONE_BONUSES)) {
        const milestone = Number(milestoneStr);
        if (prevStreak < milestone && newStreak >= milestone) {
          const cooldownKey = `STREAK_MILESTONE:${milestone}:${userId}`;
          const alreadyAwarded = await this.prisma.xPEvent.findFirst({
            where: { userId, metadata: { path: ['cooldownKey'], equals: cooldownKey } },
          });
          if (!alreadyAwarded) {
            await this.prisma.xPEvent.create({
              data: {
                userId,
                eventType: 'STREAK_BONUS' as unknown as XPEventType,
                xpAmount: bonusXp,
                baseXp: bonusXp,
                metadata: { cooldownKey, milestone, streakDay: newStreak },
              },
            });
            this.logger.log(
              `Streak milestone ${milestone} reached by user=${userId} (+${bonusXp} XP)`,
            );
          }
          break;  // only one milestone can be crossed per event
        }
      }
    }

    if (inRecovery) {
      this.logger.debug(
        `Streak break for user=${userId}: ${existing.currentStreak}→${newStreak} (soft decay ×${STREAK_SOFT_DECAY_FACTOR}), recovery window ${STREAK_RECOVERY_WINDOW_DAYS}d`,
      );
    }
  }

  /** Return streak state for a user (read-only, no mutation). */
  async getStreak(
    userId: string,
  ): Promise<{ currentStreak: number; longestStreak: number; lastActiveDate: Date | null }> {
    const rec = await this.prisma.streakRecord.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true, lastActiveDate: true },
    });
    return {
      currentStreak: rec?.currentStreak ?? 0,
      longestStreak: rec?.longestStreak ?? 0,
      lastActiveDate: rec?.lastActiveDate ?? null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 5 — CONTRIBUTION SCORE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Recompute contribution score for a user within a workspace.
   *
   * Formula:
   *   ContributionRaw_u = Σ (W[factor] × (recentCount × 1.0 + olderCount × DECAY))
   *   where DECAY = CONTRIBUTION_RECENCY_DECAY = 0.4
   *   recentWindow = last 14 days
   *
   * Normalisation (role-fair, workspace-relative):
   *   score = 100 × raw_u / max(raw_v ∀v ∈ workspace)
   *   → top contributor always scores 100; others are proportional.
   *   Solo workspaces: score = min(100, round(raw / SOLO_SCALE × 100))
   *   SOLO_SCALE = 50 (reasonable single-founder max raw in 14d)
   */
  async updateContributionScore(
    userId: string,
    workspaceId: string,
  ): Promise<ContributionSummary> {
    const recent14dStart = new Date(Date.now() - 14 * 86_400_000);

    const allWorkspaceEvents = await this.prisma.xPEvent.findMany({
      where: { workspaceId },
      select: { userId: true, eventType: true, xpAmount: true, createdAt: true },
    });

    const computeRaw = (events: typeof allWorkspaceEvents): number => {
      const recent = events.filter((e) => e.createdAt >= recent14dStart);
      const older  = events.filter((e) => e.createdAt < recent14dStart);

      const count = (evs: typeof events, type: string) =>
        evs.filter((e) => e.eventType === type).length;
      const countAny = (evs: typeof events, types: string[]) =>
        evs.filter((e) => types.includes(e.eventType)).length;

      const rCreate = count(recent, 'CREATE_ARTIFACT')    * CONTRIBUTION_WEIGHTS.artifactsCreated;
      const rImprove= count(recent, 'IMPROVE_ARTIFACT')   * CONTRIBUTION_WEIGHTS.artifactsImproved;
      const rFbGiven= count(recent, 'PROVIDE_FEEDBACK')   * CONTRIBUTION_WEIGHTS.feedbackGiven;
      const rFbApply= count(recent, 'APPLY_FEEDBACK')     * CONTRIBUTION_WEIGHTS.feedbackApplied;
      const rCollab = countAny(recent, ['TEAM_CONTRIBUTION', 'INVITE_COLLABORATOR']) * CONTRIBUTION_WEIGHTS.collaborationActions;
      const rUsage  = count(recent, 'HIGH_QUALITY_CONTRIBUTION') * CONTRIBUTION_WEIGHTS.usageByTeam;

      const oCreate = count(older, 'CREATE_ARTIFACT')     * CONTRIBUTION_WEIGHTS.artifactsCreated;
      const oImprove= count(older, 'IMPROVE_ARTIFACT')    * CONTRIBUTION_WEIGHTS.artifactsImproved;
      const oFbGiven= count(older, 'PROVIDE_FEEDBACK')    * CONTRIBUTION_WEIGHTS.feedbackGiven;
      const oFbApply= count(older, 'APPLY_FEEDBACK')      * CONTRIBUTION_WEIGHTS.feedbackApplied;
      const oCollab = countAny(older, ['TEAM_CONTRIBUTION', 'INVITE_COLLABORATOR']) * CONTRIBUTION_WEIGHTS.collaborationActions;
      const oUsage  = count(older, 'HIGH_QUALITY_CONTRIBUTION') * CONTRIBUTION_WEIGHTS.usageByTeam;

      return (rCreate + rImprove + rFbGiven + rFbApply + rCollab + rUsage) +
             (oCreate + oImprove + oFbGiven + oFbApply + oCollab + oUsage) * CONTRIBUTION_RECENCY_DECAY;
    };

    const userEvents = allWorkspaceEvents.filter((e) => e.userId === userId);
    const rawScore   = computeRaw(userEvents);

    // Build breakdown for display
    const recentUserEvs = userEvents.filter((e) => e.createdAt >= recent14dStart);
    const breakdown: ContributionBreakdown = {
      artifactsCreated:       userEvents.filter((e) => e.eventType === 'CREATE_ARTIFACT').length,
      artifactsImproved:      userEvents.filter((e) => e.eventType === 'IMPROVE_ARTIFACT').length,
      feedbackGiven:          userEvents.filter((e) => e.eventType === 'PROVIDE_FEEDBACK').length,
      feedbackApplied:        userEvents.filter((e) => e.eventType === 'APPLY_FEEDBACK').length,
      collaborationActions:   userEvents.filter((e) => ['TEAM_CONTRIBUTION', 'INVITE_COLLABORATOR'].includes(e.eventType)).length,
      usageByTeam:            userEvents.filter((e) => e.eventType === 'HIGH_QUALITY_CONTRIBUTION').length,
      recentArtifactsCreated: recentUserEvs.filter((e) => e.eventType === 'CREATE_ARTIFACT').length,
      recentArtifactsImproved:recentUserEvs.filter((e) => e.eventType === 'IMPROVE_ARTIFACT').length,
      recentFeedbackApplied:  recentUserEvs.filter((e) => e.eventType === 'APPLY_FEEDBACK').length,
    };

    // Normalise against all contributors' raw scores
    const allUserIds = [...new Set(allWorkspaceEvents.map((e) => e.userId))];
    let maxRaw = rawScore;
    for (const uid of allUserIds) {
      if (uid === userId) continue;
      const raw = computeRaw(allWorkspaceEvents.filter((e) => e.userId === uid));
      if (raw > maxRaw) maxRaw = raw;
    }

    const SOLO_SCALE = 50;
    const score = allUserIds.length <= 1
      ? Math.min(100, Math.round((rawScore / SOLO_SCALE) * 100))
      : maxRaw > 0 ? Math.min(100, Math.round((rawScore / maxRaw) * 100)) : 0;

    const explain = `raw=${rawScore.toFixed(1)} / maxRaw=${maxRaw.toFixed(1)} → score=${score}`;

    const now = new Date();
    await this.prisma.contributionScore.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      create: { userId, workspaceId, score, breakdown: breakdown as object },
      update: { score, breakdown: breakdown as object, updatedAt: now },
    });

    return { userId, workspaceId, score, rawScore: parseFloat(rawScore.toFixed(2)), breakdown, explain, updatedAt: now };
  }

  /** Return all contributor scores for a workspace, sorted descending. */
  async getContributionScores(workspaceId: string): Promise<ContributionSummary[]> {
    const rows = await this.prisma.contributionScore.findMany({
      where: { workspaceId },
      orderBy: { score: 'desc' },
    });
    return rows.map((r) => ({
      userId:      r.userId,
      workspaceId: r.workspaceId,
      score:       r.score,
      rawScore:    0,
      breakdown:   (r.breakdown ?? {}) as unknown as ContributionBreakdown,
      explain:     `score=${r.score}`,
      updatedAt:   r.updatedAt,
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 6 — TEAM MOMENTUM SCORE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Recompute team momentum for a workspace.
   *
   * Formula:
   *   TeamMomentum = round(Σ MOMENTUM_WEIGHTS[k] × component_k) bounded [0,100]
   *
   * Components (all normalised 0–100):
   *   velocityScore      = min(100, (0.6×v7 + 0.4×v14) × VELOCITY_SCALE)
   *     v7  = meaningful_7d  / 7  (actions/day, high sensitivity)
   *     v14 = meaningful_14d / 14 (actions/day, trend)
   *     VELOCITY_SCALE=25 → full score at ≥4 meaningful actions/day
   *   recentActivityScore= min(100, Σ exp(-λ·age_d) × ACTIVITY_SCALE)
   *     λ = ln(2)/7 (half-life 7 days); ACTIVITY_SCALE=20 → 5 events=~100
   *   collabDensityScore = (events_by_2+_users / all_events) × 100
   *   feedbackLoopScore  = min(100, applied_feedback_events × FEEDBACK_LOOP_SCALE)
   *     FEEDBACK_LOOP_SCALE=25 → full score at 4 completed loops
   *   milestoneRateScore = (completed / total) × 100
   */
  async updateTeamMomentum(workspaceId: string): Promise<MomentumSummary> {
    const now        = Date.now();
    const window7    = new Date(now - 7  * 86_400_000);
    const window14   = new Date(now - 14 * 86_400_000);

    const meaningfulTypes = new Set<XPEventType>([
      'CREATE_ARTIFACT', 'COMPLETE_ARTIFACT', 'IMPROVE_ARTIFACT',
      'SYNTHESIZE_BOARD', 'APPLY_FEEDBACK', 'COMPLETE_MILESTONE', 'COMPLETE_REVIEW',
    ]);

    const [allRecentEvents, completedDocs, totalDocs] = await Promise.all([
      this.prisma.xPEvent.findMany({
        where: { workspaceId, createdAt: { gte: window14 } },
        select: { userId: true, eventType: true, createdAt: true },
      }),
      this.prisma.builderDocument.count({ where: { workspaceId, status: 'approved' } }),
      this.prisma.builderDocument.count({ where: { workspaceId } }),
    ]);

    const events14 = allRecentEvents;
    const events7  = allRecentEvents.filter((e) => e.createdAt >= window7);

    const meaningful14 = events14.filter((e) => meaningfulTypes.has(e.eventType));
    const meaningful7  = events7.filter((e) => meaningfulTypes.has(e.eventType));

    // ── Velocity score ────────────────────────────────────────────────────
    const v7  = meaningful7.length  / 7;
    const v14 = meaningful14.length / 14;
    const velocityRaw   = 0.6 * v7 + 0.4 * v14;
    const velocityScore = Math.min(100, Math.round(velocityRaw * VELOCITY_SCALE));

    // ── Recent activity score (exponential half-life decay) ───────────────
    const raRaw = events14.reduce((sum, e) => {
      const ageDays = (now - e.createdAt.getTime()) / 86_400_000;
      return sum + Math.exp(-MOMENTUM_DECAY_LAMBDA * ageDays);
    }, 0);
    const recentActivityScore = Math.min(100, Math.round(raRaw * ACTIVITY_SCALE));

    // ── Collaboration density score ───────────────────────────────────────
    const uniqueContributors = new Set(events14.map((e) => e.userId)).size;
    let collabDensityScore = 0;
    if (events14.length > 0 && uniqueContributors >= 2) {
      const soloUserId = events14[0].userId;
      const multiUserEvents = events14.filter((e) => e.userId !== soloUserId);
      collabDensityScore = Math.min(100,
        Math.round((multiUserEvents.length / events14.length) * 100));
    }

    // ── Feedback loop score ───────────────────────────────────────────────
    const feedbackLoopsCompleted = events14.filter((e) => e.eventType === 'APPLY_FEEDBACK').length;
    const feedbackLoopScore = Math.min(100, Math.round(feedbackLoopsCompleted * FEEDBACK_LOOP_SCALE));

    // ── Milestone rate score ──────────────────────────────────────────────
    const milestoneCompletionRate = totalDocs > 0 ? completedDocs / totalDocs : 0;
    const milestoneRateScore = Math.round(milestoneCompletionRate * 100);

    // ── Composite (MOMENTUM_WEIGHTS weighted sum) ─────────────────────────
    const score = Math.min(100, Math.round(
      MOMENTUM_WEIGHTS.velocity       * velocityScore      +
      MOMENTUM_WEIGHTS.collabDensity  * collabDensityScore +
      MOMENTUM_WEIGHTS.recentActivity * recentActivityScore+
      MOMENTUM_WEIGHTS.feedbackLoops  * feedbackLoopScore  +
      MOMENTUM_WEIGHTS.milestoneRate  * milestoneRateScore,
    ));

    // Convenience alias for API consumers
    const velocity           = parseFloat(velocityRaw.toFixed(3));
    const collaborationDensity = parseFloat((collabDensityScore / 100).toFixed(2));

    const breakdown: MomentumBreakdown = {
      activeContributors:    uniqueContributors,
      recentMeaningfulActions: meaningful14.length,
      meaningful7d:          meaningful7.length,
      meaningful14d:         meaningful14.length,
      velocityScore,
      recentActivityScore,
      collaborationDensityScore: collabDensityScore,
      feedbackLoopScore,
      milestoneRateScore,
      artifactProgressEvents: events14.filter((e) =>
        ['CREATE_ARTIFACT','IMPROVE_ARTIFACT','COMPLETE_ARTIFACT'].includes(e.eventType),
      ).length,
      feedbackLoopsCompleted,
      milestoneCompletionRate: parseFloat(milestoneCompletionRate.toFixed(2)),
      momentumLevel: classifyMomentum(score),
    };

    const ts = new Date();
    await this.prisma.teamMomentumScore.upsert({
      where: { workspaceId },
      create: { workspaceId, score, velocity, recentActivityScore, collaborationDensity, breakdown: breakdown as object },
      update: { score, velocity, recentActivityScore, collaborationDensity, breakdown: breakdown as object, updatedAt: ts },
    });

    return { workspaceId, score, velocity, recentActivityScore, collaborationDensity, breakdown, updatedAt: ts };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 7 — MENTOR FEEDBACK LOOP METRICS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Process and persist mentor feedback loop metrics for a workspace.
   *
   * Formula:
   *   improvementScore = round(Σ MENTOR_WEIGHTS[k] × component_k × 100)
   *
   * Components:
   *   applyRate   = applied / max(received, 1)               ∈ [0, 1]
   *   speedScore  = max(0, 1 − avgResponseHrs / MAX_HRS)     ∈ [0, 1]
   *     MAX_HRS = MENTOR_MAX_RESPONSE_HRS (168 = 1 week)
   *   depthScore  = min(1, received / MENTOR_DEPTH_SATURATION)∈ [0, 1]
   *     saturates at MENTOR_DEPTH_SATURATION (5 feedback rounds)
   *   burdenScore = 1 − (unresolved / max(received, 1))      ∈ [0, 1]
   *     unresolved = max(0, received − applied)
   *
   * Weights: applyRate=0.40, speed=0.30, depth=0.20, burden=0.10
   */
  async processMentorFeedbackMetrics(
    workspaceId: string,
  ): Promise<MentorMetricsSummary> {
    const events = await this.prisma.xPEvent.findMany({
      where: { workspaceId, eventType: { in: ['RECEIVE_MENTOR_FEEDBACK', 'APPLY_FEEDBACK'] } },
      orderBy: { createdAt: 'asc' },
      select: { eventType: true, createdAt: true, userId: true },
    });

    const receivedEvents = events.filter((e) => e.eventType === 'RECEIVE_MENTOR_FEEDBACK');
    const appliedEvents  = events.filter((e) => e.eventType === 'APPLY_FEEDBACK');

    const feedbackCount        = receivedEvents.length;
    const appliedFeedbackCount = appliedEvents.length;

    // ── Apply rate ────────────────────────────────────────────────────────
    const applyRate = feedbackCount > 0
      ? Math.min(1, appliedFeedbackCount / feedbackCount)
      : 0;
    const appliedFeedbackRate = parseFloat(applyRate.toFixed(3));

    // ── Average response time (nearest APPLY after each RECEIVE) ─────────
    let totalResponseMs = 0;
    let pairedCount = 0;
    for (const recv of receivedEvents) {
      const nextApply = appliedEvents.find(
        (a) => a.createdAt.getTime() > recv.createdAt.getTime(),
      );
      if (nextApply) {
        totalResponseMs += nextApply.createdAt.getTime() - recv.createdAt.getTime();
        pairedCount++;
      }
    }
    const avgResponseTimeHrs = pairedCount > 0
      ? parseFloat((totalResponseMs / pairedCount / 3_600_000).toFixed(1))
      : 0;

    // ── Component scores ──────────────────────────────────────────────────
    const speedScore = avgResponseTimeHrs > 0
      ? Math.max(0, 1 - avgResponseTimeHrs / MENTOR_MAX_RESPONSE_HRS)
      : (feedbackCount > 0 ? 1 : 0);  // same-session apply = max speed

    const depthScore = Math.min(1, feedbackCount / MENTOR_DEPTH_SATURATION);

    const unresolved   = Math.max(0, feedbackCount - appliedFeedbackCount);
    const burdenScore  = 1 - (feedbackCount > 0 ? unresolved / feedbackCount : 0);

    // ── Composite improvement score ───────────────────────────────────────
    const improvementScore = Math.min(100, Math.round(
      MENTOR_WEIGHTS.applyRate  * applyRate   * 100 +
      MENTOR_WEIGHTS.speedScore * speedScore  * 100 +
      MENTOR_WEIGHTS.depthScore * depthScore  * 100 +
      MENTOR_WEIGHTS.burden     * burdenScore * 100,
    ));

    const lastFeedbackAt = receivedEvents.length > 0
      ? receivedEvents[receivedEvents.length - 1].createdAt
      : null;

    const now = new Date();
    await this.prisma.mentorFeedbackMetric.upsert({
      where: { workspaceId },
      create: { workspaceId, feedbackCount, appliedFeedbackCount, appliedFeedbackRate,
                avgResponseTimeHrs, improvementScore, lastFeedbackAt },
      update: { feedbackCount, appliedFeedbackCount, appliedFeedbackRate,
                avgResponseTimeHrs, improvementScore, lastFeedbackAt, updatedAt: now },
    });

    return {
      workspaceId,
      feedbackCount,
      appliedFeedbackCount,
      unresolvedFeedback: unresolved,
      appliedFeedbackRate,
      avgResponseTimeHrs,
      speedScore: parseFloat(speedScore.toFixed(3)),
      depthScore: parseFloat(depthScore.toFixed(3)),
      burdenScore: parseFloat(burdenScore.toFixed(3)),
      improvementScore,
      lastFeedbackAt,
      updatedAt: now,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ-ONLY GETTERS (for controller)
  // ══════════════════════════════════════════════════════════════════════════

  async getReadinessScore(workspaceId: string): Promise<ReadinessSummary | null> {
    const row = await this.prisma.gamificationReadinessScore.findUnique({ where: { workspaceId } });
    if (!row) return null;
    const breakdown = (row.dimensionBreakdown ?? {}) as unknown as Record<string, DimensionDetail>;
    return {
      workspaceId: row.workspaceId,
      score: row.score,
      bottleneckFactor: 1.0,  // live value only set during calculate; stored value approximated
      dimensions: {
        problemClarity:      row.problemClarity,
        solutionClarity:     row.solutionClarity,
        marketUnderstanding: row.marketUnderstanding,
        productDefinition:   row.productDefinition,
        teamCompleteness:    row.teamCompleteness,
        executionReadiness:  row.executionReadiness,
        validationScore:     row.validationScore,
        artifactCompleteness:row.artifactCompleteness,
      },
      dimensionBreakdown: breakdown,
      updatedAt: row.updatedAt,
    };
  }

  async getMomentumScore(workspaceId: string): Promise<MomentumSummary | null> {
    const row = await this.prisma.teamMomentumScore.findUnique({ where: { workspaceId } });
    if (!row) return null;
    return {
      workspaceId:          row.workspaceId,
      score:                row.score,
      velocity:             row.velocity,
      recentActivityScore:  row.recentActivityScore,
      collaborationDensity: row.collaborationDensity,
      breakdown:            (row.breakdown ?? {}) as unknown as MomentumBreakdown,
      updatedAt:            row.updatedAt,
    };
  }

  async getMentorMetrics(workspaceId: string): Promise<MentorMetricsSummary | null> {
    const row = await this.prisma.mentorFeedbackMetric.findUnique({ where: { workspaceId } });
    if (!row) return null;
    const unresolved = Math.max(0, row.feedbackCount - row.appliedFeedbackCount);
    const speedScore = row.avgResponseTimeHrs > 0
      ? Math.max(0, 1 - row.avgResponseTimeHrs / MENTOR_MAX_RESPONSE_HRS) : 0;
    return {
      workspaceId:          row.workspaceId,
      feedbackCount:        row.feedbackCount,
      appliedFeedbackCount: row.appliedFeedbackCount,
      unresolvedFeedback:   unresolved,
      appliedFeedbackRate:  row.appliedFeedbackRate,
      avgResponseTimeHrs:   row.avgResponseTimeHrs,
      speedScore:           parseFloat(speedScore.toFixed(3)),
      depthScore:           parseFloat(Math.min(1, row.feedbackCount / MENTOR_DEPTH_SATURATION).toFixed(3)),
      burdenScore:          parseFloat((row.feedbackCount > 0 ? 1 - unresolved / row.feedbackCount : 0).toFixed(3)),
      improvementScore:     row.improvementScore,
      lastFeedbackAt:       row.lastFeedbackAt,
      updatedAt:            row.updatedAt,
    };
  }

  /**
   * Force-refresh all workspace-scoped metrics in one call.
   * Used by the controller's manual refresh endpoint.
   */
  async refreshWorkspaceMetrics(workspaceId: string): Promise<{
    readiness: ReadinessSummary;
    momentum: MomentumSummary;
    mentorMetrics: MentorMetricsSummary;
  }> {
    const [readiness, momentum, mentorMetrics] = await Promise.all([
      this.calculateReadinessScore(workspaceId),
      this.updateTeamMomentum(workspaceId),
      this.processMentorFeedbackMetrics(workspaceId),
    ]);
    return { readiness, momentum, mentorMetrics };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 9 — BURST ABUSE DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if the user is currently in an active burst-suppression window.
   * Also triggers suppression when the burst threshold is first crossed.
   *
   * Burst detection:
   *   Count events fired by the user in the last ABUSE_BURST_WINDOW_MINS.
   *   If count > ABUSE_BURST_MAX_EVENTS → mark user as suppressed for ABUSE_SUPPRESS_HOURS.
   *   Suppression marker: XPEvent with metadata.suppressedUntil = ISO timestamp.
   */
  private async checkBurstAbuse(userId: string): Promise<boolean> {
    // Check for existing active suppression (uses cooldownKey for efficient lookup)
    const suppressionMarker = await this.prisma.xPEvent.findFirst({
      where: {
        userId,
        cooldownKey: `BURST_SUPPRESSION:${userId}`,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (suppressionMarker) {
      const meta = suppressionMarker.metadata as Record<string, unknown> | null;
      const suppressedUntil = meta?.suppressedUntil ? new Date(meta.suppressedUntil as string) : null;
      if (suppressedUntil && suppressedUntil > new Date()) {
        return true;
      }
    }

    // Count events in burst window
    const burstWindowStart = new Date(Date.now() - ABUSE_BURST_WINDOW_MINS * 60_000);
    const recentCount = await this.prisma.xPEvent.count({
      where: { userId, createdAt: { gte: burstWindowStart } },
    });

    if (recentCount > ABUSE_BURST_MAX_EVENTS) {
      const suppressedUntil = new Date(Date.now() + ABUSE_SUPPRESS_HOURS * 3_600_000);
      await this.prisma.xPEvent.create({
        data: {
          userId,
          eventType: 'VALIDATED_PROGRESS' as XPEventType,
          xpAmount: 0,
          baseXp: 0,
          weightMultiplier: 0,
          isDiminished: false,
          cooldownKey: `BURST_SUPPRESSION:${userId}`,
          metadata: {
            suppressedUntil: suppressedUntil.toISOString(),
            burstCount: recentCount,
            windowMins: ABUSE_BURST_WINDOW_MINS,
          },
        },
      });
      this.logger.warn(
        `Burst abuse detected: user=${userId} fired ${recentCount} events in ${ABUSE_BURST_WINDOW_MINS}min. Suppressed for ${ABUSE_SUPPRESS_HOURS}h.`,
      );
      return true;
    }

    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 8 — ROLE-AWARE CONTRIBUTION PERCENTILE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the role-normalised percentile rank (0–100) of a user's contribution
   * score within their role group in the workspace.
   *
   * Formula:
   *   sortedScores = rawScores of all GROUP members in workspace, ascending
   *   percentile   = count(scores ≤ userRaw) / total × 100
   *
   * Falls back to workspace-wide percentile if cohort < PERCENTILE_MIN_COHORT.
   * Falls back to rawScore / SOLO_SCALE if workspace has only 1 member.
   */
  async getContributionPercentile(
    userId: string,
    workspaceId: string,
  ): Promise<{ percentile: number; cohortSize: number; roleGroup: string }> {
    const userScore = await this.prisma.contributionScore.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!userScore) return { percentile: 0, cohortSize: 0, roleGroup: 'OTHER' };

    // Resolve role group for this user in this workspace
    const member = await this.prisma.builderCollaborator.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });
    const roleStr = (member?.role as string ?? '').toLowerCase();
    const roleGroup = ROLE_GROUP_MAP[roleStr] ?? 'OTHER';

    // Fetch all contribution scores in workspace
    const allScores = await this.prisma.contributionScore.findMany({
      where: { workspaceId },
      select: { userId: true, score: true },
    });

    if (allScores.length <= 1) {
      const percentile = Math.min(100, Math.round((userScore.score / SOLO_SCALE) * 100));
      return { percentile, cohortSize: 1, roleGroup };
    }

    // Filter to same role group if cohort is large enough
    const sameGroupIds = await (async () => {
      const members = await this.prisma.builderCollaborator.findMany({
        where: { workspaceId },
        select: { userId: true, role: true },
      });
      return new Set(
        members
          .filter((m) => (ROLE_GROUP_MAP[(m.role as string ?? '').toLowerCase()] ?? 'OTHER') === roleGroup)
          .map((m) => m.userId),
      );
    })();

    const cohortScores = sameGroupIds.size >= PERCENTILE_MIN_COHORT
      ? allScores.filter((s) => sameGroupIds.has(s.userId))
      : allScores;

    const sorted = cohortScores.map((s) => s.score).sort((a, b) => a - b);
    const countBelow = sorted.filter((s) => s <= userScore.score).length;
    const percentile = Math.round((countBelow / sorted.length) * 100);

    return { percentile, cohortSize: sorted.length, roleGroup };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 10 — EXPLAINABILITY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Builds a comprehensive, human-readable explanation of a user's current scores.
   * Bundles XP, streak, readiness, contribution, momentum, and mentor metrics
   * into a single DTO with a humanSummary string for dashboard display.
   */
  async getScoreExplain(userId: string, workspaceId?: string): Promise<ScoreExplainDTO> {
    // ── XP ────────────────────────────────────────────────────────────────
    const events = await this.prisma.xPEvent.findMany({
      where: { userId, xpAmount: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const totalXp = events.reduce((s, e) => s + e.xpAmount, 0);
    const levelInfo = computeLevel(totalXp);

    const recentEvents: XPEventExplain[] = events.slice(0, 10).map((e) => {
      const meta = (e.metadata as Record<string, unknown> | null) ?? {};
      const explainParts: string[] = [`base=${e.baseXp}`];
      if (e.isDiminished) explainParts.push(`DR reduced`);
      if (e.weightMultiplier !== 1.0) explainParts.push(`×${e.weightMultiplier.toFixed(2)}`);
      explainParts.push(`→${e.xpAmount}XP`);
      return {
        id:                    e.id,
        eventType:             e.eventType,
        baseXp:                e.baseXp,
        effectiveXp:           e.xpAmount,
        qualityMultiplier:     e.weightMultiplier,
        collaborationMultiplier: 1.0,
        diminished:            e.isDiminished,
        blocked:               false,
        cooldownKey:           e.cooldownKey,
        explain:               explainParts.join(' '),
        createdAt:             e.createdAt,
      } satisfies XPEventExplain;
    });

    // ── Streak ────────────────────────────────────────────────────────────
    const streakRec = await this.prisma.streakRecord.findUnique({ where: { userId } });
    const currentStreak = streakRec?.currentStreak ?? 0;
    const milestones = Object.keys(STREAK_MILESTONE_BONUSES).map(Number).sort((a, b) => a - b);
    const nextMilestone = milestones.find((m) => m > currentStreak) ?? null;

    const streak: StreakExplain = {
      currentStreak,
      longestStreak:  streakRec?.longestStreak ?? 0,
      lastActiveDate: streakRec?.lastActiveDate ?? null,
      graceUsedAt:    streakRec?.graceUsedAt ?? null,
      inRecovery:     false,
      nextMilestone,
      xpToNextMilestone: nextMilestone
        ? STREAK_MILESTONE_BONUSES[nextMilestone] ?? null
        : null,
    };

    // ── Workspace scores ──────────────────────────────────────────────────
    const [readiness, momentum, mentorMetrics] = await Promise.all([
      workspaceId ? this.getReadinessScore(workspaceId) : Promise.resolve(null),
      workspaceId ? this.getMomentumScore(workspaceId) : Promise.resolve(null),
      workspaceId ? this.getMentorMetrics(workspaceId) : Promise.resolve(null),
    ]);

    const contribution = workspaceId
      ? await this.getContributionScores(workspaceId).then(
          (scores) => scores.find((s) => s.userId === userId) ?? null,
        )
      : null;

    // ── Human summary ─────────────────────────────────────────────────────
    const parts: string[] = [
      `Level ${levelInfo.level} (${levelInfo.label}) · ${totalXp} XP total`,
      `${currentStreak}-day streak`,
    ];
    if (readiness) parts.push(`Readiness ${readiness.score}/100`);
    if (contribution) parts.push(`Contribution ${contribution.score}/100`);
    if (momentum) parts.push(`Team momentum ${momentum.score}/100 (${(momentum.breakdown as MomentumBreakdown).momentumLevel})`);
    const humanSummary = parts.join(' · ');

    return {
      userId,
      workspaceId,
      generatedAt: new Date(),
      xp: {
        total:          totalXp,
        level:          levelInfo.level,
        levelLabel:     levelInfo.label,
        xpToNextLevel:  levelInfo.xpToNextLevel,
        levelProgress:  levelInfo.levelProgress,
        recentEvents,
      },
      streak,
      readiness:    readiness ?? null,
      contribution: contribution ?? null,
      momentum:     momentum ?? null,
      mentorMetrics: mentorMetrics ?? null,
      humanSummary,
    };
  }
}
