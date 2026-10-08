// Viewport screenshots of a route list, tiled six per sheet with captions,
// for a visual pass over many pages at once.
//   node .probes/contact_sheet.mjs <routes.txt> <outDir> [width=1440]
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean);
const OUT = process.argv[3];
const W = Number(process.argv[4] ?? 1440);
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
  const get = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
});
const page = await ctx.newPage();
const shots = [];
for (const r of routes) {
  await page.goto('http://localhost:3000' + r, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(900);
  shots.push({ route: r, data: (await page.screenshot({ type: 'jpeg', quality: 70 })).toString('base64') });
}
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1800, height: 1500 });
for (let i = 0; i < shots.length; i += 6) {
  const group = shots.slice(i, i + 6);
  await sheet.setContent(`<body style="margin:0;background:#222;font:600 18px system-ui;color:#fff;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">${group
    .map((s) => `<figure style="margin:0"><figcaption style="padding:4px 2px">${s.route}</figcaption><img style="width:100%;display:block" src="data:image/jpeg;base64,${s.data}"></figure>`)
    .join('')}</body>`);
  await sheet.screenshot({ path: `${OUT}/sheet_${String(i / 6 + 1).padStart(2, '0')}.png`, fullPage: true });
}
console.log(`${shots.length} routes, ${Math.ceil(shots.length / 6)} sheets in ${OUT}`);
await b.close();
