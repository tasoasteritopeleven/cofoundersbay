import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'founder' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/research/board-gtm', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(5000);
const r = await page.evaluate(() => {
  const bar = [...document.querySelectorAll('div')].find((d) => d.className.includes('h-12') && d.className.includes('border-b') && d.className.includes('backdrop-blur-sm'));
  const walk = (el) => [...el.children].flatMap((c) => (getComputedStyle(c).display === 'contents' ? walk(c) : [c]));
  return walk(bar).map((c) => { const b = c.getBoundingClientRect(); return `${String(Math.round(b.width)).padStart(4)}px  ${(c.getAttribute('aria-label') || c.getAttribute('title') || c.innerText || c.className.slice(0, 30)).trim().replace(/\n/g, ' ').slice(0, 44)}`; });
});
console.log(r.join('\n'));
await browser.close();
