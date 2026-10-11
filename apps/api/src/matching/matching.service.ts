import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { OPEN_TO_COPY, openToBoost, openToShownTo, seekerWants, isHiddenFromSearch } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { OpenToService } from '../open-to/open-to.service';

export interface MatchingCriteria {
  userId: string;
  role?: 'founder' | 'mentor' | 'investor' | 'org';
  skills?: string[];
  location?: string;
  remote?: boolean;
  industry?: string;
  stage?: string;
  commitment?: string;
  maxDistance?: number;
  modelVersion?: string;
}

export interface ScoreBreakdown {
  role: number;
  skills: number;
  location: number;
  industry: number;
  semantic: number;
  behavioral: number;
  outcomePrior: number;
  total: number;
}

export interface MatchExplanation {
  dimension: string;
  label: string;
  weight: number;
  score: number;
}

export interface MatchScore {
  userId: string;
  score: number;
  confidence: number;
  reasons: string[];
  explanation: MatchExplanation[];
  breakdown: ScoreBreakdown;
  profile: any;
}

export interface MatchingResult {
  matches: MatchScore[];
  total: number;
  criteria: MatchingCriteria;
  generatedAt: Date;
}

// ── Default model weights (Stage 1: hybrid rule + semantic) ──────────────────
const DEFAULT_WEIGHTS = {
  role: 0.35,
  skills: 0.22,
  location: 0.12,
  industry: 0.11,
  semantic: 0.10,
  behavioral: 0.06,
  outcomePrior: 0.04,
};

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() @Inject(OpenToService) private readonly openTo?: Pick<OpenToService, 'activeSignals' | 'isVerified'>,
  ) {}

  // ── Public: generate matches ───────────────────────────────────────────────

  async generateMatches(criteria: MatchingCriteria): Promise<MatchingResult> {
    const cacheKey = `matches:v2:${criteria.userId}:${criteria.role ?? 'any'}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id: criteria.userId },
        include: { profile: { include: { skills: { include: { skill: true } } } } },
      });
      if (!user) throw new Error('User not found');

      const weights = await this.getActiveWeights(criteria.modelVersion);
      const [potentialMatches, userVector, outcomeMap, behavioralMap] = await Promise.all([
        this.getPotentialMatches(criteria),
        this.getOrBuildFeatureVector(user),
        this.getOutcomePriorMap(criteria.userId),
        this.getBehavioralMap(criteria.userId),
      ]);

      const scoredMatches = await Promise.all(
        potentialMatches.map(candidate =>
          this.calculateMatchScore(user, userVector, candidate, criteria, weights, outcomeMap, behavioralMap)
        )
      );

      await this.applyOpenTo(user, scoredMatches);

      const validMatches = scoredMatches
        .filter(m => m.score > 0.25)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      // Log inferences in background
      this.logInferences(criteria.userId, validMatches, criteria.modelVersion ?? '1.0').catch(() => {});

      return { matches: validMatches, total: validMatches.length, criteria, generatedAt: new Date() };
    }, { ttl: 3600 });
  }

  async getRecommendations(userId: string, limit = 10): Promise<MatchScore[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { skills: { include: { skill: true } } } } },
    });
    if (!user) throw new Error('User not found');

    const criteria: MatchingCriteria = {
      userId,
      role: this.getComplementaryRole(user.role) as MatchingCriteria['role'],
      location: user.profile?.location ?? undefined,
      remote: true,
    };
    const result = await this.generateMatches(criteria);
    return result.matches.slice(0, limit);
  }

  // ── Feedback ───────────────────────────────────────────────────────────────

  async recordFeedback(params: {
    sourceUserId: string;
    targetUserId: string;
    feedback: string;
    connectionStarted?: boolean;
    conversationStarted?: boolean;
  }): Promise<void> {
    await this.prisma.matchOutcome.upsert({
      where: { sourceUserId_targetUserId: { sourceUserId: params.sourceUserId, targetUserId: params.targetUserId } },
      create: {
        sourceUserId: params.sourceUserId,
        targetUserId: params.targetUserId,
        feedback: params.feedback as any,
        connectionStarted: params.connectionStarted ?? false,
        conversationStarted: params.conversationStarted ?? false,
      },
      update: {
        feedback: params.feedback as any,
        connectionStarted: params.connectionStarted ?? false,
        conversationStarted: params.conversationStarted ?? false,
      },
    });

    // Record behavioral signal
    await this.recordBehavioralSignal(params.sourceUserId, 'match_feedback', params.targetUserId, 'user',
      params.feedback === 'accepted' ? 2.0 : params.feedback === 'declined' ? -1.0 : 0.5);

    // Invalidate cache
    await this.cache.invalidateByTag(`matches:v2:${params.sourceUserId}`);
  }

  async recordBehavioralSignal(
    userId: string,
    signalType: string,
    targetId?: string,
    targetType?: string,
    value = 1.0,
  ): Promise<void> {
    await this.prisma.userBehaviorSignal.create({
      data: { userId, signalType, targetId, targetType, value },
    });
    // Invalidate feature vector cache so it rebuilds with new signals
    await this.cache.del(`fv:${userId}`);
  }

  // ── Legacy: backward-compatible feedback method ────────────────────────────

  async updateMatchingFeedback(userId: string, matchUserId: string, feedback: 'positive' | 'negative'): Promise<void> {
    await this.recordFeedback({
      sourceUserId: userId,
      targetUserId: matchUserId,
      feedback: feedback === 'positive' ? 'accepted' : 'declined',
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getMatchingStats(userId: string): Promise<any> {
    // Use targeted count queries instead of loading ALL connection rows
    const [
      sentPending,
      sentTotal,
      sentAccepted,
      receivedPending,
      receivedTotal,
      receivedAccepted,
      outcomes,
      signals,
    ] = await Promise.all([
      this.prisma.connectionRequest.count({ where: { requesterId: userId, status: 'pending' } }),
      this.prisma.connectionRequest.count({ where: { requesterId: userId } }),
      this.prisma.connectionRequest.count({ where: { requesterId: userId, status: 'accepted' } }),
      this.prisma.connectionRequest.count({ where: { receiverId: userId, status: 'pending' } }),
      this.prisma.connectionRequest.count({ where: { receiverId: userId } }),
      this.prisma.connectionRequest.count({ where: { receiverId: userId, status: 'accepted' } }),
      this.prisma.matchOutcome.findMany({ where: { sourceUserId: userId }, select: { feedback: true } }),
      this.prisma.userBehaviorSignal.count({ where: { userId } }),
    ]);

    const totalConnections = sentAccepted + receivedAccepted;
    const positiveOutcomes = outcomes.filter(o => ['accepted', 'connection_started'].includes(o.feedback)).length;

    return {
      sentRequests: sentPending,
      receivedRequests: receivedPending,
      totalConnections,
      acceptanceRate: sentTotal > 0 ? (sentAccepted / sentTotal) * 100 : 0,
      responseRate: receivedTotal > 0 ? (receivedAccepted / receivedTotal) * 100 : 0,
      matchOutcomes: outcomes.length,
      positiveOutcomeRate: outcomes.length > 0 ? (positiveOutcomes / outcomes.length) * 100 : 0,
      behavioralSignals: signals,
    };
  }

  async getAdminStats(): Promise<any> {
    const [totalMatches, activeModel, experiments] = await Promise.all([
      this.prisma.matchInferenceLog.count(),
      this.prisma.matchModelVersion.findFirst({ where: { isActive: true } }),
      this.prisma.matchExperiment.findMany({ where: { status: 'running' } }),
    ]);

    const outcomes = await this.prisma.matchOutcome.groupBy({
      by: ['feedback'],
      _count: true,
    });

    return { totalMatches, activeModel, runningExperiments: experiments.length, outcomes };
  }

  // ── Detailed VS breakdown (Match Detail Page) ──────────────────────────────

  async getDetailedVs(sourceUserId: string, targetUserId: string): Promise<any> {
    const include = { profile: { include: { skills: { include: { skill: true } } } } };
    const [source, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: sourceUserId }, include }),
      this.prisma.user.findUnique({ where: { id: targetUserId }, include }),
    ]);
    if (!source || !target) throw new Error('User not found');

    const [sourceVec, targetVec, weights, outcomeMap, behavioralMap] = await Promise.all([
      this.getOrBuildFeatureVector(source),
      this.getOrBuildFeatureVector(target),
      this.getActiveWeights(),
      this.getOutcomePriorMap(sourceUserId),
      this.getBehavioralMap(sourceUserId),
    ]);

    const matchScore = await this.calculateMatchScore(
      source, sourceVec, target, { userId: sourceUserId, remote: true },
      weights, outcomeMap, behavioralMap,
    );

    // ── Shared strengths: overlapping skills + keyword themes ────────────────
    const sourceSkillNames = (source.profile?.skills ?? []).map((s: any) => s.skill?.name ?? '');
    const targetSkillNames = (target.profile?.skills ?? []).map((s: any) => s.skill?.name ?? '');
    const sharedSkills = sourceSkillNames.filter((n: string) => targetSkillNames.includes(n));

    const sourceKws = new Set<string>([
      ...((sourceVec.bioKeywords as string[]) ?? []),
      ...((sourceVec.goalKeywords as string[]) ?? []),
    ]);
    const targetKws = new Set<string>([
      ...((targetVec.bioKeywords as string[]) ?? []),
      ...((targetVec.goalKeywords as string[]) ?? []),
    ]);
    const sharedKeywords = [...sourceKws].filter(k => targetKws.has(k)).slice(0, 6);

    const strengthsFromSkills = sharedSkills.slice(0, 4).map((name: string) => ({ icon: 'terminal', label: name }));
    const strengthsFromKws = sharedKeywords.slice(0, 4 - strengthsFromSkills.length).map((kw: string) => ({
      icon: 'lightbulb', label: kw.charAt(0).toUpperCase() + kw.slice(1),
    }));
    const sharedStrengths = [...strengthsFromSkills, ...strengthsFromKws];

    // ── Compatibility badges ─────────────────────────────────────────────────
    const badges: string[] = [];
    if (matchScore.breakdown.semantic > 0.65) badges.push('High Vision Alignment');
    if (matchScore.breakdown.role > 0.8) badges.push('Strong Role Complement');
    if (matchScore.breakdown.skills > 0.7) badges.push('Execution Match');
    if (matchScore.breakdown.location > 0.8) badges.push('Same Ecosystem');
    if (matchScore.breakdown.industry > 0.75) badges.push('Industry Fit');
    if (matchScore.breakdown.behavioral > 0.7) badges.push('Highly Active');
    if (badges.length === 0) badges.push('Potential Match');

    // ── Friction points ──────────────────────────────────────────────────────
    const frictionPoints: Array<{ icon: string; title: string; description: string }> = [];
    const sourceLoc = source.profile?.location;
    const targetLoc = target.profile?.location;
    if (sourceLoc && targetLoc && sourceLoc !== targetLoc && matchScore.breakdown.location < 0.6) {
      frictionPoints.push({
        icon: 'schedule',
        title: 'Location Difference',
        description: `${sourceLoc} vs ${targetLoc}. Remote coordination may require structured async communication.`,
      });
    }
    const sP = (source.profile?.rolePayload as any);
    const tP = (target.profile?.rolePayload as any);
    if (sP?.stage && tP?.stage && sP.stage !== tP.stage) {
      frictionPoints.push({
        icon: 'trending_up',
        title: 'Stage Expectation Gap',
        description: `One party is at ${sP.stage} stage, the other at ${tP.stage}. Align on milestone priorities early.`,
      });
    }
    const sourceTech = sourceSkillNames.some((n: string) => ['technical', 'engineering', 'developer', 'software'].some(t => n.toLowerCase().includes(t)));
    const targetTech = targetSkillNames.some((n: string) => ['technical', 'engineering', 'developer', 'software'].some(t => n.toLowerCase().includes(t)));
    if (sourceTech && targetTech) {
      frictionPoints.push({
        icon: 'warning_amber',
        title: 'Technical Role Overlap',
        description: 'Both profiles are primarily technical. Consider how business, sales, and growth responsibilities will be covered.',
      });
    }
    if (sP?.commitment && tP?.commitment && sP.commitment !== tP.commitment) {
      frictionPoints.push({
        icon: 'hourglass_empty',
        title: 'Commitment Difference',
        description: `Availability mismatch (${sP.commitment} vs ${tP.commitment}). Establish shared expectations on hours and milestones.`,
      });
    }

    // ── Work style comparison data (5-axis: Risk, Speed, Vision, Technical, Social) ────
    const workStyleAxes = ['Risk', 'Speed', 'Vision', 'Technical', 'Social'];
    const extractWorkStyle = (user: any, vec: any): number[] => {
      const p = user.profile?.rolePayload as any;
      const risk = p?.riskTolerance === 'high' ? 85 : p?.riskTolerance === 'medium' ? 55 : 30;
      const speed = p?.commitment === 'full_time' ? 90 : p?.commitment === 'part_time' ? 55 : 40;
      const vision = Math.round((vec.goalKeywords?.length ?? 0) / 20 * 100);
      const skillNames = (user.profile?.skills ?? []).map((s: any) => (s.skill?.name ?? '').toLowerCase());
      const techScore = Math.min(100, skillNames.filter((n: string) => ['code', 'engineer', 'data', 'tech', 'dev'].some(t => n.includes(t))).length * 25);
      const social = Math.round(Math.min(100, (vec.activityScore ?? 0.5) * 100));
      return [risk, speed, Math.max(20, Math.min(100, vision)), techScore, social];
    };

    return {
      overall: { score: Math.round(matchScore.score * 100), confidence: Math.round(matchScore.confidence * 100) },
      breakdown: [
        { key: 'role', label: 'Role Complementarity', score: Math.round(matchScore.breakdown.role * 100), color: '#4ADE80' },
        { key: 'skills', label: 'Skills & Expertise', score: Math.round(matchScore.breakdown.skills * 100), color: '#22D3EE' },
        { key: 'semantic', label: 'Vision & Goals', score: Math.round(matchScore.breakdown.semantic * 100), color: '#F472B6' },
        { key: 'industry', label: 'Industry Alignment', score: Math.round(matchScore.breakdown.industry * 100), color: '#FB923C' },
        { key: 'location', label: 'Location Fit', score: Math.round(matchScore.breakdown.location * 100), color: '#A78BFA' },
        { key: 'behavioral', label: 'Platform Activity', score: Math.round(matchScore.breakdown.behavioral * 100), color: '#34D399' },
      ],
      badges: badges.slice(0, 3),
      sharedStrengths,
      frictionPoints: frictionPoints.slice(0, 3),
      workStyle: {
        axes: workStyleAxes,
        source: extractWorkStyle(source, sourceVec),
        target: extractWorkStyle(target, targetVec),
      },
      reasons: matchScore.reasons,
      sourceProfile: {
        id: source.id,
        role: source.role,
        displayName: source.profile?.displayName ?? source.email.split('@')[0],
        headline: source.profile?.headline,
        avatarUrl: source.profile?.avatarUrl,
        location: source.profile?.location,
      },
      targetProfile: {
        id: target.id,
        role: target.role,
        displayName: target.profile?.displayName ?? target.email.split('@')[0],
        headline: target.profile?.headline,
        avatarUrl: target.profile?.avatarUrl,
        location: target.profile?.location,
      },
    };
  }

  // ── Core scoring ───────────────────────────────────────────────────────────

  private async calculateMatchScore(
    user: any,
    userVector: any,
    candidate: any,
    criteria: MatchingCriteria,
    weights: typeof DEFAULT_WEIGHTS,
    outcomeMap: Map<string, number>,
    behavioralMap: Map<string, number>,
  ): Promise<MatchScore> {
    const reasons: string[] = [];

    // Layer 1: Structured features
    const roleScore = this.calculateRoleCompatibility(user.role, candidate.role);
    const skillsScore = this.calculateSkillsCompatibility(
      user.profile?.skills ?? [], candidate.profile?.skills ?? []
    );
    const locationScore = this.calculateLocationCompatibility(
      user.profile?.location, candidate.profile?.location, criteria.remote
    );
    const industryScore = this.calculateIndustryCompatibility(user.profile, candidate.profile);

    // Layer 2: Semantic (bio/goal keyword overlap)
    const candidateVector = await this.getOrBuildFeatureVector(candidate);
    const semanticScore = this.calculateSemanticScore(userVector, candidateVector);

    // Layer 3: Behavioral signal (how active / responsive this candidate is)
    const behavioralScore = behavioralMap.get(candidate.id) ?? 0.5;

    // Layer 4: Outcome prior (past feedback for this specific pair)
    const outcomePrior = outcomeMap.get(candidate.id) ?? 0.5;

    // Build breakdown
    const breakdown: ScoreBreakdown = {
      role: roleScore,
      skills: skillsScore,
      location: locationScore,
      industry: industryScore,
      semantic: semanticScore,
      behavioral: behavioralScore,
      outcomePrior,
      total: 0,
    };

    // Weighted total
    breakdown.total = Math.min(1,
      roleScore * weights.role +
      skillsScore * weights.skills +
      locationScore * weights.location +
      industryScore * weights.industry +
      semanticScore * weights.semantic +
      behavioralScore * weights.behavioral +
      outcomePrior * weights.outcomePrior
    );

    // Build human-readable reasons
    if (roleScore > 0.7) reasons.push('Complementary roles');
    if (skillsScore > 0.5) reasons.push('Matching skills & expertise');
    if (semanticScore > 0.5) reasons.push('Aligned goals & vision');
    if (locationScore > 0.7) reasons.push('Same region or open to remote');
    if (industryScore > 0.6) reasons.push('Related industry or stage');
    if (behavioralScore > 0.7) reasons.push('Highly active on platform');

    // Build safe explanation for UI
    const explanation: MatchExplanation[] = [
      { dimension: 'role', label: 'Role fit', weight: weights.role, score: roleScore },
      { dimension: 'skills', label: 'Skills & expertise', weight: weights.skills, score: skillsScore },
      { dimension: 'semantic', label: 'Goals & vision', weight: weights.semantic, score: semanticScore },
      { dimension: 'location', label: 'Location', weight: weights.location, score: locationScore },
      { dimension: 'industry', label: 'Industry & stage', weight: weights.industry, score: industryScore },
    ].filter(e => e.score > 0.3); // Only show meaningful dimensions

    const confidence = this.computeConfidence(breakdown, userVector, candidateVector);

    return {
      userId: candidate.id,
      score: breakdown.total,
      confidence,
      reasons,
      explanation,
      breakdown,
      profile: candidate.profile,
    };
  }

  /**
   * "Open to" signals lift candidates who said they would do what this person
   * is looking for — by at most `OPEN_TO_BOOST`, so a signal orders people who
   * already fit and never rescues a poor fit. The reason is named only when
   * the signal's own visibility lets this viewer see it; a "matching only"
   * signal moves the ranking and says nothing.
   */
  private async applyOpenTo(user: any, matches: MatchScore[]): Promise<void> {
    if (!this.openTo || !matches.length) return;
    try {
      const signals = await this.openTo.activeSignals(matches.map((m) => m.userId));
      if (!signals.size) return;
      const profile = await this.prisma.matchProfile.findUnique({ where: { userId: user.id }, select: { lookingForRoles: true } }).catch(() => null);
      const wants = seekerWants(profile?.lookingForRoles, user.role);
      let verified: boolean | null = null;
      for (const match of matches) {
        const signal = signals.get(match.userId);
        const lift = openToBoost(signal, wants);
        if (!signal || !lift) continue;
        match.score = Math.min(1, match.score + lift);
        if (signal.visibility === 'verified' && verified === null) verified = await this.openTo.isVerified(user.id);
        const shown = openToShownTo(signal, { isOwner: false, verified: verified === true }).filter((k) => wants.includes(k));
        for (const kind of shown) match.reasons.push(`Open to ${OPEN_TO_COPY[kind].en.toLowerCase()}`);
      }
    } catch (err) {
      this.logger.warn(`Open-to signals skipped: ${String(err)}`);
    }
  }

  // ── Semantic scoring (TF-IDF style keyword overlap) ────────────────────────

  private calculateSemanticScore(userVec: any, candidateVec: any): number {
    if (!userVec || !candidateVec) return 0.5;

    const userKws = new Set<string>([
      ...((userVec.bioKeywords as string[]) ?? []),
      ...((userVec.goalKeywords as string[]) ?? []),
      ...((userVec.expertiseKeywords as string[]) ?? []),
    ]);
    const candidateKws = new Set<string>([
      ...((candidateVec.bioKeywords as string[]) ?? []),
      ...((candidateVec.goalKeywords as string[]) ?? []),
      ...((candidateVec.expertiseKeywords as string[]) ?? []),
    ]);

    if (userKws.size === 0 || candidateKws.size === 0) return 0.4;

    // Jaccard similarity on keyword sets
    const intersection = new Set([...userKws].filter(k => candidateKws.has(k)));
    const union = new Set([...userKws, ...candidateKws]);
    const jaccard = intersection.size / union.size;

    // Boost: check for thematic complementarity (tech vs business, etc.)
    const complementaryBoost = this.computeKeywordComplementarity(userKws, candidateKws);

    return Math.min(1, jaccard * 0.6 + complementaryBoost * 0.4);
  }

  private computeKeywordComplementarity(kws1: Set<string>, kws2: Set<string>): number {
    const techTerms = ['engineer', 'developer', 'technical', 'software', 'code', 'data', 'ai', 'ml', 'backend', 'frontend'];
    const bizTerms = ['sales', 'marketing', 'business', 'growth', 'revenue', 'strategy', 'operations', 'finance', 'cfo', 'cmo'];
    const designTerms = ['design', 'ux', 'ui', 'product', 'brand', 'creative', 'visual'];

    const hasTech = (kws: Set<string>) => techTerms.some(t => [...kws].some(k => k.includes(t)));
    const hasBiz = (kws: Set<string>) => bizTerms.some(t => [...kws].some(k => k.includes(t)));
    const hasDesign = (kws: Set<string>) => designTerms.some(t => [...kws].some(k => k.includes(t)));

    let score = 0;
    if ((hasTech(kws1) && hasBiz(kws2)) || (hasBiz(kws1) && hasTech(kws2))) score += 0.6;
    if ((hasTech(kws1) && hasDesign(kws2)) || (hasDesign(kws1) && hasTech(kws2))) score += 0.4;
    if ((hasBiz(kws1) && hasDesign(kws2)) || (hasDesign(kws1) && hasBiz(kws2))) score += 0.3;

    return Math.min(1, score);
  }

  // ── Feature vector ─────────────────────────────────────────────────────────

  private async getOrBuildFeatureVector(user: any): Promise<any> {
    const cached = await this.cache.get(`fv:${user.id}`);
    if (cached) return cached;

    // Extract keywords from profile text
    const profileText = [
      user.profile?.bio ?? '',
      user.profile?.headline ?? '',
      (user.profile?.rolePayload as any)?.goals ?? '',
      (user.profile?.rolePayload as any)?.expertise ?? '',
    ].join(' ').toLowerCase();

    const keywords = this.extractKeywords(profileText);
    const goalText = ((user.profile?.rolePayload as any)?.goals ?? '').toLowerCase();
    const goalKeywords = this.extractKeywords(goalText);
    const expertiseText = ((user.profile?.rolePayload as any)?.expertise ?? '').toLowerCase();
    const expertiseKeywords = this.extractKeywords(expertiseText);

    // Behavioral aggregates from DB
    const [signals, outcomes] = await Promise.all([
      this.prisma.userBehaviorSignal.findMany({
        where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
        select: { signalType: true, value: true },
      }),
      this.prisma.matchOutcome.findMany({
        where: { sourceUserId: user.id },
        select: { feedback: true },
      }),
    ]);

    const activityScore = Math.min(1, signals.length / 50);
    const positiveOutcomes = outcomes.filter(o => o.feedback === 'accepted').length;
    const acceptanceRate = outcomes.length > 0 ? positiveOutcomes / outcomes.length : null;

    // Profile completeness
    const p = user.profile;
    const fields = [p?.bio, p?.headline, p?.location, p?.avatarUrl, p?.skills?.length > 0];
    const profileQualityScore = fields.filter(Boolean).length / fields.length;

    const vector = {
      bioKeywords: keywords.slice(0, 30),
      goalKeywords: goalKeywords.slice(0, 20),
      expertiseKeywords: expertiseKeywords.slice(0, 20),
      activityScore,
      acceptanceRate,
      profileQualityScore,
    };

    // Persist to DB async (upsert)
    this.prisma.matchFeatureVector.upsert({
      where: { userId: user.id },
      create: { userId: user.id, features: { role: user.role }, ...vector },
      update: { features: { role: user.role }, ...vector },
    }).catch(() => {});

    await this.cache.set(`fv:${user.id}`, vector, 3600);
    return vector;
  }

  private extractKeywords(text: string): string[] {
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall',
      'my', 'your', 'our', 'their', 'its', 'this', 'that', 'these', 'those', 'i', 'we',
      'you', 'he', 'she', 'it', 'they', 'what', 'which', 'who', 'how', 'when', 'where',
    ]);
    return text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i) // unique
      .slice(0, 50);
  }

  // ── Outcome prior map ──────────────────────────────────────────────────────

  private async getOutcomePriorMap(userId: string): Promise<Map<string, number>> {
    const outcomes = await this.prisma.matchOutcome.findMany({
      where: { sourceUserId: userId },
      select: { targetUserId: true, feedback: true },
    });
    const map = new Map<string, number>();
    for (const o of outcomes) {
      const score = o.feedback === 'accepted' ? 0.9
        : o.feedback === 'declined' ? 0.1
        : o.feedback === 'not_relevant' ? 0.05
        : 0.5;
      map.set(o.targetUserId, score);
    }
    return map;
  }

  // ── Behavioral map ─────────────────────────────────────────────────────────

  private async getBehavioralMap(userId: string): Promise<Map<string, number>> {
    // Get recent positive behavioral signals about other users
    const signals = await this.prisma.userBehaviorSignal.findMany({
      where: {
        userId,
        signalType: { in: ['profile_view', 'match_click', 'message_sent'] },
        targetType: 'user',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
      select: { targetId: true, signalType: true, value: true },
    });

    const map = new Map<string, number>();
    for (const s of signals) {
      if (!s.targetId) continue;
      const current = map.get(s.targetId) ?? 0.5;
      map.set(s.targetId, Math.min(1, current + s.value * 0.1));
    }
    return map;
  }

  // ── Confidence calculation ─────────────────────────────────────────────────

  private computeConfidence(breakdown: ScoreBreakdown, userVec: any, candidateVec: any): number {
    let confidence = 0.5;
    if (userVec?.profileQualityScore > 0.6) confidence += 0.15;
    if (candidateVec?.profileQualityScore > 0.6) confidence += 0.15;
    if (userVec?.bioKeywords?.length > 5) confidence += 0.1;
    if (candidateVec?.bioKeywords?.length > 5) confidence += 0.1;
    return Math.min(0.95, confidence);
  }

  // ── Model weights ──────────────────────────────────────────────────────────

  private async getActiveWeights(modelVersion?: string): Promise<typeof DEFAULT_WEIGHTS> {
    try {
      const model = modelVersion
        ? await this.prisma.matchModelVersion.findUnique({ where: { version: modelVersion } })
        : await this.prisma.matchModelVersion.findFirst({ where: { isActive: true } });
      if (model?.weights) return model.weights as typeof DEFAULT_WEIGHTS;
    } catch {}
    return DEFAULT_WEIGHTS;
  }

  // ── Inference logging ──────────────────────────────────────────────────────

  private async logInferences(sourceUserId: string, matches: MatchScore[], modelVersion: string): Promise<void> {
    for (const match of matches.slice(0, 10)) {
      await this.prisma.matchInferenceLog.upsert({
        where: {
          sourceUserId_targetUserId_modelVersion: {
            sourceUserId, targetUserId: match.userId, modelVersion,
          },
        },
        create: {
          sourceUserId, targetUserId: match.userId,
          roleScore: match.breakdown.role,
          skillScore: match.breakdown.skills,
          locationScore: match.breakdown.location,
          industryScore: match.breakdown.industry,
          semanticScore: match.breakdown.semantic,
          behavioralScore: match.breakdown.behavioral,
          outcomePriorScore: match.breakdown.outcomePrior,
          finalScore: match.breakdown.total,
          modelVersion,
          explanation: match.explanation as any,
          confidence: match.confidence,
          shownAt: new Date(),
        },
        update: { finalScore: match.breakdown.total, shownAt: new Date() },
      }).catch(() => {});
    }
  }

  // ── Candidate pool ─────────────────────────────────────────────────────────

  private async getPotentialMatches(criteria: MatchingCriteria): Promise<any[]> {
    const where: any = {
      id: { not: criteria.userId },
      moderationStatus: 'active',
      emailVerified: true,
    };
    if (criteria.role) where.role = criteria.role;
    if (criteria.location && !criteria.remote) {
      where.profile = { location: criteria.location };
    }
    const users = await this.prisma.user.findMany({
      where,
      include: { profile: { include: { skills: { include: { skill: true } } } } },
      take: 100,
    });
    // "Appear in search: off" keeps a member out of recommendations too.
    return users.filter((u) => !isHiddenFromSearch(u.profile?.visibilityRules));
  }

  // ── Structured scoring helpers ─────────────────────────────────────────────

  private calculateRoleCompatibility(userRole: string, candidateRole: string): number {
    const matrix: Record<string, Record<string, number>> = {
      founder: { founder: 0.3, mentor: 0.9, investor: 0.8, org: 0.7 },
      mentor:  { founder: 0.9, mentor: 0.4, investor: 0.6, org: 0.8 },
      investor: { founder: 0.8, mentor: 0.6, investor: 0.5, org: 0.9 },
      org:     { founder: 0.7, mentor: 0.8, investor: 0.9, org: 0.6 },
    };
    return matrix[userRole]?.[candidateRole] ?? 0.5;
  }

  private calculateSkillsCompatibility(userSkills: any[], candidateSkills: any[]): number {
    if (!userSkills.length || !candidateSkills.length) return 0.4;
    const uIds = new Set(userSkills.map(s => s.skillId));
    const cIds = new Set(candidateSkills.map(s => s.skillId));
    const intersection = [...uIds].filter(id => cIds.has(id)).length;
    const union = new Set([...uIds, ...cIds]).size;
    const jaccard = intersection / union;

    const uNames = userSkills.map(s => (s.skill?.name ?? '').toLowerCase());
    const cNames = candidateSkills.map(s => (s.skill?.name ?? '').toLowerCase());
    const complementary = this.calcComplementarySkills(uNames, cNames);

    return Math.min(1, jaccard * 0.7 + complementary * 0.3);
  }

  private calcComplementarySkills(uNames: string[], cNames: string[]): number {
    const pairs = [
      ['technical', 'business'], ['marketing', 'product'],
      ['design', 'development'], ['sales', 'engineering'], ['finance', 'operations'],
    ];
    let count = 0;
    for (const [a, b] of pairs) {
      const uA = uNames.some(n => n.includes(a)), cB = cNames.some(n => n.includes(b));
      const cA = cNames.some(n => n.includes(a)), uB = uNames.some(n => n.includes(b));
      if ((uA && cB) || (cA && uB)) count++;
    }
    return Math.min(1, count / pairs.length);
  }

  private calculateLocationCompatibility(uLoc?: string, cLoc?: string, remote = false): number {
    if (remote) return 0.85;
    if (!uLoc || !cLoc) return 0.5;
    if (uLoc.toLowerCase() === cLoc.toLowerCase()) return 1.0;
    const uParts = uLoc.toLowerCase().split(',');
    const cParts = cLoc.toLowerCase().split(',');
    if (uParts.at(-1)?.trim() === cParts.at(-1)?.trim()) return 0.7;
    return 0.3;
  }

  private calculateIndustryCompatibility(uProfile: any, cProfile: any): number {
    const uP = uProfile?.rolePayload as any;
    const cP = cProfile?.rolePayload as any;
    if (!uP || !cP) return 0.5;
    let score = 0.5;
    if (uP.industry && cP.industry && uP.industry === cP.industry) score += 0.3;
    if (uP.stage && cP.stage) {
      const stageDiff = Math.abs(this.stageNum(uP.stage) - this.stageNum(cP.stage));
      score += Math.max(0, 0.2 - stageDiff * 0.07);
    }
    return Math.min(1, score);
  }

  private stageNum(stage: string): number {
    return ({ idea: 0, mvp: 1, traction: 2, scaling: 3 }[stage] ?? 1);
  }

  private getComplementaryRole(role: string): string | undefined {
    return ({ founder: 'mentor', mentor: 'founder', investor: 'founder', org: 'mentor' }[role]);
  }
}
