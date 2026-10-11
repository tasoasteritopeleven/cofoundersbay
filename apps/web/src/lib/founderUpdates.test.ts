import { beforeEach, describe, expect, it, vi } from 'vitest';
import { followPerson, getMyUpdates, getUpdatesFeed, unfollowPerson, type FounderUpdate } from '@/lib/updates-api';
import { previewUpdatesApi, resetDemoUpdates } from '@/lib/demo/updates-world';
import { executeAction, isUndoable, undoAction } from './action-registry';
import { AREA_READERS } from './copilot-reads';
import { planCopilotTools } from './copilot-planner';
import { takeFormDraft } from './form-draft';
import { translate } from './i18n/translate';

/**
 * Founder updates and following, from the demo world to the assistant.
 *
 * The demo applies the API's rules (`readFounderUpdate`, the author-only
 * token, followers-only retiring the link); the assistant reads the feed,
 * proposes a follow with the unfollow as its undo, and drafts an update into
 * the composer without sending it.
 */

vi.mock('@/lib/updates-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/updates-api')>()),
  getUpdatesFeed: vi.fn(),
  getMyUpdates: vi.fn(),
  followPerson: vi.fn(),
  unfollowPerson: vi.fn(),
}));

const NOW = Date.parse('2026-10-07T09:00:00Z');

beforeEach(() => {
  resetDemoUpdates();
  vi.mocked(getUpdatesFeed).mockReset();
  vi.mocked(getMyUpdates).mockReset();
  vi.mocked(followPerson).mockReset();
  vi.mocked(unfollowPerson).mockReset();
});

const api = (path: string, method = 'GET', body: Record<string, unknown> = {}) => previewUpdatesApi(path, method, body, NOW) as Record<string, any>;

describe('the demo world', () => {
  it('shows the people Alex follows, newest first, and only Alex the token of Alex’s own public update', () => {
    const feed = api('/api/updates/feed').updates as FounderUpdate[];
    expect(feed.map((u) => u.author.displayName)).toEqual(['Elena Papadopoulos', 'Sofia Alexiou', 'Elena Papadopoulos']);
    expect(feed.every((u) => u.publicToken === null)).toBe(true);
    const [mine] = api('/api/updates/mine').updates as FounderUpdate[];
    expect(mine).toMatchObject({ mine: true, visibility: 'public', publicToken: 'demo-alex-sept' });
  });

  it('serves a public update without ids, and stops when it goes back to followers', () => {
    const pub = api('/api/updates/public/demo-alex-sept');
    expect(pub.update.author).toEqual({ displayName: 'Alex Demo', headline: 'Founder · Athens founder networks', avatarUrl: null });
    expect(JSON.stringify(pub)).not.toMatch(/"id"|preview-demo-user|upd-me/);
    api('/api/updates/upd-me-1/visibility', 'PATCH', { visibility: 'followers' });
    expect(() => api('/api/updates/public/demo-alex-sept')).toThrow(/not public/);
  });

  it('refuses a promised return with the API’s bilingual reason', () => {
    let caught: unknown;
    try {
      api('/api/updates', 'POST', { title: 'Raise', body: 'Guaranteed 3x return for early investors' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ status: 400, details: { reason: 'update_invalid', problems: expect.arrayContaining(['promise']) } });
    expect((caught as { details: { messageEl: string } }).details.messageEl).toMatch(/[Α-Ωα-ω]/);
  });

  it('follows and unfollows, never oneself, and counts followers', () => {
    expect(api('/api/follows/user-marcus', 'POST')).toEqual({ following: true, followers: 1 });
    expect(api('/api/follows').people.map((p: { displayName: string }) => p.displayName)).toContain('Marcus Chen');
    expect(api('/api/follows/user-marcus', 'DELETE')).toEqual({ following: false, followers: 0 });
    expect(() => api('/api/follows/preview-demo-user', 'POST')).toThrow(/yourself/);
    expect(api('/api/follows/preview-demo-user').followers).toBe(3);
  });

  it('lets only the author change an update', () => {
    expect(() => api('/api/updates/upd-elena-1/visibility', 'PATCH', { visibility: 'public' })).toThrow(/Only the author/);
    expect(() => api('/api/updates/upd-elena-1', 'DELETE')).toThrow(/Only the author/);
  });
});

describe('the assistant', () => {
  const t = (locale: 'en' | 'el') => (s: string, v?: Record<string, string | number>) => translate(locale, s, v);

  it('reads the feed and the reader’s own updates, in Greek for a Greek reader', async () => {
    const feed = api('/api/updates/feed').updates;
    const mine = api('/api/updates/mine').updates;
    vi.mocked(getUpdatesFeed).mockResolvedValue(feed);
    vi.mocked(getMyUpdates).mockResolvedValue(mine);
    const reply = await AREA_READERS.get_founder_updates({}, { t: t('el'), locale: 'el' });
    expect(reply.section).toContain('Harbor: four clinics live');
    expect(reply.section).toContain('Από όσους ακολουθείτε:');
    expect(reply.section).toContain('δημόσια');
    expect(reply.citations[0]).toMatchObject({ type: 'update', href: '/updates?update=upd-elena-1' });
  });

  it('answers an empty feed with where to start, not an error', async () => {
    vi.mocked(getUpdatesFeed).mockResolvedValue([]);
    vi.mocked(getMyUpdates).mockResolvedValue([]);
    const reply = await AREA_READERS.get_founder_updates({}, { t: t('en'), locale: 'en' });
    expect(reply.section).toMatch(/Nobody you follow/);
    expect(reply.actions[0]).toMatchObject({ href: '/updates' });
  });

  it('plans a people search before the follow, so the card names a real person', () => {
    const names = planCopilotTools('Follow Elena Papadopoulos').map((tool) => tool.name);
    expect(names.indexOf('search_people')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('search_people')).toBeLessThan(names.indexOf('follow_person'));
    expect(planCopilotTools('Remind me to follow up with Elena').some((tool) => tool.name === 'follow_person')).toBe(false);
  });

  it('follows with the unfollow as its undo, declared partial because the notice already went', async () => {
    vi.mocked(followPerson).mockResolvedValue({ following: true, followers: 1 });
    vi.mocked(unfollowPerson).mockResolvedValue({ following: false, followers: 0 });
    expect(isUndoable('follow_person')).toBe(true);
    expect(await executeAction('follow_person', { userId: 'user-elena' })).toMatchObject({ ok: true, href: '/updates' });
    expect(followPerson).toHaveBeenCalledWith('user-elena');
    expect(await undoAction('follow_person', { userId: 'user-elena' })).toMatchObject({ ok: true });
    expect(unfollowPerson).toHaveBeenCalledWith('user-elena');
  });

  it('drafts an update into the composer and sends nothing', async () => {
    const outcome = await executeAction('draft_founder_update', { title: 'September', body: 'Twelve interviews.', visibility: 'public', publicToken: 'x' });
    expect(outcome).toMatchObject({ ok: true, href: '/updates' });
    expect(takeFormDraft('founder_update')).toEqual({ title: 'September', body: 'Twelve interviews.', visibility: 'public' });
  });
});
