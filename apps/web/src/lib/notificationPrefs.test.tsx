import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NOTIFICATION_CATEGORIES,
  categoryChannelOn,
  channelsOf,
  resetNotificationPrefsForTests,
  setChannel,
  updateNotificationPrefs,
  useNotificationPrefs,
} from './notification-prefs';

/**
 * One store behind both notification screens.
 *
 * /settings showed six switches of its own (kept under `notifPrefs`, read by
 * nothing) while /settings/notifications kept per-type switches in component
 * state that reset on every visit. What is asserted: a change made through
 * one view is what the other reads; choices survive a reload; the old
 * automation key is folded in; and a category reads "on" only when all of
 * its types are.
 */

const messages = NOTIFICATION_CATEGORIES.find((c) => c.id === 'messages')!;

function QuickView() {
  const prefs = useNotificationPrefs();
  return <p data-testid="quick">{categoryChannelOn(prefs, messages, 'inApp') ? 'on' : 'off'}</p>;
}

function DetailView() {
  const prefs = useNotificationPrefs();
  return <p data-testid="detail">{messages.settings.map((s) => (channelsOf(prefs, s).inApp ? '1' : '0')).join('')}</p>;
}

beforeEach(() => {
  localStorage.clear();
  resetNotificationPrefsForTests();
});
afterEach(cleanup);

describe('notification preferences', () => {
  it('shows a change made in one view in the other', () => {
    const view = render(<><QuickView /><DetailView /></>);
    expect(view.getByTestId('quick').textContent).toBe('on');
    act(() => setChannel([messages.settings[0].id], 'inApp', false));
    expect(view.getByTestId('detail').textContent).toBe('01');
    // One type off is enough for the category to read off.
    expect(view.getByTestId('quick').textContent).toBe('off');
    act(() => setChannel(messages.settings.map((s) => s.id), 'inApp', true));
    expect(view.getByTestId('quick').textContent).toBe('on');
  });

  it('keeps the choice across a reload', () => {
    setChannel(['new_message'], 'email', false);
    updateNotificationPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, enabled: true } }));
    resetNotificationPrefsForTests();
    const view = render(<DetailView />);
    expect(view.getByTestId('detail').textContent).toBe('11');
    const stored = JSON.parse(localStorage.getItem('cfb_notification_prefs') ?? '{}');
    expect(stored.channels.new_message.email).toBe(false);
    expect(stored.quietHours.enabled).toBe(true);
  });

  it('folds in the automation switches kept under the old key', () => {
    localStorage.setItem('cfb_automation_notif_prefs', JSON.stringify({ automation_billing: false }));
    let seen: boolean | undefined;
    function Probe() {
      seen = useNotificationPrefs().automation.automation_billing;
      return null;
    }
    render(<Probe />);
    expect(seen).toBe(false);
  });
});
