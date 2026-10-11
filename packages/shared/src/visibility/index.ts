/**
 * What a member chose to show, read the same way by every place that shows
 * them (`profile.visibilityRules`, LinkedIn's visibility settings on our
 * terms). Two switches hold everywhere they apply:
 *
 * - `search: 'hidden'` keeps the member out of other people's search, the
 *   directory, recommendations and the scout. People who already know them
 *   (connections, threads, cohorts) still reach them there.
 * - `profile: 'members'` keeps the profile page from readers who are not
 *   signed in (the public /p/ page and its link preview).
 *
 * Location and email have their own levels (`location`, `email`), applied by
 * the profile read. A missing or unknown value means the default: visible.
 * The type is `ProfileVisibilityRules` (types/index.ts).
 */

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** True when the member asked to stay out of search and recommendations. */
export function isHiddenFromSearch(rules: unknown): boolean {
  return rec(rules).search === 'hidden';
}

/** True when only signed-in members may read the profile. */
export function isMembersOnlyProfile(rules: unknown): boolean {
  return rec(rules).profile === 'members';
}
