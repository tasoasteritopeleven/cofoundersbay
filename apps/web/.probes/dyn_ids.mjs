// Harvests one real id per dynamic route by visiting the list page that links
// to it in demo mode — ids the demo world actually serves, not guesses.
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
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
const SOURCES = ['/projects', '/research', '/matches', '/discover', '/events', '/groups', '/programs',
  '/fundraising', '/investors', '/org/cohorts', '/admin/users', '/admin/user-management', '/feed',
  '/members', '/connections', '/builder/pitch-deck', '/data-room', '/org', '/tenant', '/dashboard/investor', '/deals'];
const PATTERNS = {
  '/projects/[projectId]': /^\/projects\/[^/?#]+$/, '/research/[boardId]': /^\/research\/(?!new)[^/?#]+$/,
  '/matches/[userId]': /^\/matches\/[^/?#]+$/, '/profiles/[userId]': /^\/profiles\/[^/?#]+$/,
  '/p/[username]': /^\/p\/[^/?#]+$/, '/events/[id]': /^\/events\/(?!create)[^/?#]+$/,
  '/groups/[groupId]': /^\/groups\/(?!my$)[^/?#]+$/, '/programs/[id]': /^\/programs\/(?!my-programs)[^/?#]+$/,
  '/data-room/[id]': /^\/data-room\/[^/?#]+$/, '/startups/[id]': /^\/startups\/[^/?#]+$/,
  '/pitch/[id]': /^\/pitch\/[^/?#]+$/, '/share/[token]': /^\/share\/[^/?#]+$/,
  '/org/[slug]': /^\/org\/(?!cohorts|settings|events|members|programs)[^/?#]+$/,
  '/org/[slug]/admin': /^\/org\/[^/?#]+\/admin$/, '/org/cohorts/[id]': /^\/org\/cohorts\/[^/?#]+$/,
  '/admin/user-detail/[id]': /^\/admin\/user-detail\/[^/?#]+$/, '/t/[slug]': /^\/t\/[^/?#]+$/,
};
const found = {};
for (const src of SOURCES) {
  await page.goto('http://localhost:3000' + src, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  for (const h of hrefs) {
    if (!h || !h.startsWith('/')) continue;
    const path = h.split(/[?#]/)[0];
    for (const [k, re] of Object.entries(PATTERNS)) if (!found[k] && re.test(path)) found[k] = path;
  }
}
for (const k of Object.keys(PATTERNS)) console.log(k.padEnd(28), found[k] ?? '—');
await b.close();
