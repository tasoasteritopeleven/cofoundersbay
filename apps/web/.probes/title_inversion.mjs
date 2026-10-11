// Text that outranks its page's title: a sentence, a label or a section
// heading set larger than the h1 (on a phone the title step is 15.343-15.656
// while an unclassed paragraph inherits the 16.327 body). Figures (digits
// only, .page-stat, .page-figure), the landing display and the wordmark are
// exempt.
//   node .probes/title_inversion.mjs <routes.txt> [width=390] [out.json]
// Env: BASE, ROLE (default existing_founder), ANON=1 (signed out).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const W = Number(process.argv[3] ?? 390);
const OUT = process.argv[4];
const BASE = process.env.BASE ?? 'http://localhost:3000';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
if (!process.env.ANON) {
  await ctx.addCookies([
    { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
    { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
    { name: 'cfb_primary_role', value: process.env.ROLE ?? 'existing_founder', domain: 'localhost', path: '/' },
  ]);
}
await ctx.addInitScript((anon) => {
  try {
    if (!anon) {
      localStorage.setItem('user', JSON.stringify({ id: 'preview-demo-user', email: 'probe@cofounderbay.test', role: 'founder' }));
      localStorage.setItem('cfb_demo_data', '1');
    }
    localStorage.setItem('cfb_cookie_consent', 'true');
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
  } catch { /* ignore */ }
}, !!process.env.ANON);
const page = await ctx.newPage();
const rows = [];
for (const route of routes) {
  try { await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }); } catch { /* measured as is */ }
  await page.waitForTimeout(600);
  let m = null;
  for (let i = 0; i < 3 && !m; i++) {
    try {
      m = await page.evaluate(() => {
        const shown = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
        const h1 = [...document.querySelectorAll('h1')].find(shown);
        if (!h1) return { h1: null, loud: [] };
        const t = parseFloat(getComputedStyle(h1).fontSize);
        const main = document.querySelector('main#main-content') ?? document.querySelector('main') ?? document.body;
        const loud = [];
        for (const el of main.querySelectorAll('*')) {
          if (h1.contains(el) || el.closest('.sr-only,h1,[data-logotype],.landing-display,svg,[role=dialog],[data-rail-surface],.page-stat,.page-figure,.founder-dash-stat,.founder-dash-figure,.score-emblem-figure,[data-card-chart],.recharts-wrapper,input,textarea,select')) continue;
          const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
          if (!own || /^[\s\d.,/%$€£+\-–−↑↓×xKkMmBb:]+$/.test(own) || !shown(el)) continue;
          const s = parseFloat(getComputedStyle(el).fontSize);
          if (s > t + 0.3) loud.push(`${el.tagName.toLowerCase()} "${own.slice(0, 40)}" ${s.toFixed(2)}>${t.toFixed(2)}`);
        }
        return { h1: t, loud };
      });
    } catch { await page.waitForTimeout(800); }
  }
  if (!m) { console.log(`${route} | not measured`); continue; }
  rows.push({ route, ...m });
  console.log(`${route} | h1 ${m.h1?.toFixed(2) ?? '-'} | louder ${m.loud.length}${m.loud.length ? ' : ' + m.loud.slice(0, 3).join('; ') : ''}`);
}
console.log(`\n=== TOTAL louder than the page title: ${rows.reduce((s, r) => s + r.loud.length, 0)} on ${rows.filter((r) => r.loud.length).length} routes`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
await b.close();
