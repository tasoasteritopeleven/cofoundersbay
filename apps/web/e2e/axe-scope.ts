/**
 * What every axe scan in this suite leaves out, and why.
 *
 * `[data-logotype]` is the CoFounderBay wordmark. WCAG 1.4.3 exempts text that
 * is part of a logo or brand name from the contrast minimum, and the "Bay"
 * half wears the brand accent on purpose. Excluding the element - not the
 * colour-contrast rule - keeps every other piece of text on the page under the
 * 4.5:1 check. The marker is a plain data attribute, which production keeps
 * (`reactRemoveProperties` strips only `data-test*`).
 */
export const LOGOTYPE = '[data-logotype]';
