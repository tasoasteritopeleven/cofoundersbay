import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));

const routes = ['/feed', '/projects', '/admin/communities', '/marketplace', '/calendar'];
const out = {};
for (const route of routes) {
  await page.goto(`http://localhost:3000${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const strip = page.locator('aside[aria-label*="Page tools" i], aside[aria-label*="Εργαλεία" i]');
  const sections = await strip.locator('button[aria-expanded]').count();
  let panelText = '';
  if (sections) {
    await strip.locator('button[aria-expanded]').nth(0).click();
    await page.waitForTimeout(800);
    panelText = await page.evaluate(() => document.body.innerText.slice(0, 0));
    panelText = await page.locator('aside[aria-label*="Page tools" i], aside[aria-label*="Εργαλεία" i]').innerText().catch(() => '');
  }
  out[route] = {
    sections,
    panelPeek: panelText.slice(0, 160),
    xScroll: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    h1: await page.evaluate(() => document.querySelector('h1')?.textContent?.slice(0, 60) ?? ''),
  };
  await page.screenshot({ path: `C:/Users/anast/IdeaProjects/CoFounderBay/apps/web/.probes/railwave3-${route.replace(/\//g, '_')}.png` });
}
console.log(JSON.stringify(out, null, 1));
console.log('ERRORS', JSON.stringify(errs));
await browser.close();
