// Section headings outside cards, per route: size, weight, text. Answers
// "is a section heading louder than the cards it introduces?" against the
// Members page, whose section label ("Featured members") sits under its
// card titles.
//   node .probes/heading_census.mjs <routes.txt> [width=390] [out.json]
// Env: BASE, ROLE (default existing_founder).
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
await ctx.addCookies([
  { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
  { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: process.env.ROLE ?? 'existing_founder', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('user', JSON.stringify({ id: 'preview-demo-user', email: 'probe@cofounderbay.test', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('cfb.dashboard.founder.full', '1');
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
  } catch { /* ignore */ }
});
const page = await ctx.newPage();
const rows = [];
for (const route of routes) {
  try { await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }); } catch { /* measured as is */ }
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const main = document.querySelector('main#main-content') ?? document.querySelector('main') ?? document.body;
    const shown = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
    const FLOAT = '[role=dialog],[role=menu],[data-rail-surface],[data-rail-content],nav';
    const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
    const h1 = document.querySelector('main h1, h1');
    const cardTitles = [...main.querySelectorAll('[data-card] .card-title, [data-card] h2, [data-card] h3')].filter((el) => shown(el) && !el.closest(FLOAT)).map(fs);
    const minCardTitle = cardTitles.length ? Math.min(...cardTitles) : null;
    const heads = [...main.querySelectorAll('h2,h3,h4,[role=heading]')]
      .filter((el) => shown(el) && !el.closest('[data-card]') && !el.closest(FLOAT) && (el.innerText ?? '').trim())
      .map((el) => ({ tag: el.tagName.toLowerCase(), size: Number(fs(el).toFixed(2)), weight: getComputedStyle(el).fontWeight, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80), text: (el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 50) }));
    return { h1: h1 ? Number(fs(h1).toFixed(2)) : null, minCardTitle, heads };
  });
  rows.push({ route, ...m });
  const loud = m.heads.filter((h) => m.minCardTitle && h.size > m.minCardTitle + 0.3);
  console.log(`${route} | h1 ${m.h1} | card title ${m.minCardTitle ?? '-'} | sections ${m.heads.length} | louder than a card title ${loud.length}${loud.length ? ' : ' + loud.map((h) => `${h.text} ${h.size}`).join('; ') : ''}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
await b.close();
