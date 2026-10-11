import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BuilderService } from './builder.service';
import { ReadinessDimension } from './dto/builder.dto';

const workspaceId = 'workspace-1';
const userId = 'owner-1';
const assessedAt = new Date('2026-05-01T10:00:00Z');

function storedScore(dimension = ReadinessDimension.TEAM) {
  return {
    id: `score-${dimension}`, workspaceId, dimension, score: 25, maxScore: 100,
    assessedAt, version: 2,
    criteria: [
      { id: 't1', name: 'Co-founder identified', completed: true, weight: 25 },
      { id: 't2', name: 'Complementary skills', completed: false, weight: 75 },
    ],
  };
}

let prisma: any;
let service: BuilderService;

beforeEach(() => {
  prisma = {
    builderWorkspace: { findUnique: vi.fn().mockResolvedValue({ ownerId: userId, collaborators: [], visibility: 'private' }) },
    builderReadinessScore: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'new-score', ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ id: 'score-team', ...data })),
    },
    builderActivityLog: { create: vi.fn().mockResolvedValue({}) },
  };
  service = new BuilderService(prisma, {} as any);
});

describe('readiness assessment contract', () => {
  it('retains builder fields and adds the canonical envelope without pretending unsaved dimensions were assessed', async () => {
    const response: any = await service.assessReadiness(userId, { workspaceId });
    expect(response).toMatchObject({ workspaceId, overallScore: 0, overallStatus: 'critical', readinessLevel: 'idea' });
    expect(response.assessedAt).toBeInstanceOf(Date);
    expect(response.blockers).toHaveLength(6);
    expect(response.nextMilestones.length).toBeGreaterThan(0);
    expect(response.assessment).toMatchObject({
      overallScore: 0, overallMax: 100, lastAssessedAt: null, acceleratorReadiness: 0, investorReadiness: 0,
    });
    expect(response.assessment.dimensions).toHaveLength(6);
    expect(response.assessment.dimensions[0]).toMatchObject({ id: null, workspaceId, assessedAt: null, maxScore: 100 });
    expect(response.assessment.dimensions).toEqual(response.dimensions);
    expect(response.dimensions.flatMap((d: any) => d.criteria).every((c: any) => !c.completed)).toBe(true);
    expect(prisma.builderReadinessScore.create).not.toHaveBeenCalled();
    expect(prisma.builderReadinessScore.update).not.toHaveBeenCalled();
  });

  it('uses existing scores, persisted dates and incomplete persisted criteria for recommendations', async () => {
    prisma.builderReadinessScore.findFirst.mockResolvedValue(storedScore());
    const response: any = await service.assessReadiness(userId, { workspaceId, dimensions: [ReadinessDimension.TEAM] });
    expect(response.assessment).toMatchObject({ overallScore: 25, acceleratorReadiness: 25, investorReadiness: 25, lastAssessedAt: assessedAt });
    expect(response.dimensions[0]).toMatchObject({ id: 'score-team', assessedAt, recommendations: ['Complete: Complementary skills'] });
    expect(prisma.builderReadinessScore.findFirst).toHaveBeenCalledWith({ where: { workspaceId, dimension: 'team' }, orderBy: { version: 'desc' } });
  });

  it('calculates weighted readiness once from the actual dimensions and their max scores', async () => {
    prisma.builderReadinessScore.findFirst.mockImplementation(async ({ where }: any) =>
      where.dimension === 'team' ? { ...storedScore(), score: 50, maxScore: 50 } : null);
    const response: any = await service.assessReadiness(userId, { workspaceId });
    expect(response.assessment).toMatchObject({ overallScore: 17, acceleratorReadiness: 25, investorReadiness: 30 });
    expect(response.dimensions[0]).toMatchObject({ score: 50, maxScore: 50, status: 'excellent' });
  });

  it('uses the latest saved dimension timestamp, not the refresh time', async () => {
    const later = new Date('2026-05-02T10:00:00Z');
    prisma.builderReadinessScore.findFirst.mockImplementation(async ({ where }: any) =>
      ({ ...storedScore(where.dimension), assessedAt: where.dimension === 'market' ? later : assessedAt }));
    const response: any = await service.assessReadiness(userId, { workspaceId });
    expect(response.assessment.lastAssessedAt).toEqual(later);
  });

  it('rejects an empty dimension selection instead of returning NaN', async () => {
    await expect(service.assessReadiness(userId, { workspaceId, dimensions: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deduplicates requested dimensions so weighting cannot be skewed', async () => {
    const response: any = await service.assessReadiness(userId, { workspaceId, dimensions: [ReadinessDimension.TEAM, ReadinessDimension.TEAM] });
    expect(response.dimensions).toHaveLength(1);
  });

  it('does not bypass workspace authorization', async () => {
    prisma.builderWorkspace.findUnique.mockResolvedValue({ ownerId: 'someone-else', collaborators: [], visibility: 'private' });
    await expect(service.assessReadiness(userId, { workspaceId })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.builderReadinessScore.findFirst).not.toHaveBeenCalled();
  });

  it('reports a missing workspace without querying scores', async () => {
    prisma.builderWorkspace.findUnique.mockResolvedValue(null);
    await expect(service.assessReadiness(userId, { workspaceId })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.builderReadinessScore.findFirst).not.toHaveBeenCalled();
  });
});

describe('criterion updates', () => {
  it('rejects unknown criteria without writing an apparently successful assessment', async () => {
    await expect(service.updateReadinessCriterion(userId, workspaceId, {
      dimension: ReadinessDimension.TEAM, criterionId: 'invented-demo-id', completed: true,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.builderReadinessScore.create).not.toHaveBeenCalled();
    expect(prisma.builderReadinessScore.update).not.toHaveBeenCalled();
  });

  it('preserves the raw mutation contract and persists the requested criterion score', async () => {
    const result = await service.updateReadinessCriterion(userId, workspaceId, {
      dimension: ReadinessDimension.TEAM, criterionId: 't1', completed: true,
    });
    expect(result.score).toBe(25);
    expect(prisma.builderReadinessScore.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId, dimension: 'team', score: 25, assessedById: userId }) });
  });

  it('requires editor access for writes even when the workspace is public', async () => {
    prisma.builderWorkspace.findUnique.mockResolvedValue({ ownerId: 'someone-else', collaborators: [], visibility: 'public' });
    await expect(service.updateReadinessCriterion(userId, workspaceId, {
      dimension: ReadinessDimension.TEAM, criterionId: 't1', completed: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.builderReadinessScore.create).not.toHaveBeenCalled();
  });
});
