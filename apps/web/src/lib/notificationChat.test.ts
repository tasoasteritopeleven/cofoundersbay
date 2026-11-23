import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  notifications: [] as Array<{ id: string; type: string; title: string; body: string | null; link: string | null; meta: unknown; createdAt: string; readAt: string | null }>,
  digest: 'never' as string,
}));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    listNotifications: vi.fn(async (params?: { unread?: boolean }) => ({
      notifications: store.notifications.filter((n) => !params?.unread || !n.readAt),
      nextCursor: null,
    })),
    markNotificationsRead: vi.fn(async (ids: string[]) => {
      const marked: string[] = [];
      for (const n of store.notifications) if (ids.includes(n.id) && !n.readAt) { n.readAt = '2026-10-28T12:00:00Z'; marked.push(n.id); }
      return { ok: true as const, ids: marked };
    }),
    markNotificationsUnread: vi.fn(async (ids: string[]) => {
      for (const n of store.notifications) if (ids.includes(n.id)) n.readAt = null;
      return { ok: true as const, count: ids.length };
    }),
    getNotificationPreferences: vi.fn(async () => ({ digestFrequency: store.digest })),
    updateNotificationPreferences: vi.fn(async (data: { digestFrequency?: string }) => {
      if (data.digestFrequency) store.digest = data.digestFrequency;
      return { ok: true as const };
    }),
  };
});

import { executeAction, undoAction } from '@/lib/action-registry';
import { planCopilotTools } from '@/lib/copilot-planner';
import { runCopilotTurn } from '@/lib/copilot-engine';
import { NOTIFICATION_CATEGORIES, channelsOf, readNotificationPrefs, resetNotificationPrefsForTests } from '@/lib/notification-prefs';
import { detectNotificationPref, notificationNextAction, triageSplit, triageTarget, waitsOnReader, wantsTriage } from '@/lib/notification-chat';

it('only exposes a next action for an actionable notification with a valid destination', () => {
  expect(notificationNextAction({ type: 'message', link: '/messages?conversation=1' })).toMatchObject({ en: 'Open conversation', href: '/messages?conversation=1' });
  expect(notificationNextAction({ type: 'match_suggestion', link: '/matches' })).toBeNull();
  expect(notificationNextAction({ type: 'connection_request', link: '//outside.test' })).toBeNull();
});

const row = (id: string, type: string, readAt: string | null = null) => ({ id, type, title: id, body: null, link: null, meta: null, createdAt: '2026-10-28T09:00:00Z', readAt });

it('offers review only for intro requests, including when a legacy outcome shares their link', () => {
  const request = { type: 'intro_request', link: '/intros?tab=forward&intro=1' };
  expect(notificationNextAction(request)?.en).toBe('Review request');
  expect(notificationNextAction({ ...request, meta: { requiresResponse: false } })).toBeNull();
  expect(notificationNextAction({ ...request, title: 'Your introduction was accepted' })).toBeNull();
  expect(notificationNextAction({ ...request, meta: { requiresResponse: true } })?.en).toBe('Review request');
});
const events = NOTIFICATION_CATEGORIES.find((c) => c.id === 'events')!;

beforeEach(() => {
  store.notifications = [row('n1', 'match_suggestion'), row('n2', 'connection_request'), row('n3', 'founder_update'), row('n4', 'message'), row('n5', 'event_rsvp', '2026-10-27T09:00:00Z')];
  store.digest = 'never';
  window.localStorage.clear();
  window.localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
  resetNotificationPrefsForTests();
});

