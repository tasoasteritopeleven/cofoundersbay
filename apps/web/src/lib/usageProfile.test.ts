import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_USAGE,
  MAX_SHORTCUTS,
  canShortcut,
  clearUsageHistory,
  dayOf,
  dismissSuggestion,
  hidePage,
  movePin,
  pageKey,
  pageUse,
  parseUsage,
  pinPage,
  readUsage,
  recordVia,
  recordVisit,
  setUsageEnabled,
  unpinPage,
  usageSuggestions,
  yourPages,
  type UsageStore,
} from '@/lib/usage-profile';
import { executeAction, undoAction } from '@/lib/action-registry';
import { planCopilotTools } from '@/lib/copilot-planner';

const NOW = Date.parse('2026-10-28T12:00:00');
const DAY = 24 * 60 * 60_000;

/** A store with `visits` page → visits per day offset (0 = today). */
function storeWith(visits: Record<string, Record<number, number>>, extra: Partial<UsageStore> = {}): UsageStore {
  const out: UsageStore['visits'] = {};
  for (const [key, days] of Object.entries(visits)) {
    out[key] = Object.fromEntries(Object.entries(days).map(([ago, n]) => [dayOf(NOW - Number(ago) * DAY), n]));
  }
  return { ...EMPTY_USAGE, visits: out, ...extra };
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
});

describe('what counts as a page (docs §107)', () => {
  it('counts a page by its registry path, never whose page it was', () => {
    expect(pageKey('/matches')).toBe('/matches');
    expect(pageKey('/matches/?tier=strong#top')).toBe('/matches');
    expect(pageKey('/profiles/user-elena')).toBe('/profiles/[userId]');
    expect(pageKey('/no-such-page/at-all')).toBeNull();
  });

  it('offers only static pages that are not homes as shortcuts', () => {
    expect(canShortcut('/messages')).toBe(true);
    expect(canShortcut('/dashboard')).toBe(false);
    expect(canShortcut('/dashboard/founder')).toBe(false);
    expect(canShortcut('/')).toBe(false);
    expect(canShortcut('/profiles/[userId]')).toBe(false);
    expect(canShortcut('/onboarding')).toBe(false);
  });
});

describe('recording', () => {
  it('counts visits and the move that led to them, per account', () => {
    recordVisit('/matches', null, NOW);
    recordVisit('/messages', '/matches', NOW);
    recordVisit('/messages', '/messages', NOW);
    const store = readUsage();
    expect(store.visits['/matches']).toEqual({ [dayOf(NOW)]: 1 });
    expect(store.visits['/messages']).toEqual({ [dayOf(NOW)]: 2 });
    // A reload of the same page is not a move.
    expect(store.moves).toEqual({ '/matches>/messages': { [dayOf(NOW)]: 1 } });
    window.localStorage.setItem('user', JSON.stringify({ id: 'u-2' }));
    expect(readUsage().visits).toEqual({});
  });

  it('records nothing while counting is off, and keeps the pins', () => {
    pinPage('/messages');
    setUsageEnabled(false);
    recordVisit('/matches', null, NOW);
    recordVia('palette');
    expect(readUsage().visits).toEqual({});
    expect(readUsage().via).toEqual({});
    expect(readUsage().pins).toEqual(['/messages']);
  });

  it('forgets days past the 30-day window', () => {
    recordVisit('/matches', null, NOW - 40 * DAY);
    recordVisit('/messages', null, NOW);
    expect(Object.keys(readUsage().visits)).toEqual(['/messages']);
  });

  it('clearing forgets the counts and keeps the pins', () => {
    recordVisit('/matches', null, NOW);
    pinPage('/messages');
    clearUsageHistory();
    expect(readUsage().visits).toEqual({});
    expect(readUsage().pins).toEqual(['/messages']);
  });

  it('reads a damaged store as empty instead of throwing', () => {
    expect(parseUsage('{not json')).toEqual(EMPTY_USAGE);
    expect(parseUsage(JSON.stringify({ v: 1, visits: { '/m': { 'not-a-day': 3, '2026-10-28': -1 } }, pins: [1, '/messages'] })))
      .toMatchObject({ visits: {}, pins: ['/messages'] });
  });
});

