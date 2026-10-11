/**
 * Where to go after signing in or signing up.
 *
 * A `redirect` parameter is accepted only as a path inside this app: a
 * leading `//` or `/\` is another host to the browser, and /login or
 * /register would loop. Sign-up goes through onboarding first, so the path
 * waits in sessionStorage and onboarding takes it once at the end - which is
 * how a public need card brings a new member back to that card's board.
 */
const KEY = 'cfb_return_to';

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (/^\/(login|register)(\/|\?|$)/.test(path)) return null;
  return path;
}

export function rememberReturnTo(value: string | null | undefined): void {
  const path = safeInternalPath(value);
  try {
    if (path) window.sessionStorage.setItem(KEY, path);
  } catch {
    // Storage blocked: onboarding ends on its usual page.
  }
}

export function takeReturnTo(fallback: string): string {
  try {
    const path = safeInternalPath(window.sessionStorage.getItem(KEY));
    window.sessionStorage.removeItem(KEY);
    return path ?? fallback;
  } catch {
    return fallback;
  }
}
