// The two ways the decorative-icon "well" rules can fail, per route:
//  - text hidden with its glyph: an element set to display:none although it
//    holds its own text beside the icon (a text node is not an element child,
//    so `:not(:has(> :not(svg)))` cannot see it);
//  - an empty well: a small framed or tinted box left on screen with its
//    glyphs hidden and nothing else in it (EMPTY-WELL).
//   node .probes/hidden_text.mjs <routes.txt> [width=1440]   (env BASE, ROLE, STATE=stub)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const W = Number(process.argv[3] ?? 1440);
const BASE = process.env.BASE ?? 'http://localhost:3000';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: process.env.STATE === 'stub' ? 'e2e' : 'preview-demo', domain: 'localhost', path: '/' },
  ...(process.env.STATE === 'stub' ? [] : [{ name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' }]),
  { name: 'cfb_primary_role', value: process.env.ROLE ?? 'existing_founder', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript((stub) => {
  try {
    localStorage.setItem('cfb_demo_data', stub ? '0' : '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    const g = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : g.call(this, k); };
  } catch { /* ignore */ }
}, process.env.STATE === 'stub');
const page = await ctx.newPage();
let total = 0;
for (const route of routes) {
  try { await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }); } catch { /* measured as is */ }
  await page.waitForTimeout(500);
  const hits = await page.evaluate(() => {
    const main = document.querySelector('main#main-content') ?? document.querySelector('main, [role="main"]');
    if (!main) return [];
    const out = [];
    for (const el of main.querySelectorAll('div, span')) {
      if (getComputedStyle(el).display !== 'none') continue;
      if (!el.querySelector(':scope > svg')) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!text) continue;
      // Only elements whose parent is shown: the hiding is this rule's, not a closed panel's.
      if (el.parentElement && getComputedStyle(el.parentElement).display === 'none') continue;
      if (el.closest('[hidden], [aria-hidden="true"], .hidden') && !el.matches('.hidden') ) continue;
      if (el.matches('.hidden') || el.closest('[data-state="closed"]')) continue;
      out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/).slice(0, 4).join('.')} "${text.slice(0, 40)}"`);
    }
    // Empty wells: a small framed or tinted box left on screen whose glyphs
    // are all hidden and which holds no text (the other way the rule fails).
    const wells = [];
    for (const el of main.querySelectorAll('div, span')) {
      if (getComputedStyle(el).display === 'none' || !el.querySelector(':scope > svg')) continue;
      if ([...el.children].some((c) => c.tagName.toLowerCase() !== 'svg' || getComputedStyle(c).display !== 'none')) continue;
      if ((el.textContent ?? '').trim()) continue;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      const framed = parseFloat(cs.borderTopWidth) > 0 || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      if (framed && r.width > 0 && r.width <= 64 && r.height <= 64) wells.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/).slice(0, 5).join('.')}`);
    }
    return out.concat(wells.map((w) => `EMPTY-WELL ${w}`));
  });
  total += hits.length;
  if (hits.length) console.log(`${route} | ${hits.length} | ${hits.slice(0, 4).join(' | ')}`);
}
console.log(`\n=== TOTAL hidden texts + empty wells: ${total} over ${routes.length} routes`);
await b.close();
