import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();

for (const theme of ['dark', 'light']) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addCookies([
    { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
    { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
  ]);
  const page = await ctx.newPage();
  // theme + session keys must exist before the app boots
  await ctx.addInitScript((t) => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('accessToken', 'preview-demo');
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('theme', t);
    localStorage.setItem('cfb.tour.matches.preview-demo-user', 'done');
    localStorage.setItem('cfb.tour.discover.preview-demo-user', 'done');
  }, theme);
  await page.goto('http://localhost:3000/matches', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(3500);
  const skip = page.locator('[data-testid="first-run-tour-skip"]');
  if (await skip.count()) { await skip.first().click().catch(() => {}); await page.waitForTimeout(500); }
  console.log(theme, '->', page.url());
  await page.screenshot({ path: `.probes/ring_${theme}.png` });
  await ctx.close();
}
await b.close();
