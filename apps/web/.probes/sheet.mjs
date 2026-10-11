import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
for (const [w, route] of [[390, '/admin'], [834, '/admin'], [834, '/coaching'], [390, '/research/board-gtm']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }, { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' }]);
  await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3000' + route, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(4000);
  const btn = page.getByRole('button', { name: /Page tools|Εργαλεία σελίδας/ }).first();
  const visible = await btn.isVisible().catch(() => false);
  let sections = -1, firstOpen = '';
  if (visible) { await btn.click(); await page.waitForTimeout(600); const dlg = page.getByRole('dialog'); sections = await dlg.locator('button[aria-expanded]').count(); firstOpen = (await dlg.locator('[id^=page-rail-sheet-]').first().innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 90); await page.screenshot({ path: `C:/Users/anast/IdeaProjects/CoFounderBay/apps/web/.probes/sheet-${w}-${route.replace(/\W/g, '_')}.png` }); }
  const xScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`@${w} ${route.padEnd(22)} trigger=${visible} sections=${sections} xScroll=${xScroll} errors=${errs.length}  first: ${firstOpen}`);
  await ctx.close();
}
await browser.close();
