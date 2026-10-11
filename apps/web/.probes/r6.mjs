import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); });
const p = await ctx.newPage(); await p.goto('http://localhost:3000/help', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
console.log(await p.evaluate(() => [...document.querySelectorAll('#main-content button')].filter(e => getComputedStyle(e).borderTopLeftRadius === '6px').slice(0, 3).map(e => e.className.slice(0, 200) + ' | ' + e.textContent.trim().slice(0, 40)).join('\n')));
await b.close();
