import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const BASE = 'http://localhost:3000';
const tag = process.env.TAG || 'after';
const W = Number(process.env.W || 1440);
const routes = (process.env.PROBE_ROUTES || 'readiness,help,marketplace,recommendations,reputation,analytics').split(',');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: process.env.ROLE || 'founder', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(({ theme }) => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'founder' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
  if (theme) localStorage.setItem('theme', theme);
}, { theme: process.env.THEME || '' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
for (const r of routes) {
  const route = '/' + r.replace(/^\//, '');
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const main = document.querySelector('#main-content') || document.body;
    const radii = {};
    for (const el of main.querySelectorAll('button, [data-surface="card"], input, [role="combobox"]')) {
      const r = getComputedStyle(el).borderTopLeftRadius;
      const k = `${el.tagName === 'BUTTON' ? 'button' : el.getAttribute('data-surface') || el.tagName.toLowerCase()}:${r}`;
      radii[k] = (radii[k] || 0) + 1;
    }
    const de = document.documentElement;
    return { radii, xScroll: de.scrollWidth - de.clientWidth };
  });
  const file = `.probes/calm-${tag}-${W}-${r.replace(/\//g, '_')}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(route, 'xScroll', m.xScroll, JSON.stringify(m.radii));
}
console.log('pageerrors', errors.length, errors.slice(0, 3));
await b.close();
