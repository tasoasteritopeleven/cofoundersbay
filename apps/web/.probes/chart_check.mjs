import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(({ theme }) => { localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'investor' })); localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); if (theme) localStorage.setItem('theme', theme); }, { theme: process.env.THEME || 'minimal' });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/investor/portfolio', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
// switch to sectors tab if needed
const tab = p.locator('text=/Sector mix|Κατανομή/').first();
if (await tab.count()) { await tab.click().catch(()=>{}); await p.waitForTimeout(1200); }
const fills = await p.evaluate(() => Array.from(document.querySelectorAll('.recharts-pie-sector path, .recharts-sector')).map(el => getComputedStyle(el).fill || el.getAttribute('fill')).slice(0, 8));
console.log('fills:', JSON.stringify(fills));
const tokens = await p.evaluate(() => ['--primary','--chart-2','--chart-3','--chart-4','--chart-5','--chart-6'].map(t => `${t}=${getComputedStyle(document.documentElement).getPropertyValue(t)}`));
console.log('tokens:', tokens.join(' | '));
await p.screenshot({ path: '.probes/chk-sectors.png' });
await b.close();
