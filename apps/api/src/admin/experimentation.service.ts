import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExperimentRecord {
  id: string;
  name: string;
  description: string | null;
  key: string;
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  splitRatio: number;
  active: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  assignmentCount: number;
  variantACounts: number;
  variantBCounts: number;
}

export interface VariantAssignment {
  variant: 'A' | 'B';
  config: Record<string, unknown>;
  experimentId: string;
}

export interface SystemConfigRecord {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  category: string | null;
  updatedById: string | null;
  updatedAt: Date;
}

export interface ExperimentMetrics {
  experimentId: string;
  name: string;
  variantACounts: number;
  variantBCounts: number;
  variantAXpAvg: number;
  variantBXpAvg: number;
  variantABadgeRate: number;
  variantBBadgeRate: number;
  variantARetention7d: number;
  variantBRetention7d: number;
}

// ── Prisma cast helper ────────────────────────────────────────────────────────

type G4Prisma = PrismaService & {
  experiment: {
    create: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    findFirst: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    findUnique: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    findMany: (a: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    update: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    delete: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    count: (a: Record<string, unknown>) => Promise<number>;
  };
  experimentAssignment: {
    create: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    findUnique: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    findMany: (a: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    count: (a: Record<string, unknown>) => Promise<number>;
    groupBy: (a: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  };
  systemConfig: {
    create: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    findUnique: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    findMany: (a: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    upsert: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    update: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
    delete: (a: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

@Injectable()
export class ExperimentationService {
  private readonly logger = new Logger(ExperimentationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get g4(): G4Prisma {
    return this.prisma as unknown as G4Prisma;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXPERIMENT MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════

  async createExperiment(params: {
    name: string;
    description?: string;
    key: string;
    variantA: Record<string, unknown>;
    variantB: Record<string, unknown>;
    splitRatio?: number;
    createdById: string;
  }): Promise<Record<string, unknown>> {
    return this.g4.experiment.create({
      data: {
        name: params.name,
        description: params.description ?? null,
        key: params.key,
        variantA: params.variantA,
        variantB: params.variantB,
        splitRatio: params.splitRatio ?? 0.5,
        active: false,
        createdById: params.createdById,
      },
    });
  }

  async listExperiments(): Promise<ExperimentRecord[]> {
    const experiments = await this.g4.experiment.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] as unknown,
    });

    const records: ExperimentRecord[] = await Promise.all(
      experiments.map(async (e) => {
        const [variantACounts, variantBCounts] = await Promise.all([
          this.g4.experimentAssignment.count({ where: { experimentId: e['id'], variant: 'A' } }),
          this.g4.experimentAssignment.count({ where: { experimentId: e['id'], variant: 'B' } }),
        ]);

        return {
          id: e['id'] as string,
          name: e['name'] as string,
          description: (e['description'] as string | null) ?? null,
          key: e['key'] as string,
          variantA: e['variantA'] as Record<string, unknown>,
          variantB: e['variantB'] as Record<string, unknown>,
          splitRatio: e['splitRatio'] as number,
          active: e['active'] as boolean,
          startedAt: (e['startedAt'] as Date | null) ?? null,
          endedAt: (e['endedAt'] as Date | null) ?? null,
          createdById: (e['createdById'] as string | null) ?? null,
          createdAt: e['createdAt'] as Date,
          assignmentCount: variantACounts + variantBCounts,
          variantACounts,
          variantBCounts,
        };
      }),
    );

    return records;
  }

  async activateExperiment(experimentId: string): Promise<void> {
    await this.g4.experiment.update({
      where: { id: experimentId },
      data: { active: true, startedAt: new Date() },
    });
    this.logger.log(`Experiment ${experimentId} activated`);
  }

  async deactivateExperiment(experimentId: string): Promise<void> {
    await this.g4.experiment.update({
      where: { id: experimentId },
      data: { active: false, endedAt: new Date() },
    });
    this.logger.log(`Experiment ${experimentId} deactivated`);
  }

  async updateExperiment(
    experimentId: string,
    data: Partial<{
      name: string;
      description: string;
      variantA: Record<string, unknown>;
      variantB: Record<string, unknown>;
      splitRatio: number;
    }>,
  ): Promise<void> {
    await this.g4.experiment.update({
      where: { id: experimentId },
      data: data as Record<string, unknown>,
    });
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.g4.experiment.delete({ where: { id: experimentId } });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VARIANT ASSIGNMENT (STICKY BUCKETING)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Assign a user to a variant for an experiment — sticky (never changes).
   * Uses deterministic hash-based bucketing:
   *   hash(experimentKey + userId) mod 100 < splitRatio * 100 → B
   * This ensures:
   *   - Same user always gets same variant (no variant switching)
   *   - No DB read needed for assignment check if already assigned
   *   - Assignment persisted for analytics
   */
  async getVariantForUser(userId: string, experimentKey: string): Promise<VariantAssignment | null> {
    const experiment = await this.g4.experiment.findFirst({
      where: { key: experimentKey, active: true },
    });

    if (!experiment) return null;
    const experimentId = experiment['id'] as string;

    // Check existing sticky assignment
    const existing = await this.g4.experimentAssignment.findUnique({
      where: { experimentId_userId: { experimentId, userId } } as Record<string, unknown>,
    });

    if (existing) {
      const variant = existing['variant'] as 'A' | 'B';
      const config = variant === 'A'
        ? (experiment['variantA'] as Record<string, unknown>)
        : (experiment['variantB'] as Record<string, unknown>);
      return { variant, config, experimentId };
    }

    // Deterministic hash-based assignment
    const hash = createHash('sha256')
      .update(`${experimentKey}:${userId}`)
      .digest('hex');
    const bucket = parseInt(hash.slice(0, 8), 16) % 100;
    const splitPct = Math.round((experiment['splitRatio'] as number) * 100);
    const variant: 'A' | 'B' = bucket < splitPct ? 'B' : 'A';

    // Persist sticky assignment
    await this.g4.experimentAssignment.create({
      data: { experimentId, userId, variant },
    });

    const config = variant === 'A'
      ? (experiment['variantA'] as Record<string, unknown>)
      : (experiment['variantB'] as Record<string, unknown>);

    return { variant, config, experimentId };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXPERIMENT METRICS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Compute per-variant metrics for an experiment:
   * - Assignment counts (A vs B)
   * - Average XP per variant (in last 30d)
   * - Badge unlock rate per variant (in last 30d)
   * - 7-day retention proxy (had an XP event 7+ days after first assignment)
   */
  async getExperimentMetrics(experimentId: string): Promise<ExperimentMetrics> {
    const experiment = await this.g4.experiment.findUnique({ where: { id: experimentId } });
    if (!experiment) throw new NotFoundException(`Experiment ${experimentId} not found`);

    const [variantAAssignments, variantBAssignments] = await Promise.all([
      this.g4.experimentAssignment.findMany({
        where: { experimentId, variant: 'A' },
        select: { userId: true, assignedAt: true } as Record<string, unknown>,
      }),
      this.g4.experimentAssignment.findMany({
        where: { experimentId, variant: 'B' },
        select: { userId: true, assignedAt: true } as Record<string, unknown>,
      }),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3_600_000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000);

    const computeGroupMetrics = async (
      assignments: Record<string, unknown>[],
    ): Promise<{ xpAvg: number; badgeRate: number; retention7d: number }> => {
      if (assignments.length === 0) return { xpAvg: 0, badgeRate: 0, retention7d: 0 };

      const userIds = assignments.map((a) => a['userId'] as string);

      const [xpRows, badgeCount, retained] = await Promise.all([
        // Average XP per user in last 30 days
        this.prisma.xPEvent.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, xpAmount: { gt: 0 }, createdAt: { gte: thirtyDaysAgo } },
          _sum: { xpAmount: true },
        }),
        // Unique users who earned a badge in last 30 days
        this.prisma.userGamificationBadge.findMany({
          where: { userId: { in: userIds }, awardedAt: { gte: thirtyDaysAgo } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        // Retention: users who had an XP event at least 7d after their assignment
        Promise.all(
          assignments.map(async (a) => {
            const assignedAt = a['assignedAt'] as Date;
            const userId = a['userId'] as string;
            const retentionCheckDate = new Date(assignedAt.getTime() + 7 * 24 * 3_600_000);
            if (retentionCheckDate > new Date()) return false; // too recent to measure
            const event = await this.prisma.xPEvent.findFirst({
              where: { userId, createdAt: { gte: retentionCheckDate }, xpAmount: { gt: 0 } },
              select: { id: true },
            });
            return event !== null;
          }),
        ),
      ]);

      const totalXp = xpRows.reduce((s, r) => s + (r._sum.xpAmount ?? 0), 0);
      const xpAvg = userIds.length > 0 ? Math.round(totalXp / userIds.length) : 0;
      const badgeRate = userIds.length > 0 ? parseFloat(((badgeCount.length / userIds.length) * 100).toFixed(1)) : 0;
      const retainedCount = retained.filter(Boolean).length;
      const measurableCount = assignments.filter((a) => {
        const assignedAt = a['assignedAt'] as Date;
        return new Date(assignedAt.getTime() + 7 * 24 * 3_600_000) <= new Date();
      }).length;
      const retention7d = measurableCount > 0 ? parseFloat(((retainedCount / measurableCount) * 100).toFixed(1)) : 0;

      return { xpAvg, badgeRate, retention7d };
    };

    const [metricsA, metricsB] = await Promise.all([
      computeGroupMetrics(variantAAssignments),
      computeGroupMetrics(variantBAssignments),
    ]);

    return {
      experimentId,
      name: experiment['name'] as string,
      variantACounts: variantAAssignments.length,
      variantBCounts: variantBAssignments.length,
      variantAXpAvg: metricsA.xpAvg,
      variantBXpAvg: metricsB.xpAvg,
      variantABadgeRate: metricsA.badgeRate,
      variantBBadgeRate: metricsB.badgeRate,
      variantARetention7d: metricsA.retention7d,
      variantBRetention7d: metricsB.retention7d,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SYSTEM CONFIG (LIVE WEIGHT TUNING)
  // ════════════════════════════════════════════════════════════════════════════

  async listConfigs(category?: string): Promise<SystemConfigRecord[]> {
    const where: Record<string, unknown> = {};
    if (category) where['category'] = category;

    const rows = await this.g4.systemConfig.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }] as unknown,
    });

    return rows.map((r) => ({
      id: r['id'] as string,
      key: r['key'] as string,
      value: r['value'],
      description: (r['description'] as string | null) ?? null,
      category: (r['category'] as string | null) ?? null,
      updatedById: (r['updatedById'] as string | null) ?? null,
      updatedAt: r['updatedAt'] as Date,
    }));
  }

  async upsertConfig(params: {
    key: string;
    value: unknown;
    description?: string;
    category?: string;
    updatedById: string;
  }): Promise<SystemConfigRecord> {
    const row = await this.g4.systemConfig.upsert({
      where: { key: params.key },
      create: {
        key: params.key,
        value: params.value,
        description: params.description ?? null,
        category: params.category ?? null,
        updatedById: params.updatedById,
      },
      update: {
        value: params.value,
        description: params.description ?? null,
        category: params.category ?? null,
        updatedById: params.updatedById,
      },
    });

    this.logger.log(`SystemConfig upserted: key=${params.key} by=${params.updatedById}`);

    return {
      id: row['id'] as string,
      key: row['key'] as string,
      value: row['value'],
      description: (row['description'] as string | null) ?? null,
      category: (row['category'] as string | null) ?? null,
      updatedById: (row['updatedById'] as string | null) ?? null,
      updatedAt: row['updatedAt'] as Date,
    };
  }

  async deleteConfig(key: string): Promise<void> {
    await this.g4.systemConfig.delete({ where: { key } });
  }

  /**
   * Bulk-seed default XP/readiness configs on first boot if none exist.
   * Idempotent — skips keys that already exist.
   */
  async seedDefaultConfigs(adminId: string): Promise<number> {
    const defaults: Array<{ key: string; value: unknown; description: string; category: string }> = [
      // XP base values
      { key: 'xp.CREATE_ARTIFACT.base', value: 40, description: 'Base XP for creating an artifact', category: 'xp_weights' },
      { key: 'xp.COMPLETE_ARTIFACT.base', value: 80, description: 'Base XP for completing an artifact', category: 'xp_weights' },
      { key: 'xp.IMPROVE_ARTIFACT.base', value: 25, description: 'Base XP for improving an artifact', category: 'xp_weights' },
      { key: 'xp.COMPLETE_MILESTONE.base', value: 120, description: 'Base XP for milestone completion', category: 'xp_weights' },
      { key: 'xp.RECEIVE_MENTOR_FEEDBACK.base', value: 60, description: 'Base XP for receiving mentor feedback', category: 'xp_weights' },
      { key: 'xp.APPLY_FEEDBACK.base', value: 90, description: 'Base XP for applying mentor feedback', category: 'xp_weights' },
      // Readiness weights
      { key: 'readiness.problemClarity.weight', value: 0.15, description: 'Readiness: problem clarity dimension weight', category: 'readiness_weights' },
      { key: 'readiness.solutionClarity.weight', value: 0.15, description: 'Readiness: solution clarity dimension weight', category: 'readiness_weights' },
      { key: 'readiness.artifactCompleteness.weight', value: 0.20, description: 'Readiness: artifact completeness weight', category: 'readiness_weights' },
      { key: 'readiness.teamCompleteness.weight', value: 0.15, description: 'Readiness: team completeness weight', category: 'readiness_weights' },
      // Abuse thresholds
      { key: 'abuse.burst.maxEvents', value: 10, description: 'Max XP events in burst window before flag', category: 'abuse_thresholds' },
      { key: 'abuse.burst.windowMins', value: 5, description: 'Burst detection window in minutes', category: 'abuse_thresholds' },
      { key: 'abuse.suppress.hours', value: 24, description: 'Hours to suppress burst-abuser', category: 'abuse_thresholds' },
      { key: 'abuse.emptyEntity.maxRatio', value: 0.8, description: 'Max ratio of empty-entity events before flag', category: 'abuse_thresholds' },
      // Streak config
      { key: 'streak.graceDays', value: 2, description: 'Grace window days for streak', category: 'streak_config' },
      { key: 'streak.softDecayFactor', value: 0.5, description: 'Soft decay multiplier on streak break', category: 'streak_config' },
    ];

    let seeded = 0;
    for (const d of defaults) {
      const existing = await this.g4.systemConfig.findUnique({ where: { key: d.key } });
      if (!existing) {
        await this.upsertConfig({ ...d, updatedById: adminId });
        seeded++;
      }
    }

    this.logger.log(`SystemConfig: seeded ${seeded} default configs`);
    return seeded;
  }
}
