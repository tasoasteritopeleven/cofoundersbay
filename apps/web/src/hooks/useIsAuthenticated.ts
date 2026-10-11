'use client';

import { useHasSession } from './useSession';

/**
 * Check active session via the cfb_session cookie (non-httpOnly, set by backend on login).
 * cfb_session has a 7-day TTL matching the refresh token.
 * The app uses httpOnly cookie auth — localStorage tokens are legacy and must not be used.
 */
export function hasActiveSession(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('cfb_session=');
}

/**
 * Returns whether the user has an active session.
 * Uses the cfb_session cookie (set by backend on login) — NOT localStorage tokens.
 * Reacts to cfb:login / cfb:logout events dispatched by api.ts for same-tab updates.
 */
export function useIsAuthenticated(): boolean {
  return useHasSession();
}
