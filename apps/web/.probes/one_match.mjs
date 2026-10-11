import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.context().addCookies([
  { name: 'cfb_session', value: 'probe', url: 'http://localhost:3000' },
  { name: 'cfb_primary_role', value: 'platform_admin', url: 'http://localhost:3000' },
]);
await page.goto('http://localhost:3000/matches', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'probe', primaryRole: 'platform_admin' }));
  localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true');
});
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3000);
const btns = await page.getByRole('button', { name: /Breakdown|Ανάλυση/i }).all();
console.log('breakdown buttons:', btns.length);
for (let i = 0; i < Math.min(btns.length, 4); i++) {
  console.log(i, JSON.stringify(await btns[i].innerText().catch(() => '?')), 'visible:', await btns[i].isVisible());
}
if (btns.length) {
  await btns[0].click();
  await page.waitForTimeout(1500);
  console.log('dialogs:', await page.locator('[role="dialog"]').count());
  console.log('sheet/dialog nodes:', await page.locator('[data-state="open"][role="dialog"], .fixed.z-50').count());
  console.log('url:', page.url());
  await page.screenshot({ path: '.probes/shots/match_breakdown.png' });
}
await browser.close();
