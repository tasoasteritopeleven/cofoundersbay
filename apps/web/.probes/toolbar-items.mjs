import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/research/board-gtm', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(5000);
const items = await page.evaluate(() => {
  const tb = [...document.querySelectorAll('div')].find((d) => d.className.includes('h-12') && d.className.includes('border-b'));
  return [...tb.children].map((k) => ({ w: Math.round(k.getBoundingClientRect().width), label: (k.innerText || k.getAttribute('aria-label') || k.tagName).replace(/\n/g, ' ').slice(0, 45) }));
});
console.log(JSON.stringify(items, null, 0));
await browser.close();
