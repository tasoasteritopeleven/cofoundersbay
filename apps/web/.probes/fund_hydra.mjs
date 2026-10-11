import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();

// Scenario A: overlay state exists in sessionStorage (user added a lead and
// moved one earlier) — server HTML can only contain the seed view, so the
// first client render disagrees.
{
  const ctx = await b.newContext();
  await ctx.addCookies([
    { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
    { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
  ]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGE:' + e.message.slice(0, 160)));
  // seed the browser state before the app boots
  await ctx.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('accessToken', 'preview-demo');
    localStorage.setItem('cfb_cookie_consent', 'true');
    sessionStorage.setItem('cfb:demo-fundraising', JSON.stringify({
      created: [{ id: 'l-9', name: 'Overlay Investor', type: 'Angel', stage: 'Seed', checkSize: '$50K', status: 'prospect', isVerified: false }],
      status: { ata: 'passed' },
      docsStatus: { d3: 'shared' },
      docsUpdated: { d3: '2026-10-01T00:00:00.000Z' },
    }));
  });
  await page.goto('http://localhost:3000/fundraising', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  const hasOverlayRow = await page.locator('text=Overlay Investor').count();
  console.log('A overlay-row:', hasOverlayRow, '| console errors:', errors.length);
  errors.slice(0, 5).forEach((e) => console.log('   ', e));
  await ctx.close();
}

// Scenario B: clock moved +40 days — the "days left" figure frozen into the
// prerendered HTML must disagree with the browser's clock.
{
  const ctx = await b.newContext();
  await ctx.addCookies([
    { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
    { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
  ]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGE:' + e.message.slice(0, 160)));
  await ctx.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('accessToken', 'preview-demo');
    localStorage.setItem('cfb_cookie_consent', 'true');
  });
  await page.clock.setFixedTime(new Date(Date.now() + 40 * 86_400_000));
  await page.goto('http://localhost:3000/fundraising', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('B +40d console errors:', errors.length);
  errors.slice(0, 5).forEach((e) => console.log('   ', e));
  await ctx.close();
}

await b.close();
