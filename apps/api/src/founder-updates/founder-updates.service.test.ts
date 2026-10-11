import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { readFounderUpdate, updateMentionsMoney } from '@cofounderbay/shared';
import { FounderUpdatesService } from './founder-updates.service';

describe('founder update rules', () => {
  it('trims, drops empty rows, defaults to followers, and refuses promised returns', () => {
    const read = readFounderUpdate({ title: ' September ', body: ' Two pilots live. ', metrics: [{ label: 'Clinics', value: '4' }, { label: '', value: '' }], asks: ['Intro to a dental chain', ''] });
    expect(read).toEqual({ ok: true, value: { title: 'September', body: 'Two pilots live.', metrics: [{ label: 'Clinics', value: '4' }], asks: ['Intro to a dental chain'], visibility: 'followers', milestoneId: null } });
    expect(readFounderUpdate({ title: '', body: '' })).toEqual({ ok: false, problems: ['title', 'body'] });
    const promise = readFounderUpdate({ title: 'Raise', body: 'Guaranteed 3x return for early investors' });
    expect(promise.ok === false && promise.problems).toContain('promise');
  });

  it('knows when an update mentions money', () => {
    expect(updateMentionsMoney({ title: 'Q3', body: 'MRR grew', metrics: [], asks: [] })).toBe(true);
    expect(updateMentionsMoney({ title: 'Σεπτέμβριος', body: 'Κλείσαμε γύρο χρηματοδότησης', metrics: [], asks: [] })).toBe(true);
    expect(updateMentionsMoney({ title: 'Hiring', body: 'We met five designers', metrics: [], asks: [] })).toBe(false);
  });
});

