import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
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
const errs = [], keyWarns = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && /key/i.test(m.text())) keyWarns.push(m.text().slice(0, 120)); });
const orgResp = page.waitForResponse((r) => r.url().includes('/organizations'), { timeout: 20000 }).catch(() => null);
await page.goto('http://localhost:3000/org/demo/admin', { waitUntil: 'domcontentloaded', timeout: 90000 });
const resp = await orgResp;
await page.waitForTimeout(3500);

const base = await page.evaluate(() => ({
  tabs: document.querySelectorAll('[role=tab]').length,
  rows: document.querySelectorAll('tbody tr').length,
  notice: /illustrative|sample/i.test(document.body.innerText),
  title: document.querySelector('h1')?.textContent ?? '',
  xScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));

// the rail strip lives in its own labelled aside; icons carry aria-expanded
const strip = page.locator('aside[aria-label*="Page tools" i], aside[aria-label*="Εργαλεία" i]');
const icons = strip.locator('button[aria-expanded]');
const sections = await icons.count();
if (sections) { await icons.nth(1).click(); await page.waitForTimeout(700); }
const panel = await page.evaluate(() => ({
  railOpen: /Organisation totals|Οργανισμός|Member filters|Member tools|Σύνολα/.test(document.body.innerText),
}));
await page.screenshot({ path: 'C:/Users/anast/IdeaProjects/CoFounderBay/apps/web/.probes/orgadmin.png' });
console.log(JSON.stringify({
  ...base, orgApi: resp ? resp.status() : 'none',
  railSections: sections, ...panel, errors: errs.length, err0: errs[0], keyWarns: keyWarns.length,
}));
await browser.close();