describe('your pages', () => {
  it('puts pins first in their order, then pages opened three or more times this month', () => {
    const store = storeWith({ '/matches': { 0: 5 }, '/events': { 1: 3 }, '/jobs': { 2: 2 }, '/messages': { 0: 9 } }, { pins: ['/readiness'] });
    expect(yourPages(store, NOW).map((p) => [p.key, p.pinned])).toEqual([
      ['/readiness', true],
      ['/messages', false],
      ['/matches', false],
      ['/events', false],
    ]);
  });

  it('leaves out homes, hidden pages and anything past six', () => {
    const many = Object.fromEntries(['/matches', '/messages', '/events', '/jobs', '/groups', '/milestones', '/readiness', '/dashboard'].map((k, i) => [k, { 0: 10 - i }]));
    const pages = yourPages(storeWith(many, { hidden: ['/messages'] }), NOW);
    expect(pages).toHaveLength(MAX_SHORTCUTS);
    expect(pages.map((p) => p.key)).not.toContain('/messages');
    expect(pages.map((p) => p.key)).not.toContain('/dashboard');
  });

  it('weighs this week over last month', () => {
    const use = pageUse(storeWith({ '/matches': { 20: 6 }, '/messages': { 0: 3 } }), NOW);
    expect(use.map((p) => p.key)).toEqual(['/messages', '/matches']);
    expect(use[1]).toMatchObject({ week: 0, month: 6 });
  });
});

describe('pins', () => {
  it('reports the new shortcut position from the persisted order', () => {
    pinPage('/messages');
    pinPage('/jobs');
    expect(movePin('/jobs', -1)).toBe(1);
    expect(yourPages(readUsage(), NOW).map((page) => page.key)).toEqual(['/jobs', '/messages']);
  });
  it('pins, refuses a no-op, a home and a seventh, and unpins with its place', () => {
    expect(pinPage('/messages')).toEqual({ ok: true, index: 0 });
    expect(pinPage('/messages')).toEqual({ ok: false, reason: 'already' });
    expect(pinPage('/dashboard')).toEqual({ ok: false, reason: 'not_a_page' });
    for (const key of ['/matches', '/events', '/jobs', '/groups', '/readiness']) pinPage(key);
    expect(pinPage('/milestones')).toEqual({ ok: false, reason: 'full' });
    expect(unpinPage('/events')).toEqual({ ok: true, index: 2 });
    expect(unpinPage('/events')).toEqual({ ok: false, reason: 'not_pinned' });
    movePin('/jobs', -1);
    expect(readUsage().pins).toEqual(['/messages', '/jobs', '/matches', '/groups', '/readiness']);
  });

  it('hiding a pinned page unpins it, and pinning it again shows it', () => {
    pinPage('/messages');
    hidePage('/messages');
    expect(readUsage()).toMatchObject({ pins: [], hidden: ['/messages'] });
    pinPage('/messages');
    expect(readUsage()).toMatchObject({ pins: ['/messages'], hidden: [] });
  });
});

