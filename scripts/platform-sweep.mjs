/**
 * Platform sweep, one row per route. Measures the things the coherence audit
 * asks about and that no unit test can see: does the page render, does it throw,
 * does it scroll sideways, do all its controls have names, does it speak Greek,
 * does it have an AI seam, does it admit to sample data, how much of it is a
 * dead band inside a card, and does any icon-only control paint nothing.
 *
 * Greek share is "n/a" below 640px: BilingualText shows only the reader's
 * language on phones (unless `keepSecondaryOnMobile`), so a 0 there is the
 * design, not an English-only page.
 *
 * Run from the repo root against a running dev server (it signs in as a
 * platform_admin in demo mode, so every role surface renders; set ROLE=mentor,
 * angel_investor, service_provider, existing_founder ... to sweep as that role):
 *
 *   node scripts/platform-sweep.mjs [routes.txt] [viewportWidth=1440]
 *
 * The default route list is `platform-sweep-routes.txt` beside this file — the
 * static (non-dynamic) `page.tsx` routes. Regenerate it when routes change:
 *
 *   find apps/web/src/app -name page.tsx | grep -v '/api/' | grep -v '\[' \
 *     | sed 's|apps/web/src/app||;s|/page.tsx||;s|^$|/|;s|/(auth)||' | sort
 *
 * Like `platform-inventory.cjs`, this is measurement, not proof: a route that
 * passes here has rendered without throwing at one width for one role. The
 * numbers in docs/PLATFORM_DESIGN_AI_PLAN.md §21.3 come from this script.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is a dependency of apps/web, not the root, so resolve it from
// there — otherwise this only runs when invoked from inside apps/web.
const requireFromWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const BASE = process.env.SWEEP_BASE ?? 'http://localhost:3000'; // e.g. http://localhost:8787 for `pnpm cf:preview` (workerd)
const routes = readFileSync(process.argv[2] ?? new URL('./platform-sweep-routes.txt', import.meta.url), 'utf8').split(/\r?\n/).filter(Boolean);
const W = Number(process.argv[3] ?? 1440);
const SINGLE_LANGUAGE = W < 640;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: process.env.ROLE ?? 'platform_admin', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
const page = await ctx.newPage();
const rows = [];
console.log('route | status | errors | xScroll | unnamed | greek% | askAI | sampleNotice | deadBands | blankIcons | words');
for (const route of routes) {
  const errors = [];
  const onErr = (e) => errors.push(e.message.slice(0, 80));
  page.on('pageerror', onErr);
  let status = 0;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    status = resp?.status() ?? 0;
    await page.waitForTimeout(900);
  } catch (e) { errors.push('NAV:' + e.message.slice(0, 60)); }
  page.off('pageerror', onErr);
  const r = await page.evaluate(() => {
    const main = document.querySelector('#main-content') || document.querySelector('main') || document.body;
    const txt = main.innerText || '';
    const greek = (txt.match(/[\u0370-\u03FF]/g) || []).length;
    const latin = (txt.match(/[A-Za-z]/g) || []).length;
    const words = txt.split(/\s+/).filter(Boolean).length;
    const unnamed = [...main.querySelectorAll('button,a[href],[role=button]')].filter((el) => {
      const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false;
      const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent || '').trim();
      return !name || /^\d+$/.test(name);
    }).length;
    const askAI = !!main.querySelector('[aria-label*="Ask AI" i],[aria-label*="Ρωτήστε" i],a[href^="/ai"],button[data-ask-ai]') || /Ask AI|Ρωτήστε το AI/.test(txt);
    const sample = /sample|δείγμα|επίδειξη|illustrative|demo data|ενδεικτικ/i.test(txt);
    // Dead bands: a card whose last painted child ends >60px above the card's bottom padding edge.
    // A form field paints its own box without text, so it is neither a card nor empty space.
    const FIELD = /^(TEXTAREA|INPUT|SELECT)$/;
    let dead = 0;
    for (const card of main.querySelectorAll('[class*="rounded-xl"][class*="border"], [class*="rounded-2xl"][class*="border"]')) {
      if (FIELD.test(card.tagName)) continue;
      const cr = card.getBoundingClientRect(); if (cr.height < 120) continue;
      let maxBottom = cr.top;
      for (const el of card.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.width > 0 && (el.textContent?.trim() || FIELD.test(el.tagName) || el.tagName === 'svg' || el.tagName === 'IMG' || el.tagName === 'CANVAS')) maxBottom = Math.max(maxBottom, r.bottom); }
      const pad = parseFloat(getComputedStyle(card).paddingBottom) || 0;
      if (cr.bottom - pad - maxBottom > 60) dead++;
    }
    // Blank icon controls: a button or link with no visible text whose every
    // icon is hidden - what the decorative-icon CSS does when it misreads an
    // sr-only name as a label. Checked on the whole document (chrome too).
    const shown = (n) => { const c = getComputedStyle(n); return c.display !== 'none' && c.visibility !== 'hidden'; };
    const visibleText = (el) => {
      let t = '';
      const walk = (n) => {
        if (n.nodeType === 3) { t += n.textContent; return; }
        if (n.nodeType !== 1 || !shown(n) || n.classList.contains('sr-only')) return;
        for (const c of n.childNodes) walk(c);
      };
      walk(el);
      return t.trim();
    };
    let blankIcons = 0;
    for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
      const b = el.getBoundingClientRect();
      if (b.width < 4 || b.height < 4 || !shown(el) || getComputedStyle(el).opacity === '0' || visibleText(el)) continue;
      const icons = [...el.querySelectorAll('svg, img')];
      if (icons.length && !icons.some((i) => shown(i) && i.getBoundingClientRect().width > 0)) blankIcons++;
    }
    const de = document.documentElement;
    return { greekPct: latin + greek ? Math.round((greek / (latin + greek)) * 100) : 0, words, unnamed, askAI, sample, dead, blankIcons, xScroll: de.scrollWidth - de.clientWidth };
  }).catch(() => ({ greekPct: -1, words: 0, unnamed: -1, askAI: false, sample: false, dead: -1, blankIcons: -1, xScroll: -1 }));
  const row = { route, status, errors: errors.length, ...r, err0: errors[0] || '' };
  rows.push(row);
  console.log(`${route} | ${status} | ${errors.length} | ${r.xScroll} | ${r.unnamed} | ${SINGLE_LANGUAGE ? 'n/a' : r.greekPct} | ${r.askAI ? 'y' : 'n'} | ${r.sample ? 'y' : 'n'} | ${r.dead} | ${r.blankIcons} | ${r.words}${errors[0] ? ' | ' + errors[0] : ''}`);
}
await browser.close();
console.log('\n=== SUMMARY ===');
console.log('routes', rows.length);
console.log('non-200', rows.filter((r) => r.status !== 200).map((r) => `${r.route}:${r.status}`).join(' '));
console.log('with errors', rows.filter((r) => r.errors).length, rows.filter((r) => r.errors).map((r) => r.route).join(' '));
console.log('xScroll', rows.filter((r) => r.xScroll > 0).map((r) => `${r.route}:${r.xScroll}`).join(' '));
console.log('unnamed>0', rows.filter((r) => r.unnamed > 0).length, rows.filter((r) => r.unnamed > 0).map((r) => `${r.route}:${r.unnamed}`).join(' '));
if (SINGLE_LANGUAGE) console.log(`greek<15% (english-only) n/a below 640px: one language is shown by design`);
else console.log('greek<15% (english-only)', rows.filter((r) => r.greekPct >= 0 && r.greekPct < 15 && r.words > 30).length, rows.filter((r) => r.greekPct >= 0 && r.greekPct < 15 && r.words > 30).map((r) => `${r.route}:${r.greekPct}`).join(' '));
console.log('no askAI', rows.filter((r) => !r.askAI && r.status === 200).length);
console.log('deadBands>0', rows.filter((r) => r.dead > 0).map((r) => `${r.route}:${r.dead}`).join(' '));
console.log('blankIcons>0', rows.filter((r) => r.blankIcons > 0).length, rows.filter((r) => r.blankIcons > 0).map((r) => `${r.route}:${r.blankIcons}`).join(' '));
