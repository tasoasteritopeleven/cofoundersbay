import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { byBasis, endorsementBasis, sameSkill } from '@cofounderbay/shared';
import { EndorsementsService } from '../endorsements/endorsements.service';
import { SkillEvidenceService } from './skill-evidence.service';

describe('evidence rules', () => {
  it('names the basis it can see, strongest first, and nothing without one', () => {
    expect(endorsementBasis({ agreedThreads: 1, completedSessions: 2, sharedCohorts: 1 })).toEqual(['agreement', 'mentoring', 'cohort']);
    expect(endorsementBasis({ agreedThreads: 0, completedSessions: 0, sharedCohorts: 1 })).toEqual(['cohort']);
    expect(endorsementBasis({ agreedThreads: 0, completedSessions: 0, sharedCohorts: 0 })).toEqual([]);
  });

  it('puts verified endorsements first and keeps the rest in order', () => {
    const list = [{ id: 'a', basis: [] }, { id: 'b', basis: ['mentoring'] }, { id: 'c', basis: null }, { id: 'd', basis: ['cohort'] }];
    expect(byBasis(list).map((e) => e.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('treats spelling variants of one skill as the same skill', () => {
    expect(sameSkill('Go-to-market', 'go to market')).toBe(true);
    expect(sameSkill('Product', 'Product design')).toBe(false);
  });
});

describe('EndorsementsService basis', () => {
  function prisma(facts: { agreed: number; sessions: number; shared: number }) {
    return {
      commitmentThread: { count: vi.fn(async () => facts.agreed) },
      mentorshipSession: { count: vi.fn(async () => facts.sessions) },
      cohortMember: { findMany: vi.fn(async () => [{ cohortId: 'athens-1' }]), count: vi.fn(async () => facts.shared) },
      user: { findUnique: vi.fn(async () => ({ id: 'elena', profile: { displayName: 'Elena' } })) },
      endorsement: {
        findUnique: vi.fn(async ({ where }: any) => (where.id ? { id: 'e1', fromUserId: 'alex', toUserId: 'elena' } : null)),
        create: vi.fn(async ({ data }: any) => ({ id: 'e1', ...data, createdAt: new Date(), fromUser: { id: 'alex', profile: { displayName: 'Alex', avatarUrl: null, headline: null } } })),
        update: vi.fn(async () => ({})),
      },
    };
  }

  it('stores what the platform can see when the endorsement is written, and checks again on approval', async () => {
    const db = prisma({ agreed: 0, sessions: 1, shared: 0 });
    const service = new EndorsementsService(db as never, { createNotification: vi.fn(async () => ({})) } as never);
    const created = await service.createEndorsement('alex', 'elena', { content: 'Sharp on discovery.' });
    expect(created.basis).toEqual(['mentoring']);
    expect(db.endorsement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ basis: ['mentoring'] }) }));

    db.commitmentThread.count.mockResolvedValue(1);
    await service.approveEndorsement('elena', 'e1');
    expect(db.endorsement.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { isApproved: true, basis: ['agreement', 'mentoring'] } });
  });

  it('leaves an endorsement unlabelled, not failed, when the relationship cannot be read', async () => {
    const service = new EndorsementsService({ commitmentThread: { count: vi.fn(async () => { throw new Error('down'); }) } } as never, {} as never);
    expect(await service.basisBetween('alex', 'elena')).toEqual([]);
  });
});

function setup() {
  const rows: any[] = [];
  const db = {
    milestone: { findMany: vi.fn(async () => [{ id: 'm1', title: 'First paid pilot', updatedAt: new Date('2026-09-01') }]) },
    builderDocument: { findMany: vi.fn(async () => [{ id: 'd1', title: 'Go-to-market plan', updatedAt: new Date('2026-09-02') }]) },
    commitmentThread: { findMany: vi.fn(async () => [{ id: 't1', agreedAt: new Date('2026-09-03'), card: { title: 'Designer for readiness' } }]) },
    profile: { findUnique: vi.fn(async () => ({ skills: [{ skill: { name: 'Go-to-market' } }, { skill: { name: 'Product' } }] })) },
    endorsement: {
      findMany: vi.fn(async () => [
        { skill: 'go to market', basis: ['agreement'] },
        { skill: 'Go-to-market', basis: [] },
        { skill: 'Fundraising', basis: [] },
      ]),
    },
    skillEvidence: {
      findMany: vi.fn(async ({ select }: any = {}) => (select ? rows.map(({ skillName, kind, refId }) => ({ skillName, kind, refId })) : rows)),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `ev${rows.length + 1}`, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      delete: vi.fn(async ({ where }: any) => void rows.splice(rows.findIndex((r) => r.id === where.id), 1)),
    },
  };
  return { service: new SkillEvidenceService(db as never), db, rows };
}

describe('SkillEvidenceService', () => {
  it('offers only the person’s own completed work, with titles from the server', async () => {
    const { service } = setup();
    const { candidates } = await service.candidates('alex');
    expect(candidates.map((c) => `${c.kind}:${c.refId}`)).toEqual(['milestone:m1', 'builder_document:d1', 'agreement:t1']);
  });

  it('links evidence it can find among them, refuses what it cannot, and never twice', async () => {
    const { service } = setup();
    const { evidence } = await service.link('alex', { skillName: 'Go-to-market', kind: 'builder_document', refId: 'd1', label: 'ignored' });
    expect(evidence).toMatchObject({ skillName: 'Go-to-market', label: 'Go-to-market plan' });
    await expect(service.link('alex', { skillName: 'go to market', kind: 'builder_document', refId: 'd1' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.link('alex', { skillName: 'Product', kind: 'milestone', refId: 'someone-elses' })).rejects.toBeInstanceOf(NotFoundException);
    const bad = await service.link('alex', { skillName: '', kind: 'milestone', refId: 'm1' }).catch((e) => e);
    expect(bad.getResponse().error.details).toMatchObject({ reason: 'skill_name', messageEl: expect.any(String) });
  });

  it('lists each skill once, with linked evidence and how many endorsements have a verified basis', async () => {
    const { service } = setup();
    await service.link('alex', { skillName: 'go-to-market', kind: 'milestone', refId: 'm1' });
    const { skills } = await service.forUser('alex');
    expect(skills.map((s) => s.name)).toEqual(['Go-to-market', 'Product', 'Fundraising']);
    expect(skills[0]).toMatchObject({ endorsements: 2, verifiedEndorsements: 1, evidence: [{ kind: 'milestone', label: 'First paid pilot' }] });
    expect(skills[1]).toMatchObject({ endorsements: 0, evidence: [] });
  });

  it('lets only the owner unlink, and hands back what Undo needs', async () => {
    const { service } = setup();
    const { evidence } = await service.link('alex', { skillName: 'Product', kind: 'agreement', refId: 't1' });
    await expect(service.unlink('marcus', evidence.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.unlink('alex', evidence.id)).toEqual({ ok: true, restore: { skillName: 'Product', kind: 'agreement', refId: 't1' } });
  });
});
