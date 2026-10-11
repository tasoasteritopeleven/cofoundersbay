import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','minimal'); });
const p = await ctx.newPage();
for (const [route, name] of [['/settings/notifications','p3_notifications'],['/readiness','p3_readiness'],['/matches','p3_matches']]) {
  await p.goto('http://localhost:3000' + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);
  await p.screenshot({ path: `.probes/${name}.png` });
}
await b.close();
