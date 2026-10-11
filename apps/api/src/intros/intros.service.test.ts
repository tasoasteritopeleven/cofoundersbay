import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { introPaths, introTransition, knowsDirectly, readIntroRequest, type IntroGraph } from '@cofounderbay/shared';
import { IntrosService } from './intros.service';

/**
 * The cast: Alex (founder) is connected to Elena and was in a cohort with
 * Sofia. Elena is connected to Nikos (an angel); Sofia mentors Nikos's
 * portfolio founder Yannis. Marcus knows nobody here.
 */
const GRAPH: IntroGraph = {
  connections: [
    ['alex', 'elena'],
    ['elena', 'nikos'],
    ['sofia', 'nikos'],
  ],
  mentorships: [{ mentorId: 'elena', menteeId: 'nikos' }],
  cohorts: [
    { cohortId: 'athens-1', userId: 'alex' },
    { cohortId: 'athens-1', userId: 'sofia' },
  ],
};

describe('intro rules', () => {
  it('finds the people who know both, strongest first, and never the two themselves', () => {
    const paths = introPaths(GRAPH, 'alex', 'nikos');
    expect(paths.map((p) => p.intermediaryId)).toEqual(['elena', 'sofia']);
    expect(paths[0]).toEqual({ intermediaryId: 'elena', toRequester: ['connection'], toTarget: ['connection', 'mentor'] });
    expect(paths[1]).toEqual({ intermediaryId: 'sofia', toRequester: ['cohort'], toTarget: ['connection'] });
    expect(introPaths(GRAPH, 'alex', 'alex')).toEqual([]);
    expect(introPaths(GRAPH, 'marcus', 'nikos')).toEqual([]);
    expect(knowsDirectly(GRAPH, 'alex', 'elena')).toBe(true);
    expect(knowsDirectly(GRAPH, 'alex', 'nikos')).toBe(false);
  });

  it('gives each hop its own decision', () => {
    expect(introTransition('pending', 'intermediary', 'forward')).toBe('forwarded');
    expect(introTransition('pending', 'intermediary', 'decline')).toBe('declined');
    expect(introTransition('pending', 'target', 'accept')).toBeNull();
    expect(introTransition('forwarded', 'target', 'accept')).toBe('accepted');
    expect(introTransition('forwarded', 'requester', 'withdraw')).toBeNull();
    expect(introTransition('pending', 'requester', 'withdraw')).toBe('withdrawn');
  });

  it('wants three different people, a card, and a note without contact details', () => {
    expect(readIntroRequest({ intermediaryId: 'elena', targetId: 'nikos', cardId: 'c1', note: 'Pre-seed for Harbor.' }, 'alex')).toMatchObject({ ok: true });
    expect(readIntroRequest({ intermediaryId: 'alex', targetId: 'nikos', cardId: 'c1', note: 'x' }, 'alex')).toMatchObject({ ok: false, problems: ['self'] });
    expect(readIntroRequest({ intermediaryId: 'elena', targetId: 'nikos', cardId: '', note: 'Call me on +30 690 000 0000' }, 'alex')).toMatchObject({
      ok: false,
      problems: ['card', 'contact'],
    });
  });
});

function setup() {
  const intros: any[] = [];
  const threads: Array<{ cardId: string; candidateId: string; id: string }> = [];
  const users = ['alex', 'elena', 'sofia', 'nikos', 'marcus'];
  const cards: Record<string, { id: string; ownerId: string; title: string; status: string }> = {
    c1: { id: 'c1', ownerId: 'alex', title: 'Angel intro for Harbor', status: 'open' },
    closed: { id: 'closed', ownerId: 'alex', title: 'Old card', status: 'closed' },
    elenas: { id: 'elenas', ownerId: 'elena', title: 'Elena’s card', status: 'open' },
  };
  const touches = (ids: string[], ...xs: string[]) => xs.some((x) => ids.includes(x));
  const prisma = {
    connectionRequest: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids = where.OR[0].requesterId.in;
        return GRAPH.connections.filter(([a, b]) => touches(ids, a, b)).map(([a, b]) => ({ requesterId: a, receiverId: b }));
      }),
    },
    mentorshipRelationship: {
      findMany: vi.fn(async ({ where }: any) => GRAPH.mentorships.filter((m) => touches(where.OR[0].mentorId.in, m.mentorId, m.menteeId))),
    },
    cohortMember: {
      findMany: vi.fn(async ({ where }: any) =>
        where.userId ? GRAPH.cohorts.filter((c) => where.userId.in.includes(c.userId)) : GRAPH.cohorts.filter((c) => where.cohortId.in.includes(c.cohortId)),
      ),
    },
    user: {
      findMany: vi.fn(async ({ where }: any) =>
        users.filter((u) => where.id.in.includes(u)).map((id) => ({ id, profile: { displayName: id[0].toUpperCase() + id.slice(1), headline: null, avatarUrl: null } })),
      ),
    },
    commitmentCard: {
      findUnique: vi.fn(async ({ where }: any) => cards[where.id] ?? null),
      findMany: vi.fn(async ({ where }: any) => Object.values(cards).filter((c) => (where.ownerId ? c.ownerId === where.ownerId : where.id.in.includes(c.id)))),
    },
    commitmentThread: {
      findUnique: vi.fn(async ({ where }: any) => threads.find((t) => t.cardId === where.cardId_candidateId.cardId && t.candidateId === where.cardId_candidateId.candidateId) ?? null),
    },
    introRequest: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `i${intros.length + 1}`, status: 'pending', forwardNote: null, threadId: null, decidedAt: null, createdAt: new Date(), ...data };
        intros.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        if (where.OR) {
          return intros.filter((r) =>
            where.OR.some((c: any) => (c.requesterId && r.requesterId === c.requesterId) || (c.intermediaryId && r.intermediaryId === c.intermediaryId) || (c.targetId && r.targetId === c.targetId && c.status.in.includes(r.status))),
          );
        }
        return intros.filter((r) => r.requesterId === where.requesterId && where.status.in.includes(r.status));
      }),
      findUnique: vi.fn(async ({ where }: any) => intros.find((r) => r.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => Object.assign(intros.find((r) => r.id === where.id), data)),
    },
  };
  const notifications = { createNotification: vi.fn(async () => ({})) };
  const commitments = {
    expressInterest: vi.fn(async (viewer: { id: string }, cardId: string) => {
      const thread = { id: `t${threads.length + 1}`, cardId, candidateId: viewer.id };
      threads.push(thread);
      return { thread: { ...thread, step: 'interest' } };
    }),
  };
  const verification = { publicMethods: vi.fn(async () => ['work_email']), roleCleared: vi.fn(async (_id: string) => true) };
  const service = new IntrosService(prisma as never, notifications as never, commitments as never, verification as never);
  return { service, notifications, commitments, intros, verification };
}

