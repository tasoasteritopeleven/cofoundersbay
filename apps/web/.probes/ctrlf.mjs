import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:3000/research/board-gtm', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(4500);
await page.keyboard.press('Control+f'); await page.waitForTimeout(700);
const after = await page.evaluate(() => {
  const panel = document.querySelector('aside[aria-label] div.overflow-y-auto');
  return { panelText: panel ? panel.innerText.slice(0, 120) : '(no panel)', hasInput: !!panel?.querySelector('input') };
});
console.log(JSON.stringify({ after, errors: errs.length }));
await browser.close();
