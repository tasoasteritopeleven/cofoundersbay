// Card type census: how many ways text is set inside each card, measured.
//   node .probes/card_type.mjs <routes.txt> [width=390] [out.json]
// Env: BASE (default http://localhost:3000), ROLE (demo role cookie, default
// existing_founder), STATE=stub (sample data off), LANG_PREF (default en).
//
// Per card ([data-card], visible, at least 60x30), text outside controls:
//   styles   distinct size x weight x colour combinations. Each one is a
//            level the eye has to rank; a calm card needs four or five
//            (title, body, secondary, caption, one accent).
//   sizes    distinct font sizes alone.
//   pills    rounded text badges that are not controls (a status earns one;
//            facts, kinds and counts set as pills read as buttons).
//   clipped  text cut by an ellipsis or a line clamp (a byline cut mid-word).
//   flatPairs  a muted label whose size is within 1px of the value under it:
//            hierarchy by colour alone, which reads as one grey wall on a phone.
// Per route: the cards, their mean and worst style counts, cards over five
// styles, and the totals. Measurement, not proof: one role, one width,
// one language, demo data unless STATE=stub.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const W = Number(process.argv[3] ?? 390);
const OUT = process.argv[4];
const BASE = process.env.BASE ?? 'http://localhost:3000';
const LANG = process.env.LANG_PREF ?? 'en';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: process.env.STATE === 'stub' ? 'e2e' : 'preview-demo', domain: 'localhost', path: '/' },
  ...(process.env.STATE === 'stub' ? [] : [{ name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' }]),
  { name: 'cfb_primary_role', value: process.env.ROLE ?? 'existing_founder', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(({ stub, lang }) => {
  try {
    localStorage.setItem('user', JSON.stringify({ id: stub ? 'u_1' : 'preview-demo-user', email: 'probe@cofounderbay.test', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', stub ? '0' : '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('cfb.dashboard.founder.full', '1');
    localStorage.setItem('cfb:primary-language', lang);
    localStorage.setItem('cfb_locale', lang);
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
  } catch { /* ignore */ }
}, { stub: process.env.STATE === 'stub', lang: LANG });

const page = await ctx.newPage();
const rows = [];
for (const route of routes) {
  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
    status = res?.status() ?? 0;
  } catch { /* measured as is */ }
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const main = document.querySelector('main#main-content') ?? document.querySelector('main, [role="main"]') ?? document.body;
    const shown = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
    const rectOk = (el, w = 1, h = 1) => { const r = el.getBoundingClientRect(); return r.width >= w && r.height >= h; };
    const CONTROL = 'button,a,input,select,textarea,label,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],[role=menuitem],[contenteditable=true]';
    const FLOAT = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[data-radix-popper-content-wrapper],[data-sonner-toaster],[data-rail-surface]';
    const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
    const label = (el) => {
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${(el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 36)}"`;
    };
    // Cards that hold other cards are judged by their innermost cards.
    const cards = [...main.querySelectorAll('[data-card]')].filter((c) => shown(c) && rectOk(c, 60, 30) && !c.closest(FLOAT) && !c.querySelector('[data-card]'));
    const out = [];
    for (const card of cards) {
      // An avatar's initials are a mark: a round box that clips its text.
      const inAvatar = (el) => [el, el.parentElement, el.parentElement?.parentElement].some((n) => {
        if (!n || n === card) return false;
        const q = n.getBoundingClientRect();
        return Math.abs(q.width - q.height) < 2 && q.width <= 64 && getComputedStyle(n).overflow === 'hidden';
      });
      const leaves = [...card.querySelectorAll('*')].filter((el) => ownText(el) && shown(el) && rectOk(el, 2, 2) && !el.closest(CONTROL) && !el.closest('.sr-only,[aria-hidden="true"],[data-keep-icon],svg') && !inAvatar(el));
      const styles = new Set();
      const sizes = new Set();
      for (const el of leaves) {
        const cs = getComputedStyle(el);
        const size = Math.round(parseFloat(cs.fontSize) * 2) / 2;
        const weight = Number(cs.fontWeight) >= 600 ? 'b' : Number(cs.fontWeight) >= 500 ? 'm' : 'n';
        styles.add(`${size}|${weight}|${cs.color}`);
        sizes.add(size);
      }
      const pills = [];
      for (const el of card.querySelectorAll('*')) {
        if (!shown(el) || el.closest(CONTROL) || !(el.innerText ?? '').trim() || el.children.length > 3) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.height < 12 || r.height > 40 || r.width > 260) continue;
        // An avatar (a round box whose text is initials) is a mark, not a pill.
        const square = (n) => { if (!n) return false; const q = n.getBoundingClientRect(); return Math.abs(q.width - q.height) < 2 && getComputedStyle(n).overflow === 'hidden'; };
        if (el.closest('[data-keep-icon]') || square(el) || square(el.parentElement)) continue;
        const radius = parseFloat(cs.borderTopLeftRadius) || 0;
        const filled = alpha(cs.backgroundColor) > 0.02 || parseFloat(cs.borderTopWidth) > 0;
        if (filled && radius >= r.height / 2 - 1 && !el.parentElement?.closest('[data-pill-counted]')) {
          el.setAttribute('data-pill-counted', '');
          pills.push(label(el));
        }
      }
      card.querySelectorAll('[data-pill-counted]').forEach((el) => el.removeAttribute('data-pill-counted'));
      const clipped = leaves.concat([...card.querySelectorAll('*')].filter((el) => shown(el) && !el.closest(CONTROL)))
        .filter((el, i, a) => a.indexOf(el) === i)
        .filter((el) => {
          const cs = getComputedStyle(el);
          const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
          return ((cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (clamp && el.scrollHeight > el.clientHeight + 1)) && (el.innerText ?? '').trim();
        })
        .map(label);
      // A muted label followed by its value at nearly the same size.
      const flatPairs = [];
      for (const el of card.querySelectorAll('dt, p, span, div')) {
        if (!shown(el) || el.closest(CONTROL) || !ownText(el) && el.children.length !== 1) continue;
        const next = el.nextElementSibling;
        if (!next || !shown(next) || !(el.innerText ?? '').trim() || !(next.innerText ?? '').trim()) continue;
        const a = getComputedStyle(el); const v = getComputedStyle(next);
        const labelish = (el.innerText ?? '').trim().length <= 32 && !/[.!?]$/.test((el.innerText ?? '').trim());
        const muted = a.color !== v.color;
        if (labelish && muted && Math.abs(parseFloat(a.fontSize) - parseFloat(v.fontSize)) <= 1 && (next.innerText ?? '').trim().length > 24 && el.getBoundingClientRect().bottom <= next.getBoundingClientRect().top + 2) {
          flatPairs.push(label(el));
        }
      }
      out.push({ card: label(card).slice(0, 60), styles: styles.size, sizes: sizes.size, pills, clipped, flatPairs });
    }
    return out;
  });
  const n = m.length;
  const mean = n ? m.reduce((s, c) => s + c.styles, 0) / n : 0;
  const worst = m.reduce((a, c) => Math.max(a, c.styles), 0);
  const over5 = m.filter((c) => c.styles > 5).length;
  const pills = m.reduce((s, c) => s + c.pills.length, 0);
  const clipped = m.reduce((s, c) => s + c.clipped.length, 0);
  const flat = m.reduce((s, c) => s + c.flatPairs.length, 0);
  const row = { route, status, cards: n, mean: Number(mean.toFixed(2)), worst, over5, pills, clipped, flat, detail: m };
  rows.push(row);
  console.log(`${route} | ${status} | cards ${n} | styles mean ${row.mean} worst ${worst} | >5 ${over5} | pills ${pills} | clipped ${clipped} | flat ${flat}`);
}
const cards = rows.reduce((s, r) => s + r.cards, 0);
const allCards = rows.flatMap((r) => r.detail);
console.log('\n=== TOTALS ===');
console.log(`routes ${rows.length} | cards ${cards} | styles mean ${(allCards.reduce((s, c) => s + c.styles, 0) / Math.max(cards, 1)).toFixed(2)} | cards >5 styles ${allCards.filter((c) => c.styles > 5).length} | worst ${allCards.reduce((a, c) => Math.max(a, c.styles), 0)} | pills ${rows.reduce((s, r) => s + r.pills, 0)} | clipped ${rows.reduce((s, r) => s + r.clipped, 0)} | flat ${rows.reduce((s, r) => s + r.flat, 0)}`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
await b.close();
