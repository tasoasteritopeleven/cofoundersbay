import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','minimal'); });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/readiness', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
const res = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.card-header').forEach(h => {
    const sib = h.nextElementSibling;
    out.push({
      headerClasses: h.className.slice(0,80),
      sibMatches: sib ? sib.className.slice(0,80) : 'NONE',
      sibTop: sib ? getComputedStyle(sib).paddingTop : null,
      directChild: h.parentElement.className.slice(0,60),
    });
  });
  const sheet = [...document.styleSheets].map(s => { try { return [...s.cssRules].length } catch { return 'x' } });
  return { pairs: out.slice(0,6), sheets: sheet.length };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
