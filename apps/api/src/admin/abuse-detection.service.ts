import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Constants ─────────────────────────────────────────────────────────────────

const BURST_WINDOW_MINS = 5;
const BURST_MAX_EVENTS = 10;
const LOW_QUALITY_WINDOW_HRS = 24;
const LOW_QUALITY_MAX_EMPTY_RATIO = 0.8; // >80% empty-entity events = suspicious
const MUTUAL_ENDORSEMENT_WINDOW_DAYS = 7;
const MUTUAL_ENDORSEMENT_MIN_PAIRS = 3; // min mutual pairs to flag a ring
const STREAK_MANIPULATION_MIN_DAILY = 1; // must have >1 meaningful event per streak day

// ── Types ─────────────────────────────────────────────────────────────────────

export type AbuseFlagType =
  | 'burst_spam'
  | 'low_quality_repetition'
  | 'fake_collaboration'
  | 'streak_manipulation'
  | 'empty_node_spam'
  | 'self_link_abuse'
  | 'mutual_endorsement_ring';

export interface AbuseFlagRecord {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  type: AbuseFlagType;
  severity: number;
  description: string | null;
  metadata: Record<string, unknown>;
  status: string;
  resolvedAt: Date | null;
  resolvedById: string | null;
  actionTaken: string | null;
  createdAt: Date;
}

export interface AbuseDetectionResult {
  flagsCreated: number;
  detections: Array<{ type: AbuseFlagType; severity: number; userId: string }>;
}

export interface AbuseStats {
  totalFlags: number;
  pendingFlags: number;
  actionedFlags: number;
  dismissedFlags: number;
  byType: Record<string, number>;
  topOffenders: Array<{ userId: string; email: string; displayName: string | null; flagCount: number; maxSeverity: number }>;
}

// ── Prisma cast helper ────────────────────────────────────────────────────────
// AbuseFlag model is new (Phase G4). Until prisma generate runs post-restart,
// we access it via the PrismaService cast.

type PrismaWithG4 = PrismaService & {
  abuseFlag: {
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    groupBy: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  };
};

