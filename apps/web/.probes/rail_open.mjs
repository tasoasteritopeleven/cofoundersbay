import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const route = '/' + (process.env.ROUTE || 'profile');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: process.env.ROLE || 'founder', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
p.on('console', (m) => { if (m.type() === 'error' && /key|Warning/.test(m.text())) errors.push('console: ' + m.text().slice(0, 120)); });
await p.goto('http://localhost:3000' + route, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1000);
const strip = p.locator('[aria-label^="Page tools"] button[aria-expanded]');
const n = await strip.count();
for (let i = 0; i < n; i++) {
  const btn = strip.nth(i);
  const name = await btn.getAttribute('aria-label');
  await btn.click();
  await p.waitForTimeout(400);
  const panel = await p.evaluate(() => {
    const c = document.querySelector('[data-rail-content]');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), text: c.innerText.replace(/\s+/g, ' ').slice(0, 160), overflow: c.scrollWidth - c.clientWidth };
  });
  console.log(`[${name}]`, JSON.stringify(panel));
  if (i === 0 || process.env.SHOT_ALL) await p.screenshot({ path: `.probes/rail-${route.replace(/\//g, '_')}-${i}.png` });
}
console.log('sections', n, 'errors', errors.length, errors.slice(0, 3));
await b.close();
