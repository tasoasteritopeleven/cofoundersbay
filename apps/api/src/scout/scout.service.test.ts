import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { draftScoutNote, pickScoutProposals, readScoutBrief, scoreScoutCandidate, type ScoutBrief, type ScoutCandidate } from '@cofounderbay/shared';
import { ScoutService } from './scout.service';

const BRIEF: ScoutBrief = { role: 'Technical co-founder', skills: ['TypeScript', 'AI'], place: 'Athens', remoteOk: true, commitment: 'full_time', stage: 'building', note: null, active: true };
const candidate = (over: Partial<ScoutCandidate> = {}): ScoutCandidate => ({
  userId: 'marcus',
  displayName: 'Marcus Chen',
  headline: 'Technical cofounder · Full-stack',
  location: 'Berlin, Germany',
  skills: ['TypeScript', 'Next.js', 'AI'],
  openTo: [],
  openToVisible: [],
  verified: false,
  ...over,
});

describe('scout rules', () => {
  it('reads a brief, dedupes skills and refuses contact details', () => {
    expect(readScoutBrief({ role: ' CTO ', skills: 'TypeScript, typescript, AI' })).toMatchObject({ ok: true, value: { role: 'CTO', skills: ['TypeScript', 'AI'], remoteOk: true } });
    expect(readScoutBrief({ role: '' })).toEqual({ ok: false, problems: ['role'] });
    expect(readScoutBrief({ role: 'CTO', note: 'email me a@b.co' })).toMatchObject({ ok: false, problems: ['contact'] });
  });

  it('scores with a reason for each part, and names an Open-to signal only where it is visible', () => {
    const hidden = scoreScoutCandidate(BRIEF, candidate({ openTo: ['cofounder'], openToVisible: [] }));
    const shown = scoreScoutCandidate(BRIEF, candidate({ openTo: ['cofounder'], openToVisible: ['cofounder'], verified: true }));
    expect(hidden.score).toBe(50 + 15 + 5 + 10);
    expect(hidden.reasons.map((r) => r.en)).toEqual(['Skills you asked for: TypeScript, AI', 'Their headline matches the role']);
    expect(shown.reasons.map((r) => r.en)).toContain('Open to co-founding');
    expect(shown.reasons.map((r) => r.el)).toContain('Επαληθευμένος/η');
    expect(scoreScoutCandidate(BRIEF, candidate({ location: 'Athens, Greece' })).reasons.map((r) => r.en)).toContain('In Athens, Greece');
  });

  it('drafts a note with no contact details, in the founder’s language', () => {
    expect(draftScoutNote(BRIEF, candidate())).toBe('Hi Marcus, I am looking for a Technical co-founder for a startup at the building stage. Your work in TypeScript, AI stood out. Would you be open to a short conversation here on CoFounderBay?');
    expect(draftScoutNote(BRIEF, candidate(), 'el')).toMatch(/^Γεια σας Marcus/);
  });

  it('keeps the best few above the floor', () => {
    expect(pickScoutProposals([{ score: 20 }, { score: 90 }, { score: 31 }, { score: 60 }], 2).map((p) => p.score)).toEqual([90, 60]);
  });
});

