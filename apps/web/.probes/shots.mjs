// Full-page screenshots of a route list, for a visual audit.
//   node .probes/shots.mjs <routes.txt> [width=1440] [outDir=.probes/shots]
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean);
const W = Number(process.argv[3] ?? 1440);
const OUT = process.argv[4] ?? '.probes/shots';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: process.env.ROLE ?? 'platform_admin', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
  localStorage.setItem('theme', 'light');
  // keep first-run tours out of the frame
  const origGet = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { return /tour/i.test(k) ? 'done' : origGet.call(this, k); };
});
const page = await ctx.newPage();
for (const r of routes) {
  await page.goto('http://localhost:3000' + r, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const name = r.replace(/^\//, '').replace(/[\/\[\]]/g, '_') || 'home';
  await page.screenshot({ path: `${OUT}/${name}_${W}.png`, fullPage: process.env.FULL !== '0' }).catch(() => {});
  console.log('shot', r);
}
await b.close();
