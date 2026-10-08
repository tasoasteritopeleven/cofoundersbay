import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }, { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const warns = []; page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('key')) warns.push(m.text().slice(0, 80)); });

// 1. Research canvas: rail toggles grid state (peek -> view section -> click)
await page.goto('http://localhost:3000/research/board-gtm', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4500);
const strip = page.locator('aside[aria-label*="Page tools"], aside[aria-label*="Εργαλεία"]');
await strip.hover(); await page.waitForTimeout(700);
const gridRow = page.getByRole('button', { name: /grid|πλέγμα/i }).first();
await gridRow.click(); await page.waitForTimeout(400);
const research = await page.evaluate(() => ({ railOpen: !!document.querySelector('aside[aria-label]'), filterRow: !![...document.querySelectorAll('button')].find(b => /find_nodes|Find nodes/i.test(b.title || '')) }));

// 2. Matches: chips visible on desktop, no filter sidebar, rail present
await page.goto('http://localhost:3000/matches', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4500);
const matches = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('button')].filter(b => /Excellent|Strong|Good|Potential|Εξαιρετικ/i.test(b.textContent || '')).length;
  const rail = document.querySelector('aside[aria-label]');
  return { chips, rail: !!rail };
});

// 3. Admin: tabs in column, rail with 2 sections, no dup nav list
await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4500);
const admin = await page.evaluate(() => {
  const tabs = document.querySelectorAll('[role="tab"]').length;
  const railIcons = document.querySelectorAll('aside button[aria-expanded]').length;
  return { tabs, railIcons };
});
console.log(JSON.stringify({ research, matches, admin, errors: errs.length, keyWarns: warns.length }));
await browser.close();
