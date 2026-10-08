/**
 * The demo member's visibility switches (Settings → Privacy), kept in
 * sessionStorage so turning "Appear in search" or "Public profile" off in the
 * demo survives navigation. The rules are the API's (shared/visibility).
 */

import type { ProfileVisibilityRules } from '@cofounderbay/shared';

const STORAGE_KEY = 'cfb:demo-visibility:v1';

export function readDemoVisibility(): ProfileVisibilityRules | null {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as ProfileVisibilityRules) : null;
  } catch {
    return null;
  }
}

export function writeDemoVisibility(rules: unknown): ProfileVisibilityRules | null {
  if (!rules || typeof rules !== 'object') return readDemoVisibility();
  const next = { ...(readDemoVisibility() ?? {}), ...(rules as ProfileVisibilityRules) };
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the change holds for this page view only.
  }
  return next;
}
