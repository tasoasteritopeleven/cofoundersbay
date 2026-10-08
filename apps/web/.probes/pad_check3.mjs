import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','minimal'); });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/settings/notifications', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
const res = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.card-comfortable').forEach(el => {
    if (/p-0/.test(el.className)) {
      const cs = getComputedStyle(el);
      out.push({ cls: el.className.slice(0,90), pad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}` });
    }
  });
  return out.slice(0,6);
});
console.log(JSON.stringify(res));
await b.close();