describe('notification triage (docs §107.7-2, §111)', () => {
  it('keeps what waits on the reader: requests, invitations, messages, security', () => {
    expect(waitsOnReader({ type: 'connection_request' })).toBe(true);
    expect(waitsOnReader({ type: 'organization_invite' })).toBe(true);
    expect(waitsOnReader({ type: 'message' })).toBe(true);
    expect(waitsOnReader({ type: 'suspicious_activity' })).toBe(true);
    expect(waitsOnReader({ type: 'founder_update' })).toBe(false);
    expect(waitsOnReader({ type: 'match_suggestion' })).toBe(false);
    const split = triageSplit(store.notifications);
    expect(split.clear.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(split.keep.map((n) => n.id)).toEqual(['n2', 'n4']);
    expect(triageTarget({ clear: 2, keep: 2 }, 'el')).toBe('2 ως αναγνωσμένες · μένουν 2 που σας περιμένουν');
    expect(triageTarget({ clear: 1, keep: 0 }, 'en')).toBe('1 marked read');
  });

  it('is asked for in either language', () => {
    expect(wantsTriage('Σήμανε τις υπόλοιπες ειδοποιήσεις ως αναγνωσμένες')).toBe(true);
    expect(wantsTriage('Clear my notifications')).toBe(true);
    expect(wantsTriage('Show my notifications')).toBe(false);
    expect(planCopilotTools('Καθάρισε τις ειδοποιήσεις').map((t) => t.name)).toContain('triage_notifications');
    // The card stands in for the read: no list of what it is about to change.
    expect(planCopilotTools('Καθάρισε τις ειδοποιήσεις').map((t) => t.name)).not.toContain('get_notifications');
  });

  it('marks read only what needs nothing, and the undo takes back exactly those', async () => {
    const done = await executeAction('triage_notifications', {});
    expect(done).toEqual({ ok: true, href: '/notifications', undo: { ids: ['n1', 'n3'] } });
    expect(store.notifications.filter((n) => !n.readAt).map((n) => n.id)).toEqual(['n2', 'n4']);
    expect(await executeAction('triage_notifications', {})).toEqual({ ok: false, error: 'Every unread notification waits on you.' });
    expect(await undoAction('triage_notifications', {}, done.undo)).toEqual({ ok: true, href: '/notifications' });
    expect(store.notifications.filter((n) => !n.readAt).map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
  });

  it('shows a card with the numbers, or says there is nothing to mark', async () => {
    const turn = await runCopilotTurn('Σήμανε τις υπόλοιπες ειδοποιήσεις ως αναγνωσμένες', undefined, { tools: [{ name: 'triage_notifications', args: {} }] });
    const card = turn.actions.find((a) => a.tool === 'triage_notifications');
    expect(card?.title).toMatch(/2 ως αναγνωσμένες · μένουν 2 που σας περιμένουν$/);
    store.notifications = [row('n2', 'connection_request')];
    const none = await runCopilotTurn('Σήμανε τις υπόλοιπες ειδοποιήσεις ως αναγνωσμένες', undefined, { tools: [{ name: 'triage_notifications', args: {} }] });
    expect(none.actions.find((a) => a.tool === 'triage_notifications')).toBeUndefined();
    expect(none.message).toMatch(/κάθε αδιάβαστη ειδοποίηση σας περιμένει/);
  });
});

describe('notification settings from the conversation (docs §110.5, §111)', () => {
  it('reads a channel, a category and a verb, or the digest and a frequency', () => {
    expect(detectNotificationPref('Σταμάτα τα email για εκδηλώσεις')).toEqual({ category: 'events', channel: 'email', on: 'false' });
    expect(detectNotificationPref('Turn off push for messages')).toEqual({ category: 'messages', channel: 'push', on: 'false' });
    expect(detectNotificationPref('Send me the digest weekly')).toEqual({ digest: 'weekly' });
    expect(detectNotificationPref('Στείλε μου εβδομαδιαία σύνοψη')).toEqual({ digest: 'weekly' });
    // An email about something else changes nothing.
    expect(detectNotificationPref('Draft an email to Elena about the event')).toBeUndefined();
    expect(detectNotificationPref('Απάντα χωρίς emoji')).toBeUndefined();
    expect(planCopilotTools('Σταμάτα τα email για εκδηλώσεις').find((t) => t.name === 'set_notification_pref')?.args).toEqual({ category: 'events', channel: 'email', on: 'false' });
  });

  it('turns a channel off for a whole category, refuses a no-op, and the undo restores each setting', async () => {
    const before = events.settings.map((s) => channelsOf(readNotificationPrefs(), s).email);
    const done = await executeAction('set_notification_pref', { category: 'events', channel: 'email', on: 'false' });
    expect(done.ok).toBe(true);
    expect(events.settings.every((s) => channelsOf(readNotificationPrefs(), s).email === false)).toBe(true);
    expect((await executeAction('set_notification_pref', { category: 'events', channel: 'email', on: false })).ok).toBe(false);
    expect((await executeAction('set_notification_pref', { category: 'weather', channel: 'email', on: false })).ok).toBe(false);
    expect((await undoAction('set_notification_pref', {}, done.undo)).ok).toBe(true);
    expect(events.settings.map((s) => channelsOf(readNotificationPrefs(), s).email)).toEqual(before);
  });

  it('sets the digest on the account and puts the old one back', async () => {
    const done = await executeAction('set_notification_pref', { digest: 'weekly' });
    expect(done).toEqual({ ok: true, href: '/settings/notifications', undo: { digest: 'never' } });
    expect(store.digest).toBe('weekly');
    expect((await executeAction('set_notification_pref', { digest: 'weekly' })).ok).toBe(false);
    await undoAction('set_notification_pref', {}, done.undo);
    expect(store.digest).toBe('never');
  });

  it('names what the card changes', async () => {
    const turn = await runCopilotTurn('Σταμάτα τα email για εκδηλώσεις', undefined, { tools: [{ name: 'set_notification_pref', args: { category: 'events', channel: 'email', on: 'false' } }] });
    const card = turn.actions.find((a) => a.tool === 'set_notification_pref');
    expect(card?.title).toMatch(/Εκδηλώσεις & συναντήσεις: email όχι$/);
  });
});
