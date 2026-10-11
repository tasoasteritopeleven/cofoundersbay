/**
 * What the visitor allowed, in one place, for the banner that asks and for
 * the code that must obey the answer.
 *
 * Two categories, because that is all the product sets:
 * - essential: the session, CSRF and security cookies, plus the language and
 *   theme the visitor picks (kept in this browser so the page reads the way
 *   they chose). Always on; the service does not work without them.
 * - analytics: product analytics (PostHog, EU host) when a key is configured.
 *   Off until the visitor turns it on, and turned off again when they
 *   withdraw it.
 *
 * There are no marketing or advertising cookies. The banner used to offer a
 * "Marketing cookies - personalised advertisements" switch for something the
 * code never did; asking consent for a non-existent practice reads as if it
 * existed.
 */

export const COOKIE_CONSENT_KEY = 'cfb_cookie_consent';
export const COOKIE_PREFERENCES_KEY = 'cfb_cookie_preferences';
/** Fired on `window` with the new preferences as `detail`. */
export const COOKIE_CONSENT_EVENT = 'cookieConsentUpdated';
/** Asks the banner to open again on its choices, from a footer or Settings link. */
export const OPEN_COOKIE_CHOICES_EVENT = 'cfb:open-cookie-choices';

export type CookiePreferences = {
  essential: true;
  analytics: boolean;
};

export const ESSENTIAL_ONLY: CookiePreferences = { essential: true, analytics: false };

/** The stored answer, or null when the visitor has not answered yet. */
export function readCookiePreferences(): CookiePreferences | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.localStorage.getItem(COOKIE_CONSENT_KEY)) return null;
    const raw = window.localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!raw) return ESSENTIAL_ONLY;
    const parsed = JSON.parse(raw) as { analytics?: unknown } | null;
    return { essential: true, analytics: parsed?.analytics === true };
  } catch {
    return null;
  }
}

/** True only after an explicit yes to analytics. No answer is a no. */
export function analyticsAllowed(): boolean {
  return readCookiePreferences()?.analytics === true;
}

export function saveCookiePreferences(prefs: CookiePreferences): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    window.localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the choice still applies to this page view below.
  }
  window.dispatchEvent(new CustomEvent<CookiePreferences>(COOKIE_CONSENT_EVENT, { detail: prefs }));
}

/** Opens the banner on its choices, so a decision can be changed at any time. */
export function openCookieChoices(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_CHOICES_EVENT));
}
