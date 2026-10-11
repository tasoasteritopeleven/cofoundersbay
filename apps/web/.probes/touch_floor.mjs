import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','minimal'); });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/shortlist', { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);
const res = await p.evaluate(() => {
  const el = document.querySelector('button.h-7, button.h-8, a.h-7, [role="button"].h-7');
  if (!el) return 'no h-7/h-8 control on page';
  const r = el.getBoundingClientRect();
  return { cls: el.className.slice(0,80), h: r.height, w: r.width };
});
console.log(JSON.stringify(res));
await b.close();
