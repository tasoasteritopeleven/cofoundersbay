/**
 * Clock probe: every static route with the browser's clock moved away from the
 * server's. Pages are prerendered at build time, so anything a page dates from
 * "now" while rendering is frozen into the HTML; when the reader's day differs,
 * hydration fails with React #418. This makes that difference large on purpose
 * and reports every route that throws.
 *
 * Run from the repo root against a running production server (same sign-in as
 * platform-sweep.mjs: platform_admin, demo mode):
 *
 *   node scripts/clock-probe.mjs [routes.txt] [daysAhead=50]
 *
 * A pass means no page threw at one width for one role with that offset. It
 * does not prove a page shows the right date, only that it does not freeze one.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const BASE = 'http://localhost:3000';
const routes = readFileSync(process.argv[2] ?? new URL('./platform-sweep-routes.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const DAYS = Number(process.argv[3] ?? 50);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(Date.now() + DAYS * 86_400_000));

const failing = [];
for (const route of routes) {
  const errors = [];
  const onErr = (e) => errors.push(e.message.slice(0, 100));
  page.on('pageerror', onErr);
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(600);
  } catch (e) { errors.push('NAV:' + e.message.slice(0, 60)); }
  page.off('pageerror', onErr);
  if (errors.length) {
    failing.push(route);
    console.log(`${route} | ${errors[0]}`);
  }
}
console.log(`clock +${DAYS}d: ${routes.length} routes, ${failing.length} throwing`);
await browser.close();
process.exit(failing.length ? 1 : 0);