@Injectable()
export class AbuseDetectionService {
  private readonly logger = new Logger(AbuseDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get g4(): PrismaWithG4 {
    return this.prisma as unknown as PrismaWithG4;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DETECTION ENGINE
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Run all detection rules for a specific user.
   * Called asynchronously after high-frequency XP events.
   * Never throws — logs errors internally.
   */
  async runDetectionForUser(userId: string): Promise<AbuseDetectionResult> {
    const detections: Array<{ type: AbuseFlagType; severity: number; userId: string }> = [];

    try {
      const [burstResult, qualityResult, emptyNodeResult, selfLinkResult] = await Promise.all([
        this.detectBurstSpam(userId),
        this.detectLowQualityRepetition(userId),
        this.detectEmptyNodeSpam(userId),
        this.detectSelfLinkAbuse(userId),
      ]);

      for (const result of [burstResult, qualityResult, emptyNodeResult, selfLinkResult]) {
        if (result) detections.push({ ...result, userId });
      }

      let flagsCreated = 0;
      for (const d of detections) {
        const created = await this.createFlag(d.userId, d.type, d.severity);
        if (created) flagsCreated++;
      }

      return { flagsCreated, detections };
    } catch (err) {
      this.logger.error(`AbuseDetectionService.runDetectionForUser failed for ${userId}: ${(err as Error).message}`);
      return { flagsCreated: 0, detections: [] };
    }
  }

  /**
   * Run mutual endorsement ring detection across all users.
   * Expensive — call from a scheduled job, not per-request.
   */
  async runRingDetection(): Promise<AbuseDetectionResult> {
    const detections: Array<{ type: AbuseFlagType; severity: number; userId: string }> = [];
    try {
      const rings = await this.detectMutualEndorsementRings();
      let flagsCreated = 0;
      for (const { userId, severity } of rings) {
        detections.push({ userId, type: 'mutual_endorsement_ring', severity });
        const created = await this.createFlag(userId, 'mutual_endorsement_ring', severity);
        if (created) flagsCreated++;
      }
      return { flagsCreated, detections };
    } catch (err) {
      this.logger.error(`runRingDetection failed: ${(err as Error).message}`);
      return { flagsCreated: 0, detections: [] };
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DETECTION RULES
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * RULE 1 — Burst Spam
   * Detects >BURST_MAX_EVENTS XP events within BURST_WINDOW_MINS.
   * Severity = min(1.0, (count - threshold) / threshold)
   */
  private async detectBurstSpam(userId: string): Promise<{ type: AbuseFlagType; severity: number } | null> {
    const windowStart = new Date(Date.now() - BURST_WINDOW_MINS * 60_000);
    const count = await this.prisma.xPEvent.count({
      where: { userId, createdAt: { gte: windowStart } },
    });

    if (count <= BURST_MAX_EVENTS) return null;

    const severity = Math.min(1.0, parseFloat(((count - BURST_MAX_EVENTS) / BURST_MAX_EVENTS).toFixed(3)));
    return { type: 'burst_spam', severity };
  }

  /**
   * RULE 2 — Low Quality Repetition
   * Detects when >LOW_QUALITY_MAX_EMPTY_RATIO of events in past 24h have no entityId.
   * Empty-entity events = possibly fake/spam activity.
   * Severity = (emptyRatio - threshold) / (1 - threshold)
   */
  private async detectLowQualityRepetition(userId: string): Promise<{ type: AbuseFlagType; severity: number } | null> {
    const windowStart = new Date(Date.now() - LOW_QUALITY_WINDOW_HRS * 3_600_000);
    const [total, emptyEntity] = await Promise.all([
      this.prisma.xPEvent.count({ where: { userId, createdAt: { gte: windowStart } } }),
      this.prisma.xPEvent.count({ where: { userId, createdAt: { gte: windowStart }, entityId: null } }),
    ]);

    if (total < 5) return null; // need minimum sample
    const ratio = emptyEntity / total;
    if (ratio <= LOW_QUALITY_MAX_EMPTY_RATIO) return null;

    const severity = parseFloat(Math.min(1.0, (ratio - LOW_QUALITY_MAX_EMPTY_RATIO) / (1 - LOW_QUALITY_MAX_EMPTY_RATIO)).toFixed(3));
    return { type: 'low_quality_repetition', severity };
  }

  /**
   * RULE 3 — Empty Node Spam
   * Detects high volume of CREATE_ARTIFACT events with no downstream IMPROVE/COMPLETE.
   * Ratio = orphan_creates / total_creates > 0.9 with count > 10
   */
  private async detectEmptyNodeSpam(userId: string): Promise<{ type: AbuseFlagType; severity: number } | null> {
    const windowStart = new Date(Date.now() - 7 * 24 * 3_600_000); // 7 days
    const [creates, improvements] = await Promise.all([
      this.prisma.xPEvent.count({
        where: { userId, eventType: 'CREATE_ARTIFACT', createdAt: { gte: windowStart } },
      }),
      this.prisma.xPEvent.count({
        where: {
          userId,
          eventType: { in: ['COMPLETE_ARTIFACT', 'IMPROVE_ARTIFACT'] as never[] },
          createdAt: { gte: windowStart },
        },
      }),
    ]);

    if (creates < 10) return null;
    const orphanRatio = improvements === 0 ? 1.0 : Math.max(0, (creates - improvements) / creates);
    if (orphanRatio <= 0.9) return null;

    const severity = parseFloat(Math.min(1.0, orphanRatio).toFixed(3));
    return { type: 'empty_node_spam', severity };
  }

  /**
   * RULE 4 — Self-Link Abuse
   * Detects when >60% of LINK_ARTIFACTS events reference the same entityId pair.
   */
  private async detectSelfLinkAbuse(userId: string): Promise<{ type: AbuseFlagType; severity: number } | null> {
    const windowStart = new Date(Date.now() - 7 * 24 * 3_600_000);
    const linkEvents = await this.prisma.xPEvent.findMany({
      where: { userId, eventType: 'LINK_ARTIFACTS', createdAt: { gte: windowStart } },
      select: { entityId: true },
    });

    if (linkEvents.length < 5) return null;

    const entityCounts: Record<string, number> = {};
    for (const e of linkEvents) {
      const key = e.entityId ?? 'null';
      entityCounts[key] = (entityCounts[key] ?? 0) + 1;
    }

    const maxRepeat = Math.max(...Object.values(entityCounts));
    const repeatRatio = maxRepeat / linkEvents.length;
    if (repeatRatio <= 0.6) return null;

    return { type: 'self_link_abuse', severity: parseFloat(Math.min(1.0, repeatRatio).toFixed(3)) };
  }

  /**
   * RULE 5 — Mutual Endorsement Ring
   * Graph-based: detects clusters where users have mutual high-frequency INVITE_COLLABORATOR
   * or TEAM_CONTRIBUTION events within the same window.
   * Severity based on cluster size and density.
   */
  private async detectMutualEndorsementRings(): Promise<Array<{ userId: string; severity: number }>> {
    const windowStart = new Date(Date.now() - MUTUAL_ENDORSEMENT_WINDOW_DAYS * 24 * 3_600_000);

    // Find all TEAM_CONTRIBUTION events with entityId (=collaborator userId) in window
    const collabEvents = await this.prisma.xPEvent.findMany({
      where: {
        eventType: { in: ['TEAM_CONTRIBUTION', 'INVITE_COLLABORATOR'] as never[] },
        createdAt: { gte: windowStart },
        entityId: { not: null },
      },
      select: { userId: true, entityId: true },
    });

    // Build directed graph: userId → entityId (target user)
    const edges: Map<string, Set<string>> = new Map();
    for (const e of collabEvents) {
      if (!e.entityId) continue;
      if (!edges.has(e.userId)) edges.set(e.userId, new Set());
      edges.get(e.userId)!.add(e.entityId);
    }

    // Find mutual pairs: A→B and B→A
    const mutualPairs: Map<string, Set<string>> = new Map();
    for (const [a, targets] of edges) {
      for (const b of targets) {
        if (edges.has(b) && edges.get(b)!.has(a)) {
          if (!mutualPairs.has(a)) mutualPairs.set(a, new Set());
          mutualPairs.get(a)!.add(b);
        }
      }
    }

    // Flag users with ≥ MUTUAL_ENDORSEMENT_MIN_PAIRS mutual partners
    const flagged: Array<{ userId: string; severity: number }> = [];
    for (const [userId, partners] of mutualPairs) {
      if (partners.size >= MUTUAL_ENDORSEMENT_MIN_PAIRS) {
        const severity = parseFloat(Math.min(1.0, partners.size / 10).toFixed(3));
        flagged.push({ userId, severity });
      }
    }

    return flagged;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FLAG MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Create an AbuseFlag record if no pending flag of the same type exists for user.
   * Deduplicates within a 24h window to avoid flag spam.
   */
  private async createFlag(
    userId: string,
    type: AbuseFlagType,
    severity: number,
  ): Promise<boolean> {
    const oneDayAgo = new Date(Date.now() - 24 * 3_600_000);
    const existing = await this.g4.abuseFlag.findFirst({
      where: {
        userId,
        type,
        status: 'pending',
        createdAt: { gte: oneDayAgo },
      } as Record<string, unknown>,
    });

    if (existing) return false;

    await this.g4.abuseFlag.create({
      data: {
        userId,
        type,
        severity,
        status: 'pending',
        description: this.describeFlag(type, severity),
        metadata: { detectedAt: new Date().toISOString() },
      } as Record<string, unknown>,
    });

    this.logger.warn(`AbuseFlag created: user=${userId} type=${type} severity=${severity}`);
    return true;
  }

  private describeFlag(type: AbuseFlagType, severity: number): string {
    const descriptions: Record<AbuseFlagType, string> = {
      burst_spam: `High-frequency event burst detected (severity ${(severity * 100).toFixed(0)}%)`,
      low_quality_repetition: `High ratio of empty-entity XP events (severity ${(severity * 100).toFixed(0)}%)`,
      fake_collaboration: `Suspected fake collaboration pattern detected`,
      streak_manipulation: `Minimum-viable streak preservation pattern detected`,
      empty_node_spam: `High volume of un-progressed artifact creations (severity ${(severity * 100).toFixed(0)}%)`,
      self_link_abuse: `Repeated self-referential artifact linking (severity ${(severity * 100).toFixed(0)}%)`,
      mutual_endorsement_ring: `Mutual endorsement ring detected (severity ${(severity * 100).toFixed(0)}%)`,
    };
    return descriptions[type];
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN QUERIES
  // ════════════════════════════════════════════════════════════════════════════

  async listFlags(params: {
    status?: string;
    type?: string;
    limit: number;
    offset: number;
  }): Promise<{ flags: AbuseFlagRecord[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where['status'] = params.status;
    if (params.type) where['type'] = params.type;

    const [rawFlags, total] = await Promise.all([
      this.g4.abuseFlag.findMany({
        where,
        include: { user: { select: { email: true, profile: { select: { displayName: true } } } } } as Record<string, unknown>,
        orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }] as unknown,
        take: params.limit,
        skip: params.offset,
      }),
      this.g4.abuseFlag.count({ where }),
    ]);

    const flags: AbuseFlagRecord[] = rawFlags.map((f) => {
      const user = (f as Record<string, unknown>)['user'] as
        | { email: string; profile: { displayName: string } | null }
        | undefined;
      return {
        id: f['id'] as string,
        userId: f['userId'] as string,
        email: user?.email ?? '',
        displayName: user?.profile?.displayName ?? null,
        type: f['type'] as AbuseFlagType,
        severity: f['severity'] as number,
        description: (f['description'] as string | null) ?? null,
        metadata: (f['metadata'] as Record<string, unknown>) ?? {},
        status: f['status'] as string,
        resolvedAt: (f['resolvedAt'] as Date | null) ?? null,
        resolvedById: (f['resolvedById'] as string | null) ?? null,
        actionTaken: (f['actionTaken'] as string | null) ?? null,
        createdAt: f['createdAt'] as Date,
      };
    });

    return { flags, total };
  }

  async resolveFlag(params: {
    flagId: string;
    resolvedById: string;
    action: 'reduced_xp' | 'streak_freeze' | 'warning' | 'safe' | 'banned';
    status: 'actioned' | 'dismissed';
  }): Promise<void> {
    await this.g4.abuseFlag.update({
      where: { id: params.flagId } as Record<string, unknown>,
      data: {
        status: params.status,
        resolvedAt: new Date(),
        resolvedById: params.resolvedById,
        actionTaken: params.action,
      } as Record<string, unknown>,
    });
  }

  async getAbuseStats(): Promise<AbuseStats> {
    const [total, pending, actioned, dismissed, byTypeRaw, topOffendersRaw] = await Promise.all([
      this.g4.abuseFlag.count({}),
      this.g4.abuseFlag.count({ where: { status: 'pending' } }),
      this.g4.abuseFlag.count({ where: { status: 'actioned' } }),
      this.g4.abuseFlag.count({ where: { status: 'dismissed' } }),
      this.g4.abuseFlag.groupBy({
        by: ['type'],
        _count: { id: true },
      } as Record<string, unknown>),
      this.g4.abuseFlag.findMany({
        where: {},
        include: { user: { select: { email: true, profile: { select: { displayName: true } } } } } as Record<string, unknown>,
        orderBy: [{ severity: 'desc' }] as unknown,
        take: 100,
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const row of byTypeRaw) {
      byType[row['type'] as string] = (row as Record<string, Record<string, number>>)['_count']['id'];
    }

    // Aggregate top offenders
    const offenderMap: Map<string, { email: string; displayName: string | null; flagCount: number; maxSeverity: number }> = new Map();
    for (const f of topOffendersRaw) {
      const userId = f['userId'] as string;
      const user = (f as Record<string, unknown>)['user'] as { email: string; profile: { displayName: string } | null } | undefined;
      if (!offenderMap.has(userId)) {
        offenderMap.set(userId, {
          email: user?.email ?? '',
          displayName: user?.profile?.displayName ?? null,
          flagCount: 0,
          maxSeverity: 0,
        });
      }
      const entry = offenderMap.get(userId)!;
      entry.flagCount++;
      entry.maxSeverity = Math.max(entry.maxSeverity, f['severity'] as number);
    }

    const topOffenders = Array.from(offenderMap.entries())
      .map(([userId, v]) => ({ userId, ...v }))
      .sort((a, b) => b.flagCount - a.flagCount || b.maxSeverity - a.maxSeverity)
      .slice(0, 20);

    return {
      totalFlags: total as unknown as number,
      pendingFlags: pending as unknown as number,
      actionedFlags: actioned as unknown as number,
      dismissedFlags: dismissed as unknown as number,
      byType,
      topOffenders,
    };
  }
}