const ask = { intermediaryId: 'elena', targetId: 'nikos', cardId: 'c1', note: 'Raising a pre-seed for Harbor; you know Nikos well.' };

describe('IntrosService', () => {
  it('offers the paths and the founder’s open cards only', async () => {
    const { service } = setup();
    const res = await service.paths('alex', 'nikos');
    expect(res.direct).toBe(false);
    expect(res.paths.map((p) => p.intermediary.displayName)).toEqual(['Elena', 'Sofia']);
    expect(res.cards.map((c) => c.id)).toEqual(['c1']);
  });

  it('runs the whole consent chain: forward, then the target accepts onto the card’s ladder', async () => {
    const { service, notifications, commitments } = setup();
    const { intro } = await service.request('alex', ask);
    expect(intro).toMatchObject({ role: 'requester', status: 'pending', toRequester: ['connection'], toTarget: ['connection', 'mentor'] });
    expect(notifications.createNotification).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'elena', type: 'intro_request' }));

    // Nikos cannot see or act on it before Elena forwards it.
    expect((await service.list('nikos')).received).toEqual([]);
    await expect(service.accept('nikos', intro.id)).rejects.toBeInstanceOf(ForbiddenException);

    await service.forward('elena', intro.id, { note: 'Worth half an hour.' });
    expect((await service.list('nikos')).received[0]).toMatchObject({ status: 'forwarded', forwardNote: 'Worth half an hour.' });

    const accepted = await service.accept('nikos', intro.id);
    expect(commitments.expressInterest).toHaveBeenCalledWith({ id: 'nikos' }, 'c1', { note: 'Introduced by Elena.' });
    expect(accepted).toMatchObject({ cardId: 'c1', threadId: 't1', intro: { status: 'accepted' } });
    // The intermediary is told it was accepted, and does not get the thread.
    expect((await service.list('elena')).toForward[0]).toMatchObject({ status: 'accepted', threadId: null });
  });

  it('tells the founder only "not forwarded", and the target nothing, when the intermediary declines', async () => {
    const { service, notifications } = setup();
    const { intro } = await service.request('alex', ask);
    await service.decline('elena', intro.id);
    expect((await service.list('alex')).sent[0].status).toBe('not_forwarded');
    expect((await service.list('nikos')).received).toEqual([]);
    expect(notifications.createNotification).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'nikos' }));
  });

  it('refuses someone who does not know both, a card that is not the founder’s or not open, and a repeat', async () => {
    const { service } = setup();
    const noPath = await service.request('alex', { ...ask, intermediaryId: 'marcus' }).catch((e) => e);
    expect(noPath.getResponse().error.details).toMatchObject({ reason: 'no_path', messageEl: expect.any(String) });
    await expect(service.request('alex', { ...ask, cardId: 'elenas' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.request('alex', { ...ask, cardId: 'closed' })).rejects.toBeInstanceOf(ConflictException);
    await service.request('alex', ask);
    await expect(service.request('alex', ask)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.request('alex', { ...ask, note: '' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps a founder at five waiting introductions, and lets them withdraw only while pending', async () => {
    const { service, intros } = setup();
    const first = await service.request('alex', ask);
    for (let i = 0; i < 4; i++) intros.push({ ...intros[0], id: `x${i}`, targetId: `t${i}` });
    const err = await service.request('alex', { ...ask, intermediaryId: 'sofia', cardId: 'c1', targetId: 'nikos' }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException); // same target and card is a repeat first
    intros[0].targetId = 'someone-else';
    const capped = await service.request('alex', { ...ask, intermediaryId: 'sofia' }).catch((e) => e);
    expect(capped.getResponse().error.details.reason).toBe('too_many_open');
    expect((await service.withdraw('alex', first.intro.id)).intro.status).toBe('withdrawn');
    await expect(service.withdraw('alex', first.intro.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('asks an investor or organisation account to verify its workplace before it takes up an introduction', async () => {
    const { service, commitments, verification } = setup();
    const { intro } = await service.request('alex', ask);
    await service.forward('elena', intro.id, { note: 'Alex is worth twenty minutes.' });
    verification.roleCleared.mockResolvedValueOnce(false);
    await expect(service.accept('nikos', intro.id)).rejects.toMatchObject({ response: { error: { details: { reason: 'role_verification_required' } } } });
    // Nothing reached the founder's card, and the request is still waiting on Nikos.
    expect(commitments.expressInterest).not.toHaveBeenCalled();
    const { threadId } = await service.accept('nikos', intro.id);
    expect(threadId).toBeTruthy();
    expect(verification.roleCleared).toHaveBeenCalledWith('nikos');
  });
});
