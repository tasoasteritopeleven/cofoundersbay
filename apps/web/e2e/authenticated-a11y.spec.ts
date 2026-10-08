import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LOGOTYPE } from './axe-scope';

/**
 * Accessibility coverage for the authenticated half of the app.
 *
 * These routes sit behind the auth middleware and behind AdminGuard, and they
 * call the API on mount — so they cannot be rendered at all without a session
 * and something answering /api. The Playwright project supplies both: a session
 * cookie, seeded localStorage, and the stub in e2e/mock-api.mjs.
 *
 * Rendering them against the stub is not only an accessibility check. The first
 * run of this fixture is what surfaced the useAIChat crash that blanked every
 * authenticated page when the agents payload was malformed.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Waits until the DOM stops changing.
 *
 * A fixed timeout is not enough here: the floating chat button, the toast
 * region, the cookie banner and several query-driven lists mount at variable
 * times, so a scan on a flat delay intermittently caught a control before its
 * label had been painted and reported it as unnamed. This waits for a quiet
 * window instead, which made the suite deterministic.
 */
async function waitForStableDom(page: Page, quietMs = 700, timeoutMs = 15_000) {
  await page.evaluate(
    ([quiet, limit]) =>
      new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, quiet);
        });
        const done = () => {
          observer.disconnect();
          resolve();
        };
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        timer = setTimeout(done, quiet);
        setTimeout(done, limit);
      }),
    [quietMs, timeoutMs] as const,
  );
}


/** One representative route per section, plus every role dashboard. */
const ROUTES = [
  { path: '/dashboard/founder', name: 'founder dashboard' },
  { path: '/dashboard/mentor', name: 'mentor dashboard' },
  { path: '/dashboard/investor', name: 'investor dashboard' },
  { path: '/dashboard/incubator', name: 'incubator dashboard' },
  { path: '/dashboard/provider', name: 'provider dashboard' },
  { path: '/discover', name: 'discover' },
  { path: '/matches', name: 'matches' },
  { path: '/messages', name: 'messages' },
  { path: '/settings', name: 'settings' },
  { path: '/settings/notifications', name: 'notification settings' },
  { path: '/notifications', name: 'notifications' },
  { path: '/achievements', name: 'achievements' },
  { path: '/feed', name: 'feed' },
  { path: '/milestones', name: 'milestones' },
  { path: '/admin', name: 'admin overview' },
  { path: '/admin/tenants', name: 'admin tenants' },
  { path: '/tenant/dashboard', name: 'tenant dashboard' },
  { path: '/mentor/sessions', name: 'mentor sessions' },
  { path: '/mentor/requests', name: 'mentor requests' },
  { path: '/mentoring', name: 'find mentors' },
  { path: '/investor/pipeline', name: 'investor pipeline' },
  { path: '/investors', name: 'investor directory' },
  { path: '/org/programs', name: 'org programs' },
  { path: '/org/cohorts', name: 'org cohorts' },
  { path: '/org/applications', name: 'org applications' },
];

/**
 * Establishes the session the middleware and AdminGuard look for.
 * AdminGuard reads `localStorage.user.role`; the middleware only checks that
 * the `cfb_session` cookie exists.
 */
async function signIn(page: Page) {
  await page.context().addCookies([
    { name: 'cfb_session', value: 'e2e', domain: 'localhost', path: '/' },
    { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' },
  ]);
  await page.context().addInitScript(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u_1', email: 'admin@cofounderbay.test', role: 'admin' }),
    );
    // Pin the demo-data toggle so the assertions do not depend on its default.
    localStorage.setItem('cfb_demo_data', '1');
    // Dismiss the cookie banner, which otherwise overlays every page.
    localStorage.setItem('cfb_cookie_consent', 'true');
  });
}

