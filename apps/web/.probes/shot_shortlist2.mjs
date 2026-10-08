import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
  { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
]);
const page = await ctx.newPage();
await page.goto('http://localhost:3000/shortlist', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3000);
const skip = page.locator('button[aria-label*="Skip tour"], button[aria-label*="Παράλειψη"]');
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(800); }
await page.waitForTimeout(2000);
await page.screenshot({ path: '.probes/shot_shortlist2.png' });
await b.close();