describe('suggestions', () => {
  it('suggests pinning a page opened four times this week, with the count', () => {
    const [pin] = usageSuggestions(storeWith({ '/messages': { 0: 3, 1: 2 } }), NOW, { keyboard: false });
    expect(pin).toMatchObject({ kind: 'pin', page: '/messages' });
    expect(pin.evidence.el).toBe('Την ανοίξατε 5 φορές αυτή την εβδομάδα.');
    // Pinned already, or dismissed: quiet.
    expect(usageSuggestions(storeWith({ '/messages': { 0: 5 } }, { pins: ['/messages'] }), NOW, { keyboard: false })).toEqual([]);
    expect(usageSuggestions(storeWith({ '/messages': { 0: 5 } }, { dismissed: { 'pin:/messages': NOW } }), NOW, { keyboard: false })).toEqual([]);
  });

  it('names a key only to a keyboard reader who has not used the keys', () => {
    const store = storeWith({ '/messages': { 0: 3 } });
    expect(usageSuggestions(store, NOW, { keyboard: true }).map((s) => s.id)).toEqual(['chord:/messages']);
    expect(usageSuggestions(store, NOW, { keyboard: false })).toEqual([]);
    expect(usageSuggestions({ ...store, via: { chord: 2 } }, NOW, { keyboard: true })).toEqual([]);
  });

  it('offers the palette after twenty visits through the menus', () => {
    const store = storeWith({ '/matches': { 3: 2 }, '/events': { 10: 9 }, '/jobs': { 12: 9 } });
    expect(usageSuggestions(store, NOW, { keyboard: true }).map((s) => s.id)).toContain('palette');
    expect(usageSuggestions({ ...store, via: { palette: 1 } }, NOW, { keyboard: true }).map((s) => s.id)).not.toContain('palette');
  });

  it('names the shorter way for a repeated move, and the assistant for forms filled by hand', () => {
    const store: UsageStore = {
      ...storeWith({ '/milestones/new': { 2: 2 } }),
      moves: { '/matches>/messages': { [dayOf(NOW - DAY)]: 3 } },
    };
    const ids = usageSuggestions(store, NOW, { keyboard: false }).map((s) => s.id);
    expect(ids).toEqual(['wf-match-message', 'assistant-drafts']);
    expect(usageSuggestions({ ...store, via: { assistant: 1 } }, NOW, { keyboard: false }).map((s) => s.id)).toEqual(['wf-match-message']);
  });

  it('keeps a dismissed suggestion quiet', () => {
    window.localStorage.setItem('cfb:usage:u-1', JSON.stringify(storeWith({ '/messages': { 0: 5 } })));
    dismissSuggestion('pin:/messages', NOW);
    expect(usageSuggestions(readUsage(), NOW, { keyboard: false })).toEqual([]);
  });
});

describe('the assistant pins and unpins, and takes it back', () => {
  it('pins a page and undoes exactly that pin', async () => {
    const done = await executeAction('pin_shortcut', { href: '/messages?x=1' });
    expect(done).toEqual({ ok: true, undo: { key: '/messages', index: 0 } });
    expect(readUsage().pins).toEqual(['/messages']);
    expect(await undoAction('pin_shortcut', { href: '/messages' }, done.undo)).toEqual({ ok: true });
    expect(readUsage().pins).toEqual([]);
  });

  it('refuses a page that is already pinned, a home, and an outside link', async () => {
    pinPage('/messages');
    expect((await executeAction('pin_shortcut', { href: '/messages' })).ok).toBe(false);
    expect((await executeAction('pin_shortcut', { href: '/dashboard' })).ok).toBe(false);
    expect((await executeAction('pin_shortcut', { href: 'https://example.com/messages' })).ok).toBe(false);
  });

  it('unpins and puts the page back in its place', async () => {
    pinPage('/matches');
    pinPage('/messages');
    pinPage('/events');
    const done = await executeAction('unpin_shortcut', { href: '/messages' });
    expect(done).toEqual({ ok: true, undo: { key: '/messages', index: 1 } });
    await undoAction('unpin_shortcut', { href: '/messages' }, done.undo);
    expect(readUsage().pins).toEqual(['/matches', '/messages', '/events']);
  });

  it('plans the read and the pins from the reader’s words', () => {
    const names = (text: string) => planCopilotTools(text).map((t) => t.name);
    expect(names('How can I work faster here?')).toContain('get_usage_insights');
    expect(names('Πώς μπορώ να δουλεύω πιο γρήγορα εδώ;')).toContain('get_usage_insights');
    expect(planCopilotTools('Pin messages').find((t) => t.name === 'pin_shortcut')?.args).toMatchObject({ href: '/messages' });
    expect(planCopilotTools('Καρφίτσωσε τα μηνύματα').find((t) => t.name === 'pin_shortcut')?.args).toMatchObject({ href: '/messages' });
    expect(names('Ξεκαρφίτσωσε τα μηνύματα')).toContain('unpin_shortcut');
    expect(names('Ξεκαρφίτσωσε τα μηνύματα')).not.toContain('pin_shortcut');
    // A home is never one of the reader's pages, so it is not proposed.
    expect(names('Pin the dashboard')).not.toContain('pin_shortcut');
  });
});