test.describe('authenticated routes', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /*
   * React #418 (the relative-timestamp hydration mismatch) used to be excluded
   * from the error gate here, with a sentinel test asserting the debt still
   * existed. The debt is paid: every relative-time render now goes through
   * `components/common/RelativeTime`, which emits a stable absolute date on
   * the server and during hydration and upgrades to the site's own relative
   * wording after mount. Hydration errors are ordinary uncaught errors again.
   */
  for (const route of ROUTES) {
    test(`${route.name} renders and has no WCAG A/AA violations`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      // Wait for the shell, then for the DOM to go quiet. `networkidle` is not
      // usable here: the app holds a websocket open, so it never fires.
      await page.locator('main#main-content').waitFor({ state: 'attached', timeout: 15_000 });
      await waitForStableDom(page);

      // A page that threw during render would otherwise "pass" the axe scan by
      // virtue of showing the error boundary, which is itself accessible.
      expect(pageErrors, `uncaught errors on ${route.path}`).toEqual([]);
      await expect(page.locator('main#main-content')).toHaveCount(1);

      // Scanned through expect.poll: late data arrivals and post-mount
      // upgrades (RelativeTime swaps its absolute placeholder for relative
      // wording one frame after hydration) can re-render a subtree after the
      // DOM has gone quiet, and a scan landing mid-re-render sees controls
      // whose labels have not been reattached yet. A violation that survives
      // a re-scan is real; one that does not was a transient render state,
      // which is not an accessibility state any user can reach.
      await expect
        .poll(async () => {
          await waitForStableDom(page, 400, 5_000);
          const results = await new AxeBuilder({ page })
            .exclude(LOGOTYPE)
            .withTags(TAGS)
            // Radix mounts a Tabs/DropdownMenu panel only while it is open, so
            // inactive triggers' `aria-controls` point at ids that do not exist
            // yet. That is library behaviour, not app markup — force-mounting
            // every panel to satisfy the rule would cost more than it buys. The
            // dangling-ref test below still covers ids the app writes itself.
            .disableRules(['aria-valid-attr-value'])
            .analyze();
          return results.violations.map(
            (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`,
          );
        }, {
          message: `axe violations on ${route.path}`,
          // Each attempt is a 5s stable-DOM wait plus a full axe scan, and under
          // the 2 workers CI uses those scans contend for one Next server and a
          // single-threaded stub API. A 20s budget could not fit three attempts
          // and expired mid-scan, which surfaced as a different "failing" route
          // on every run. The assertion is unchanged — only the patience.
          timeout: 45_000,
          intervals: [0, 1500, 3000],
        })
        .toEqual([]);
    });
  }

  test('no app-authored aria-controls points at a missing element', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Complements the disabled axe rule above: Radix generates ids prefixed
    // `radix-`, so anything else that dangles is ours and is a real bug.
    const dangling = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-controls]')]
        .map((el) => el.getAttribute('aria-controls') ?? '')
        .filter((id) => id && !id.startsWith('radix-') && !document.getElementById(id)),
    );
    expect(dangling).toEqual([]);
  });

  test('the app shell is mounted exactly once', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.locator('main#main-content')).toHaveCount(1);
    // The sidebar, not every aside: a page rail ("Page tools") is a second,
    // legitimate aside on /discover and the other railed pages.
    await expect(page.locator('aside[aria-label^="Main navigation"]')).toHaveCount(1);
  });

  /**
   * The inverse of the sentinel that used to sit here. That test asserted the
   * relative-timestamp hydration mismatch (React #418) still existed, so that
   * fixing it would force the error-gate exclusion to be deleted — which has
   * now happened. This keeps the routes it sampled explicitly clean: they are
   * the ones that render relative times most densely, and a regression in
   * `RelativeTime` (or a new call site bypassing it) shows up here first.
   */
  test('relative timestamps hydrate without a mismatch', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const hydrationErrors: string[] = [];
    for (const path of ['/feed', '/notifications', '/milestones', '/achievements']) {
      errors.length = 0;
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      hydrationErrors.push(
        ...errors
          .filter((m) => /Minified React error #(418|423|425)/.test(m) || /hydrat/i.test(m))
          .map((m) => `${path}: ${m}`),
      );
    }

    expect(hydrationErrors).toEqual([]);
  });

  test('the shell survives client-side navigation within a section', async ({ page }) => {
    await page.goto('/investor/pipeline', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);

    // Tag the live nodes; if navigation remounts the shell the tags are lost.
    await page.evaluate(() => {
      document.querySelector('aside')?.setAttribute('data-probe', 'x');
      document.querySelector('main#main-content')?.setAttribute('data-probe', 'x');
    });

    const target = page.locator('a[href^="/investor/"]').first();
    await target.click();
    await page.waitForTimeout(1800);

    await expect(page.locator('aside[data-probe="x"]')).toHaveCount(1);
    await expect(page.locator('main#main-content[data-probe="x"]')).toHaveCount(1);
  });
});
