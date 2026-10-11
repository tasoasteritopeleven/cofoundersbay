import { test, expect, type Page } from '@playwright/test';

/**
 * No page is wider than the phone showing it.
 *
 * Round 13 found eleven product pages rendering 5-150px wider than a 390px
 * screen - a calendar grid, a kanban funnel, a table, rows whose buttons could
 * not wrap. The earlier sweep missed them: under mobile emulation
 * `window.innerWidth` grows to fit the overflowing page, so comparing
 * `scrollWidth` with it always read zero. This compares against the device's
 * own width instead.
 *
 * Mobile project only; the routes are the ones that overflowed, plus the
 * busiest list pages.
 */

const ROUTES = [
  '/calendar',
  '/endorsements',
  '/investors',
  '/investor/pipeline',
  '/admin/feature-flags',
  '/mentor/profile',
  '/org/analytics',
  '/profile/edit',
  '/recommendations',
  '/referrals',
  '/groups/g_1',
  '/admin/user-management',
  '/admin/content-moderation',
  '/mentor/earnings',
  '/provider/inquiries',
  '/data-room/dr_1',
  // The ladder's five rungs and the terms grid are the widest rows here.
  '/commitments',
  '/commitments/new',
  '/commitments/need-harbor',
];

async function signIn(page: Page) {
  await page.context().addCookies([
    { name: 'cfb_session', value: 'e2e', domain: 'localhost', path: '/' },
    { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' },
  ]);
  await page.context().addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'admin@cofounderbay.test', role: 'admin' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
  });
}

test.describe('phone layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone widths only');

  for (const route of ROUTES) {
    test(`${route} fits the screen`, async ({ page }) => {
      await signIn(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.locator('main').first().waitFor();
      await page.waitForTimeout(1500);
      const screen = page.viewportSize()?.width ?? 0;
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${route} is ${width}px on a ${screen}px screen`).toBeLessThanOrEqual(screen + 1);
    });
  }
});
