import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const BASE = 'http://localhost:3000';
const routes = (process.env.PROBE_ROUTES || 'org/settings').split(',');
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
for (const r of routes) {
  const route = r.startsWith('/') ? r : '/' + r;
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(900);
  const items = await page.evaluate(() => {
    const main = document.querySelector('#main-content') || document.querySelector('main') || document.body;
    return [...main.querySelectorAll('button,a[href],[role=button]')].filter((el) => {
      const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false;
      const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent || '').trim();
      return !name || /^\d+$/.test(name);
    }).map((el) => {
      const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null;
      const near = el.closest('div')?.querySelector('label, p, h3, h4')?.textContent;
      return { id: el.id || '-', labelfor: label || '-', nearby: (near || '-').slice(0, 60) };
    });
  });
  console.log(route, 'unnamed:', items.length);
  items.forEach((i) => console.log('   id:', i.id, '| label-for:', i.labelfor, '| nearby:', i.nearby));
}
await b.close();
