import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = {
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
};
vi.mock('posthog-js', () => ({ default: posthog }));

/**
 * Analytics obeys the cookie banner. Before the gate, "Essential only"
 * changed nothing: PostHog loaded on the first event whenever a key was set.
 */
describe('analytics consent gate', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    posthog.init.mockClear();
    posthog.capture.mockClear();
    posthog.opt_out_capturing.mockClear();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sends nothing before the visitor answers', async () => {
    const { analytics } = await import('./analytics');
    await analytics.track('page_viewed', { path: '/' });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('sends nothing after "Essential only"', async () => {
    const { saveCookiePreferences, ESSENTIAL_ONLY } = await import('./cookie-consent');
    saveCookiePreferences(ESSENTIAL_ONLY);
    const { analytics } = await import('./analytics');
    await analytics.track('page_viewed', { path: '/' });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('sends after an explicit yes, and stops when the yes is withdrawn', async () => {
    const { saveCookiePreferences } = await import('./cookie-consent');
    saveCookiePreferences({ essential: true, analytics: true });
    const { analytics } = await import('./analytics');
    await analytics.track('page_viewed', { path: '/' });
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith('page_viewed', { path: '/' });

    saveCookiePreferences({ essential: true, analytics: false });
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    posthog.capture.mockClear();
    await analytics.track('page_viewed', { path: '/after' });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('reads a stored answer without marketing or preference categories', async () => {
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('cfb_cookie_preferences', JSON.stringify({ essential: true, analytics: false, marketing: true, preferences: true }));
    const { readCookiePreferences } = await import('./cookie-consent');
    expect(readCookiePreferences()).toEqual({ essential: true, analytics: false });
  });
});
