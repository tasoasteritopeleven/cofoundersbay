import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }, { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const warns = []; page.on('console', (m) => { if (m.text().includes('unique "key"')) warns.push(1); });
await page.goto('http://localhost:3000/admin/user-management', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4500);
const m = await page.evaluate(() => ({
  railIcons: document.querySelectorAll('aside[aria-label*="tools" i] button[aria-expanded]').length,
  leftAside: !!document.querySelector('aside.space-y-4'),
  searchInput: !!document.querySelector('input[aria-label="Search users"]'),
  notice: !![...document.querySelectorAll('button')].find(b => /Sample data|Δείγμα/.test(b.textContent || '')),
  xScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
// Open rail -> filters section -> change role filter -> check table reacts
const strip = page.locator('aside[aria-label*="tools" i], aside[aria-label*="Εργαλεία" i]').first();
await strip.hover(); await page.waitForTimeout(600);
const sections = await page.locator('aside button[aria-expanded]').count();
console.log(JSON.stringify({ m, sections, errors: errs.length, keyWarns: warns.length }));
await page.screenshot({ path: 'C:/Users/anast/IdeaProjects/CoFounderBay/apps/web/.probes/um-1440.png' });
await browser.close();
