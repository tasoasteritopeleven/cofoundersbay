import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','minimal'); });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/readiness', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
const res = await p.evaluate(() => {
  const out = {};
  const el = document.querySelector('[data-surface="card"]');
  if (el) out.card = getComputedStyle(el).boxShadow + ' | ' + getComputedStyle(el).borderRadius;
  const content = document.querySelector('.card-comfortable:not(.card-header)');
  if (content) { const cs = getComputedStyle(content); out.content = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`; }
  const header = document.querySelector('.card-header');
  if (header) { const cs = getComputedStyle(header); out.header = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`; }
  return out;
});
console.log(JSON.stringify(res));
await b.close();
