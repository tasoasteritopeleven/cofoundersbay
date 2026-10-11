export const PREVIEW_DEMO_USER = {
  id: 'preview-demo-user',
  email: 'demo@cofounderbay.com',
  role: 'founder',
  displayName: 'Alex Demo',
  firstName: 'Alex',
  lastName: 'Demo',
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function setCookie(name: string, value: string) {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; path=/; SameSite=Lax; max-age=${COOKIE_MAX_AGE}${secure}`;
}

export function isPreviewDemo(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return (
      document.cookie.includes('cfb_preview_demo=1') ||
      document.cookie.includes('cfb_session=preview-demo') ||
      window.localStorage.getItem('cfb_demo_data') === '1' ||
      window.location.hostname.endsWith('.trycloudflare.com')
    );
  } catch {
    return false;
  }
}

export function applyPreviewDemoSession(
  user: typeof PREVIEW_DEMO_USER = PREVIEW_DEMO_USER,
) {
  if (typeof document === 'undefined') return;

  setCookie('cfb_session', 'preview-demo');
  // Founder by default; a role already chosen for the demo (the cookie the
  // middleware routes /dashboard by, and RoleContext's preview state reads)
  // is kept. Overwriting it on every mount pinned the demo to one role.
  if (!/(?:^|;\s*)cfb_primary_role=[a-z_]+/.test(document.cookie)) {
    setCookie('cfb_primary_role', 'existing_founder');
  }
  setCookie('cfb_preview_demo', '1');

  const serializedUser = JSON.stringify(user);
  let alreadySignedIn = false;
  try {
    alreadySignedIn =
      localStorage.getItem('accessToken') === 'preview-demo' &&
      localStorage.getItem('cfb_demo_data') === '1' &&
      localStorage.getItem('user') === serializedUser;

    localStorage.setItem('user', serializedUser);
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('accessToken', 'preview-demo');
  } catch {
    // ignore quota / private mode
  }

  // Announce only an actual change. These two events wake every session
  // subscriber at once — useSession's external store (so every
  // useSyncExternalStore consumer re-renders), MessagingContext,
  // NotificationsBell, and the React Query observers gated on auth. Re-emitting
  // them for a session that is already applied is a self-inflicted render storm.
  //
  // It matters because several callers all fire on first mount:
  // PreviewSessionGuard, useSession's restore path, and the /demo fallback —
  // and in development React StrictMode invokes each of those mount effects
  // twice. That is the "first page load of a fresh demo session hangs, but a
  // reload is fine" symptom: mounting is the only window where they pile up.
  if (!alreadySignedIn) {
    window.dispatchEvent(new CustomEvent('cfb:login'));
    window.dispatchEvent(new CustomEvent('cfb:user'));
  }
}

/** Re-apply demo cookies if sample-data mode is on but the session cookie was cleared. */
export function restorePreviewDemoSessionIfNeeded() {
  if (typeof document === 'undefined') return false;
  try {
    const wantsDemo =
      window.localStorage.getItem('cfb_demo_data') === '1' ||
      document.cookie.includes('cfb_preview_demo=1') ||
      (typeof window !== 'undefined' && window.location.hostname.endsWith('.trycloudflare.com'));
    if (!wantsDemo) return false;
    const hasUser = Boolean(window.localStorage.getItem('user'));
    const hasCookie = document.cookie.includes('cfb_session=preview-demo');
    if (!hasCookie || !hasUser) {
      applyPreviewDemoSession();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function clearPreviewDemoSession() {
  if (typeof document === 'undefined') return;
  document.cookie = 'cfb_session=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = 'cfb_preview_demo=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = 'cfb_primary_role=; Max-Age=0; path=/; SameSite=Lax';
  try {
    localStorage.removeItem('cfb_demo_data');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {
    // ignore quota / private mode
  }
}
