import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SavedSearchesService, alertIsDue, mergeSeen, newResultIds, readSavedSearchInput, searchTypeFor } from './saved-searches.service';

type Row = Record<string, any>;

/** An in-memory `savedSearch` table, enough for the service's queries. */
function fakePrisma() {
  const rows: Row[] = [];
  let n = 0;
  const savedSearch = {
    findMany: vi.fn(async ({ where }: { where: Row }) =>
      rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v)).map((r) => ({ ...r }))),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const r = rows.find((x) => x.id === where.id);
      return r ? { ...r } : null;
    }),
    count: vi.fn(async ({ where }: { where: Row }) => rows.filter((r) => r.userId === where.userId).length),
    create: vi.fn(async ({ data }: { data: Row }) => {
      const now = new Date('2026-10-07T08:00:00Z');
      const row = { id: `ss-${++n}`, useCount: 0, pendingNewCount: 0, lastUsedAt: null, lastResultCount: null, seenResultIds: [], createdAt: now, updatedAt: now, lastAlertAt: null, ...data };
      rows.push(row);
      return { ...row };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
      const r = rows.find((x) => x.id === where.id)!;
      for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === 'object' && 'increment' in v ? (r[k] ?? 0) + (v as { increment: number }).increment : v;
      return { ...r };
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      rows.splice(rows.findIndex((x) => x.id === where.id), 1);
    }),
  };
  return { prisma: { savedSearch }, rows };
}

type Card = { id: string; ownerId: string; title: string; kind: string; status: string; place: string | null; stage: string; isRemote: boolean; expiresAt: Date | null };

/** Need cards for the `need_cards` scope: status, owner, kind and remote are applied as the API does. */
function cardTable(cards: Card[]) {
  return {
    findMany: vi.fn(async ({ where }: { where: Row }) =>
      cards
        .filter((c) => where.status.in.includes(c.status) && c.ownerId !== where.ownerId.not)
        .filter((c) => !where.kind || where.kind.in.includes(c.kind))
        .filter((c) => !where.isRemote || c.isRemote)
        .filter((c) => !c.expiresAt || c.expiresAt > new Date('2026-10-07T00:00:00Z'))
        .map(({ id, title, kind, place, stage, isRemote }) => ({ id, title, kind, place, stage, isRemote }))),
  };
}

function setup(hits: Array<{ userId: string }>, cards: Card[] = []) {
  const { prisma: base, rows } = fakePrisma();
  const prisma = { ...base, commitmentCard: cardTable(cards) };
  const search = { searchProfiles: vi.fn(async () => ({ hits, total: hits.length })) };
  const notifications = { createNotification: vi.fn(async () => ({})) };
  const service = new SavedSearchesService(prisma as never, search as never, notifications as never);
  return { service, rows, search, notifications, setHits: (h: Array<{ userId: string }>) => search.searchProfiles.mockResolvedValue({ hits: h, total: h.length }) };
}

describe('saved-search input', () => {
  it('keeps known filter keys, drops the rest, and defaults the frequency', () => {
    expect(readSavedSearchInput({ name: ' Fintech CTOs ', query: ' payments ', filters: { roles: ['cofounder', 'cofounder'], evil: ['x'], skills: [] } })).toEqual({
      scope: 'people',
      name: 'Fintech CTOs',
      query: 'payments',
      filters: { roles: ['cofounder'] },
      alertsEnabled: false,
      alertFrequency: 'daily',
    });
  });

  it('refuses a missing name, an unknown frequency and oversized filters', () => {
    expect(() => readSavedSearchInput({ name: '  ' })).toThrow(BadRequestException);
    expect(() => readSavedSearchInput({ name: 'x', alertFrequency: 'hourly' })).toThrow(/alertFrequency/);
    expect(() => readSavedSearchInput({ name: 'x', filters: { skills: Array.from({ length: 21 }, (_, i) => `s${i}`) } })).toThrow(/at most 20/);
    expect(() => readSavedSearchInput({ name: 'x', filters: { skills: 'react' } })).toThrow(/must be a list/);
  });

  it('files a search under the directory its roles point at', () => {
    expect(searchTypeFor({ roles: ['mentor'] })).toBe('mentor');
    expect(searchTypeFor({ roles: ['investor', 'angel_investor'] })).toBe('investor');
    expect(searchTypeFor({})).toBe('cofounder');
  });
});

describe('alert timing and novelty', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const ago = (h: number) => new Date(now - h * 3_600_000);
  it('alerts by frequency, never when alerts are off', () => {
    expect(alertIsDue({ alertEnabled: false, alertFrequency: 'instant', lastAlertAt: null }, now)).toBe(false);
    expect(alertIsDue({ alertEnabled: true, alertFrequency: 'instant', lastAlertAt: ago(1) }, now)).toBe(true);
    expect(alertIsDue({ alertEnabled: true, alertFrequency: 'daily', lastAlertAt: ago(6) }, now)).toBe(false);
    expect(alertIsDue({ alertEnabled: true, alertFrequency: 'daily', lastAlertAt: ago(24) }, now)).toBe(true);
    expect(alertIsDue({ alertEnabled: true, alertFrequency: 'weekly', lastAlertAt: ago(48) }, now)).toBe(false);
  });

  it('names only people not yet shown, never the owner', () => {
    expect(newResultIds([{ userId: 'a' }, { userId: 'b' }, { userId: 'me' }, { userId: 'b' }], ['a'], 'me')).toEqual(['b']);
    expect(mergeSeen(['a'], ['b'])).toEqual(['b', 'a']);
    expect(mergeSeen([], Array.from({ length: 600 }, (_, i) => `u${i}`))).toHaveLength(500);
  });
});

