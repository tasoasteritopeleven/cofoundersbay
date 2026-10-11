import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
for (const w of [1280, 1440, 1920]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' }, { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' }]);
  await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' })); localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('cfb_cookie_consent', 'true'); });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3000/research/board-gtm', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);
  const m = await page.evaluate(() => {
    const tb = [...document.querySelectorAll('div')].find((d) => d.className.includes('h-12') && d.className.includes('border-b'));
    if (!tb) return { found: false };
    const kids = [...tb.children];
    return { found: true, scroll: tb.scrollWidth, client: tb.clientWidth, items: kids.length,
      overlap: kids.slice(0, -1).filter((k, i) => k.getBoundingClientRect().right > kids[i + 1].getBoundingClientRect().left + 1).length };
  });
  console.log(`@${w} toolbar=${m.scroll}px avail=${m.client}px overflow=${m.scroll - m.client} overlapPairs=${m.overlap} errors=${errs.length}`);
  if (w === 1440) await page.screenshot({ path: 'C:/Users/anast/IdeaProjects/CoFounderBay/apps/web/.probes/toolbar-1440.png', clip: { x: 0, y: 0, width: 1440, height: 140 } });
  await ctx.close();
}
await browser.close();