function setup() {
  const follows: Array<{ followerId: string; followingId: string; createdAt: Date }> = [];
  const updates: Record<string, any>[] = [];
  const users: Record<string, { id: string; profile: { displayName: string; headline: string | null; avatarUrl: null } }> = {
    elena: { id: 'elena', profile: { displayName: 'Elena', headline: 'Founder', avatarUrl: null } },
    marcus: { id: 'marcus', profile: { displayName: 'Marcus', headline: null, avatarUrl: null } },
    sofia: { id: 'sofia', profile: { displayName: 'Sofia', headline: null, avatarUrl: null } },
  };
  const withAuthor = (u: Record<string, any>) => ({ ...u, author: users[u.authorId] });
  const prisma = {
    user: { findUnique: vi.fn(async ({ where }: any) => users[where.id] ?? null) },
    userFollow: {
      findUnique: vi.fn(async ({ where }: any) => follows.find((f) => f.followerId === where.followerId_followingId.followerId && f.followingId === where.followerId_followingId.followingId) ?? null),
      count: vi.fn(async ({ where }: any) => follows.filter((f) => f.followingId === where.followingId).length),
      create: vi.fn(async ({ data }: any) => void follows.push({ ...data, createdAt: new Date() })),
      deleteMany: vi.fn(async ({ where }: any) => {
        const i = follows.findIndex((f) => f.followerId === where.followerId && f.followingId === where.followingId);
        if (i >= 0) follows.splice(i, 1);
      }),
      findMany: vi.fn(async ({ where }: any) =>
        follows
          .filter((f) => (where.followerId ? f.followerId === where.followerId : f.followingId === where.followingId))
          .map((f) => ({ ...f, following: users[f.followingId] })),
      ),
    },
    founderUpdate: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `up-${updates.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        updates.push(row);
        return withAuthor(row);
      }),
      findMany: vi.fn(async ({ where }: any) => updates.filter((u) => (where.authorId?.in ? where.authorId.in.includes(u.authorId) : u.authorId === where.authorId) && (!where.visibility || u.visibility === where.visibility)).map(withAuthor)),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = updates.find((u) => (where.id ? u.id === where.id : u.publicToken === where.publicToken));
        return row ? withAuthor(row) : null;
      }),
      update: vi.fn(async ({ where, data }: any) => withAuthor(Object.assign(updates.find((u) => u.id === where.id)!, data))),
      delete: vi.fn(async ({ where }: any) => void updates.splice(updates.findIndex((u) => u.id === where.id), 1)),
    },
  };
  const notifications = { createNotification: vi.fn(async () => ({})) };
  return { service: new FounderUpdatesService(prisma as never, notifications as never), notifications, updates };
}

describe('FounderUpdatesService', () => {
  it('follows and unfollows, never oneself, and tells the founder once', async () => {
    const { service, notifications } = setup();
    await expect(service.follow('marcus', 'marcus')).rejects.toBeInstanceOf(BadRequestException);
    expect(await service.follow('marcus', 'elena')).toEqual({ following: true, followers: 1 });
    expect(await service.follow('marcus', 'elena')).toEqual({ following: true, followers: 1 });
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect((await service.following('marcus')).people.map((p) => p.displayName)).toEqual(['Elena']);
    expect(await service.unfollow('marcus', 'elena')).toEqual({ following: false, followers: 0 });
  });

  it('sends an update to followers only, and keeps a followers-only update from everyone else', async () => {
    const { service, notifications } = setup();
    await service.follow('marcus', 'elena');
    notifications.createNotification.mockClear();
    const { update, notified } = await service.create('elena', { title: 'September', body: 'Two pilots live.', metrics: [{ label: 'Clinics', value: '4' }] });
    expect(notified).toBe(1);
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'marcus', type: 'founder_update', title: 'Elena: September' }));
    expect(update).toMatchObject({ mine: true, visibility: 'followers', publicToken: null });
    expect((await service.feed('marcus')).updates).toHaveLength(1);
    expect((await service.feed('sofia')).updates).toHaveLength(0);
    await expect(service.get('sofia', update.id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.get('marcus', update.id)).update.title).toBe('September');
  });

  it('shows a profile the updates its reader may read: all to the author and followers, public ones to anyone else', async () => {
    const { service } = setup();
    await service.create('elena', { title: 'For followers', body: 'Two pilots live.' });
    await service.create('elena', { title: 'For everyone', body: 'Seed round open.', visibility: 'public' });
    expect((await service.byAuthor('elena', 'elena')).updates.map((u) => u.title).sort()).toEqual(['For everyone', 'For followers']);
    expect(await service.byAuthor('sofia', 'elena')).toMatchObject({ following: false, updates: [{ title: 'For everyone' }] });
    await service.follow('marcus', 'elena');
    const asFollower = await service.byAuthor('marcus', 'elena');
    expect(asFollower.following).toBe(true);
    expect(asFollower.updates).toHaveLength(2);
    expect(asFollower.updates.every((u) => u.publicToken === null)).toBe(true);
  });

  it('gives a public update a token only its author sees, and serves it without ids', async () => {
    const { service } = setup();
    const { update } = await service.create('elena', { title: 'Seed round open', body: 'Raising €500k.', visibility: 'public' });
    expect(update.publicToken).toMatch(/^[\w-]{16}$/);
    const asReader = await service.get('sofia', update.id);
    expect(asReader.update.publicToken).toBeNull();
    const pub = await service.getPublic(update.publicToken as string);
    expect(pub.update).toMatchObject({ title: 'Seed round open', author: { displayName: 'Elena', headline: 'Founder' } });
    expect(JSON.stringify(pub)).not.toMatch(/"id"|elena"|up-1/);
    await service.setVisibility('elena', update.id, 'followers');
    await expect(service.getPublic(update.publicToken as string)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses an invalid update in both languages, and lets only the author change or delete it', async () => {
    const { service } = setup();
    const err = await service.create('elena', { title: '', body: '' }).catch((e) => e);
    expect(err.getResponse().error.details).toMatchObject({ reason: 'update_invalid', problems: ['title', 'body'], messageEl: expect.stringContaining('τίτλο') });
    const { update } = await service.create('elena', { title: 'x', body: 'y' });
    await expect(service.remove('marcus', update.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setVisibility('marcus', update.id, 'public')).rejects.toBeInstanceOf(ForbiddenException);
    expect(await service.remove('elena', update.id)).toEqual({ ok: true });
  });
});
