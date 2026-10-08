import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, locale: 'el' });
await ctx.addCookies([
  { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
  { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
]);
const page = await ctx.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
for (const [route, name, wait] of [
  ['/shortlist', 'shortlist', 3500],
  ['/endorsements', 'endorsements', 3500],
  ['/ai', 'ai_empty', 3500],
]) {
  await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `.probes/shot_${name}.png` });
}
await b.close();
