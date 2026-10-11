import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
for (const route of ['/data-room/demo', '/admin/billing', '/fundraising', '/org/settings']) {
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
  const errs = [], keyWarns = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && /key/i.test(m.text())) keyWarns.push(m.text().slice(0, 100)); });
  await page.goto('http://localhost:3000' + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const strip = page.locator('aside[aria-label*="Page tools" i], aside[aria-label*="Εργαλεία" i]');
  const sections = await strip.locator('button[aria-expanded]').count();
  if (sections) { await strip.locator('button[aria-expanded]').first().click(); await page.waitForTimeout(600); }
  const xScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `C:/Users/anast/IdeaProjects/CoFounderBay/apps/web/.probes/w2-${route.replace(/\W/g, '_')}.png` });
  console.log(`${route.padEnd(18)} sections=${sections} xScroll=${xScroll} errors=${errs.length} keyWarns=${keyWarns.length}${errs.length ? ' :: ' + errs[0] : ''}`);
  await ctx.close();
}
await browser.close();