function setup() {
  const proposals: any[] = [];
  const saved: any[] = [];
  let brief: any = null;
  const users = [
    { id: 'marcus', profile: { displayName: 'Marcus Chen', headline: 'Technical cofounder · Full-stack', location: 'Berlin', avatarUrl: null, skills: [{ skill: { name: 'TypeScript' } }, { skill: { name: 'AI' } }] } },
    { id: 'sofia', profile: { displayName: 'Sofia Alexiou', headline: 'Founder at Meltemi', location: 'Athens', avatarUrl: null, skills: [{ skill: { name: 'Growth' } }] } },
    { id: 'elena', profile: { displayName: 'Elena', headline: 'Technical lead', location: 'Athens', avatarUrl: null, skills: [{ skill: { name: 'TypeScript' } }] } },
  ];
  const prisma = {
    scoutBrief: {
      findUnique: vi.fn(async () => brief),
      upsert: vi.fn(async ({ create }: any) => (brief = { lastRunAt: null, ...create })),
      update: vi.fn(async ({ data }: any) => Object.assign(brief, data)),
      findMany: vi.fn(async () => (brief ? [{ userId: brief.userId }] : [])),
    },
    scoutProposal: {
      findMany: vi.fn(async ({ where, select }: any) => {
        const rows = proposals.filter((p) => p.userId === where.userId && (!where.status || where.status.in.includes(p.status)));
        return select ? rows.map((r) => ({ candidateId: r.candidateId })) : rows;
      }),
      create: vi.fn(async ({ data }: any) => proposals.push({ id: `p${proposals.length + 1}`, status: 'proposed', createdAt: new Date(), ...data })),
      findUnique: vi.fn(async ({ where }: any) => proposals.find((p) => p.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => Object.assign(proposals.find((p) => p.id === where.id), data)),
    },
    connectionRequest: { findMany: vi.fn(async () => [{ requesterId: 'alex', receiverId: 'elena' }]) },
    userVerification: { findMany: vi.fn(async () => []) },
    openToSignal: { findMany: vi.fn(async () => [{ userId: 'marcus', kinds: ['cofounder'], visibility: 'nobody', note: null, expiresAt: new Date(Date.now() + 86_400_000) }]) },
    user: {
      findMany: vi.fn(async ({ where, select }: any) => {
        if (where.id?.notIn) return users.filter((u) => !where.id.notIn.includes(u.id));
        return users.filter((u) => where.id.in.includes(u.id)).map((u) => (select ? { id: u.id, profile: u.profile } : u));
      }),
    },
    savedProfile: { upsert: vi.fn(async ({ create }: any) => saved.push(create)) },
  };
  const notifications = { createNotification: vi.fn(async () => ({})) };
  return { service: new ScoutService(prisma as never, notifications as never), prisma, notifications, proposals, saved };
}

describe('ScoutService', () => {
  it('proposes from the base, skipping people the founder already knows, and contacts nobody', async () => {
    const { service, notifications, proposals } = setup();
    await service.setBrief('alex', { role: 'Technical co-founder', skills: ['TypeScript', 'AI'], place: 'Athens' });
    const res = await service.run('alex');
    expect(res.added).toBe(1);
    expect(proposals.map((p) => p.candidateId)).toEqual(['marcus']); // elena is a connection; sofia scores below the floor
    expect(res.proposals[0]).toMatchObject({ status: 'proposed', person: { displayName: 'Marcus Chen' } });
    // The matching-only signal raised the score and was not named.
    expect(JSON.stringify(res.proposals[0].reasons)).not.toContain('Open to');
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('never proposes the same person twice, and a dismissal is permanent unless restored', async () => {
    const { service } = setup();
    await service.setBrief('alex', { role: 'Technical co-founder', skills: ['TypeScript', 'AI'] });
    const first = await service.run('alex');
    await service.dismiss('alex', first.proposals[0].id);
    expect((await service.run('alex')).added).toBe(0);
    expect((await service.get('alex')).proposals).toEqual([]);
    await service.restore('alex', first.proposals[0].id);
    expect((await service.get('alex')).proposals[0].status).toBe('proposed');
  });

  it('saves to the shortlist and only the founder may act on a proposal', async () => {
    const { service, saved } = setup();
    await service.setBrief('alex', { role: 'Technical co-founder', skills: ['TypeScript', 'AI'] });
    const { proposals } = await service.run('alex');
    await expect(service.save('sofia', proposals[0].id)).rejects.toBeInstanceOf(NotFoundException);
    await service.save('alex', proposals[0].id);
    expect(saved).toEqual([{ savedById: 'alex', userId: 'marcus' }]);
    expect((await service.get('alex')).proposals[0].status).toBe('saved');
  });

  it('tells only the founder, and only when a daily pass found someone new', async () => {
    const { service, notifications } = setup();
    await service.setBrief('alex', { role: 'Technical co-founder', skills: ['TypeScript', 'AI'] });
    expect(await service.runDue()).toEqual({ checked: 1, notified: 1 });
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alex', link: '/scout' }));
  });
});
