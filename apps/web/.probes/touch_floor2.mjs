import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','minimal'); });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/shortlist', { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);
const res = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, a, [role="button"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 44 && /h-(7|8|9)\b|min-h-(7|8|9)\b/.test(el.className)) {
      out.push({ cls: el.className.match(/h-\d+[^ ]*/)?.[0], h: Math.round(r.height * 10) / 10 });
    }
  });
  return { under44: out.slice(0, 8), count: out.length };
});
console.log(JSON.stringify(res));
await b.close();
