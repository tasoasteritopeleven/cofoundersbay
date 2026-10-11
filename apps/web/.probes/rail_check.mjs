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
await page.goto('http://localhost:3000/builder?tab=market', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1'); localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3500);
const info = await page.evaluate(() => {
  const shell = document.querySelector('[data-rail]');
  const rails = document.querySelectorAll('[data-page-rail]');
  const saveBtn = [...document.querySelectorAll('button')].find(b => /Αποθήκευση|Save/.test(b.textContent));
  const r = saveBtn?.getBoundingClientRect();
  return {
    dataRail: shell?.getAttribute('data-rail'),
    marginRight: shell ? getComputedStyle(shell).marginRight : null,
    railCount: rails.length,
    saveBtnRight: r ? Math.round(r.right) : null,
    innerWidth: window.innerWidth,
    overlap: r ? Math.round(window.innerWidth - r.right) : null,
  };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: '.probes/rail_builder.png' });
await b.close();