describe('SavedSearchesService', () => {
  it('saves, lists in the client’s shape, and records the baseline so the first alert is about newcomers', async () => {
    const { service, notifications, setHits } = setup([{ userId: 'u-a' }, { userId: 'u-b' }]);
    const { search } = await service.create('me', { name: 'Fintech', filters: { roles: ['cofounder'] }, alertsEnabled: true, alertFrequency: 'instant' });
    expect(search).toMatchObject({ name: 'Fintech', alertsEnabled: true, alertFrequency: 'instant', resultCount: 2, query: '' });
    expect((await service.list('me')).searches).toHaveLength(1);

    // Nobody new: an hour later the alert pass stays quiet.
    const later = Date.now() + 2 * 3_600_000;
    expect(await service.runDueAlerts(later)).toEqual({ checked: 1, notified: 0 });
    // One newcomer: exactly one notification, naming one profile.
    setHits([{ userId: 'u-a' }, { userId: 'u-b' }, { userId: 'u-c' }]);
    expect(await service.runDueAlerts(later + 2 * 3_600_000)).toEqual({ checked: 1, notified: 1 });
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'me', type: 'match_suggestion', title: '1 new profile for “Fintech”' }));
    // The same newcomer is not announced twice.
    expect(await service.runDueAlerts(later + 4 * 3_600_000)).toEqual({ checked: 1, notified: 0 });
    // The list shows the badge until the owner runs the search.
    expect((await service.list('me')).searches[0].newResults).toBe(1);
    await service.run('me', search.id);
    expect((await service.list('me')).searches[0].newResults).toBeUndefined();
  });

  it('runs by hand, counts the use, and never returns the owner', async () => {
    const { service, rows } = setup([{ userId: 'me' }, { userId: 'u-a' }]);
    const { search } = await service.create('me', { name: 'All' });
    const result = await service.run('me', search.id);
    expect(result).toEqual({ results: [{ userId: 'u-a' }], count: 2 });
    expect(rows[0].useCount).toBe(1);
    expect(rows[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it('treats someone else’s search as missing, and turning alerts on starts the clock', async () => {
    const { service, rows } = setup([]);
    const { search } = await service.create('me', { name: 'Quiet' });
    await expect(service.update('other', search.id, { name: 'Mine now' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('other', search.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.run('other', search.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(rows[0].lastAlertAt).toBeNull();
    const { search: updated } = await service.update('me', search.id, { alertsEnabled: true, alertFrequency: 'weekly', name: 'Loud' });
    expect(updated).toMatchObject({ name: 'Loud', alertsEnabled: true, alertFrequency: 'weekly' });
    expect(rows[0].lastAlertAt).toBeInstanceOf(Date);
    expect(await service.remove('me', search.id)).toEqual({ ok: true });
    expect(rows).toHaveLength(0);
  });

  it('saves a need-card search, keeps only the board’s filters, and alerts on new cards from others', async () => {
    const card = (id: string, extra: Partial<Card> = {}): Card => ({ id, ownerId: 'elena', title: `Card ${id}`, kind: 'cofounder', status: 'open', place: 'Athens', stage: 'building', isRemote: true, expiresAt: null, ...extra });
    const cards = [card('c1'), card('c2', { kind: 'investor_intro' }), card('mine', { ownerId: 'me' })];
    const { service, notifications } = setup([], cards);
    const input = readSavedSearchInput({ scope: 'need_cards', name: 'Co-founder cards', filters: { kinds: ['cofounder', 'nonsense'], remote: ['true'], roles: ['founder'] } });
    expect(input).toMatchObject({ scope: 'need_cards', filters: { kinds: ['cofounder'], remote: ['true'] } });
    expect(input.filters).not.toHaveProperty('roles');

    const { search } = await service.create('me', { scope: 'need_cards', name: 'Co-founder cards', filters: { kinds: ['cofounder'] }, alertsEnabled: true, alertFrequency: 'instant' });
    expect(search).toMatchObject({ scope: 'need_cards', resultCount: 1 });
    // The owner's own card and other kinds are never results.
    expect((await service.run('me', search.id)).results).toEqual([expect.objectContaining({ id: 'c1' })]);
    // What the query asks the database for: open, not mine, not expired, and only board fields back.
    const { prisma } = (service as unknown as { prisma: { commitmentCard: { findMany: ReturnType<typeof vi.fn> } } });
    const args = prisma.commitmentCard.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ status: { in: ['open', 'in_discussion'] }, ownerId: { not: 'me' }, kind: { in: ['cofounder'] } });
    expect(args.where.AND[0]).toEqual({ OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] });
    expect(Object.keys(args.select).sort()).toEqual(['id', 'isRemote', 'kind', 'place', 'stage', 'title']);

    const later = Date.now() + 2 * 3_600_000;
    expect(await service.runDueAlerts(later)).toEqual({ checked: 1, notified: 0 });
    cards.push(card('c3'), card('c4', { status: 'closed' }), card('c5', { expiresAt: new Date('2026-01-01T00:00:00Z') }));
    expect(await service.runDueAlerts(later + 2 * 3_600_000)).toEqual({ checked: 1, notified: 1 });
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'me',
      title: '1 new need card for “Co-founder cards”',
      meta: { savedSearchId: search.id, cardIds: ['c3'] },
    }));
  });

  it('caps saved searches per person', async () => {
    const { service } = setup([]);
    for (let i = 0; i < 50; i++) await service.create('me', { name: `s${i}` });
    await expect(service.create('me', { name: 'one too many' })).rejects.toThrow(/up to 50/);
  });
});
