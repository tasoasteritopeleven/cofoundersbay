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
const measure = (label) => page.evaluate((lbl) => {
  const shell = document.querySelector('[data-rail]');
  const rails = document.querySelectorAll('[data-page-rail]');
  const saveBtn = [...document.querySelectorAll('button')].find(b => /Αποθήκευση|Save/.test(b.textContent));
  const r = saveBtn?.getBoundingClientRect();
  const rail = document.querySelector('[data-page-rail]');
  const rr = rail?.getBoundingClientRect();
  return {
    lbl,
    dataRail: shell?.getAttribute('data-rail'),
    marginRight: shell ? Math.round(shell.getBoundingClientRect().left === 0 ? 0 : window.innerWidth - shell.getBoundingClientRect().right) : null,
    railCount: rails.length,
    saveBtnRight: r ? Math.round(r.right) : null,
    railLeft: rr ? Math.round(rr.left) : null,
    innerWidth: window.innerWidth,
    clear: r && rr ? Math.round(rr.left - r.right) : null,
  };
}, label).then((i) => console.log(JSON.stringify(i)));

// Pinned from the start (localStorage read on mount)
await page.goto('http://localhost:3000/builder?tab=market', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
  localStorage.setItem('cfb:page-rail', '1');
});
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3500);
await measure('market+pinned');
await page.screenshot({ path: '.probes/rail_pinned_market.png' });

// Tab switch: overview -> market (the unmount path that clobbered hasRail)
await page.goto('http://localhost:3000/builder', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3000);
const skipTour = page.locator('button[aria-label*="Skip tour"], button[aria-label*="Παράλειψη"]');
if (await skipTour.count()) { await skipTour.first().click(); await page.waitForTimeout(600); }
await measure('overview+pinned');
const railSections = await page.evaluate(() =>
  [...document.querySelectorAll('[data-page-rail] section, [data-page-rail] [data-rail-content], [data-page-rail] button')].length);
console.log(JSON.stringify({ overviewRailInnerCount: railSections }));
await page.screenshot({ path: '.probes/rail_pinned_overview.png' });
const marketTab = page.locator('[role="tab"], a, button').filter({ hasText: /Αγορά|Market/ }).first();
if (await marketTab.count()) { await marketTab.click(); await page.waitForTimeout(2500); }
await measure('after-switch-to-market');
await page.screenshot({ path: '.probes/rail_after_switch.png' });
await b.close();
