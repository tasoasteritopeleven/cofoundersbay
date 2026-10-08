import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('theme','apricot'); });
const p = await ctx.newPage(); const msgs = [];
p.on('console', (m) => { if (m.type() === 'error') msgs.push(`[${p.url().split('3000')[1]}] ` + m.text().slice(0, 3000)); });
for (const r of ['readiness', 'dashboard/founder', 'projects']) { await p.goto('http://localhost:3000/' + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); }
const overlay = await p.evaluate(() => { const h = document.querySelector('nextjs-portal'); return h?.shadowRoot?.textContent?.replace(/\s+/g, ' ').slice(0, 600) ?? 'no overlay'; });
console.log(msgs.join('\n') || 'no console errors'); console.log('OVERLAY:', overlay);
await b.close();
