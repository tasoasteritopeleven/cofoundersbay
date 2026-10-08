import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); });
const p = await ctx.newPage();
for (const route of (process.env.ROUTES || '/members,/profile').split(',')) {
  await p.goto('http://localhost:3000' + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  const btns = p.locator('[aria-label^="Page tools"] button[aria-expanded]');
  for (let i = 0; i < await btns.count(); i++) {
    await btns.nth(i).click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const dl = document.querySelector('[data-rail-content] dl'); if (!dl) return null;
      const row = dl.querySelector('div'); const span = row.querySelector('dt > span'); const dt = row.querySelector('dt');
      const cs = getComputedStyle(span), rs = getComputedStyle(row);
      return { spanPos: cs.position, spanLeft: cs.left, rowPadL: rs.paddingLeft, rowPos: rs.position, rowCls: row.className, iconRight: Math.round(span.getBoundingClientRect().right), textLeft: Math.round(dt.querySelector('[lang], span:not([aria-hidden])')?.getBoundingClientRect().left ?? -1) };
    });
    if (r) { console.log(route, i, JSON.stringify(r)); break; }
  }
}
await b.close();
