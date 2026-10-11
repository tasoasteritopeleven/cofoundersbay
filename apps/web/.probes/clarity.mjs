// Clarity census: the visual noise a reader meets on each route, measured.
//   node .probes/clarity.mjs <routes.txt> [width=1440] [out.json]
// Env: BASE (default http://localhost:3000), ROLE (demo role cookie, default
// existing_founder), STATE=stub (sample data off: the client reads the API).
//
// Inside `main` only (the chrome is measured elsewhere), per route:
//   shadows   in-flow elements with a blurred shadow (elevation that floats nothing).
//             Fixed/sticky layers, dialogs, menus, popovers and toasts are skipped.
//   tints     tinted boxes nested in a card (a fill other than the card's, padded,
//             holding text): each one insets its text off the card's left axis.
//   frames    bordered boxes nested in a card (all four sides drawn), and cards in cards.
//   offAxis   text blocks in a card whose first letter starts 2-40px off the card
//             title's first letter with nothing (avatar, mark, checkbox, bullet)
//             in front of it in the same line: the left axis broken by markup alone.
//   centered  text blocks in a card set text-align:center.
//   glyphs    small icons still painted outside controls and [data-keep-icon]
//             (the decorative-icon CSS hides the rest).
//   dupes     a heading whose exact text is painted again elsewhere on the page.
//   words     visible words in main (density, not a defect).
// Measurement, not proof: one role, one width, demo data unless STATE=stub.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const W = Number(process.argv[3] ?? 1440);
const OUT = process.argv[4];
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
    localStorage.setItem('user', JSON.stringify({ id: stub ? 'u_1' : 'preview-demo-user', email: 'probe@cofounderbay.test', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', stub ? '0' : '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('cfb.dashboard.founder.full', '1');
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
  } catch { /* ignore */ }
}, process.env.STATE === 'stub');

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
    const tag = (el) => {
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 4).join('.') : '';
      const txt = (el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
    };
    const FLOAT = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[data-radix-popper-content-wrapper],[data-sonner-toaster],[data-rail-surface]';
    const CONTROL = 'button,a,input,select,textarea,label,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=progressbar],progress,[role=slider],[role=option]';
    const pinned = (el) => {
      for (let n = el; n && n !== main; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === 'fixed' || p === 'sticky') return true;
      }
      return false;
    };
    const alpha = (color) => {
      const m = color.match(/rgba?\(([^)]+)\)/);
      if (!m) return color === 'transparent' ? 0 : 1;
      const parts = m[1].split(/[ ,/]+/).filter(Boolean);
      return parts.length > 3 ? Number(parts[3]) : 1;
    };
    const all = [...main.querySelectorAll('*')];

    // Shadows: a blurred layer with a visible colour.
    const shadows = [];
    for (const el of all) {
      const bs = getComputedStyle(el).boxShadow;
      if (!bs || bs === 'none') continue;
      const layers = bs.split(/,(?![^(]*\))/);
      const blurred = layers.some((layer) => {
        const color = (layer.match(/rgba?\([^)]+\)|#[0-9a-f]+/i) ?? ['rgba(0,0,0,0)'])[0];
        const nums = layer.replace(/rgba?\([^)]+\)/, '').match(/-?[\d.]+px/g) ?? [];
        const blur = nums[2] ? parseFloat(nums[2]) : 0;
        return blur > 0 && alpha(color) > 0.01 && !/inset/.test(layer);
      });
      if (!blurred || el.closest(FLOAT) || pinned(el) || !shown(el) || !rectOk(el, 24, 16) || el === document.activeElement) continue;
      shadows.push(tag(el));
    }

    const cards = all.filter((el) => el.hasAttribute('data-card') && shown(el) && rectOk(el, 60, 30));
    const tints = [];
    const frames = [];
    const offAxis = [];
    const centered = [];
    const firstTextLeft = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      let node = walker.nextNode();
      // A mark's initials or an avatar's letter are the mark, not a line of text.
      while (node && (!shown(node.parentElement) || node.parentElement.closest('[data-keep-icon],[aria-hidden="true"]'))) node = walker.nextNode();
      if (!node) return null;
      const range = document.createRange();
      const start = node.textContent.search(/\S/);
      range.setStart(node, Math.max(start, 0));
      range.setEnd(node, Math.min(Math.max(start, 0) + 1, node.textContent.length));
      const r = range.getBoundingClientRect();
      return r.width || r.height ? r : null;
    };
    for (const card of cards) {
      const cardBg = getComputedStyle(card).backgroundColor;
      const inner = [...card.querySelectorAll('*')].filter((el) => shown(el));
      for (const el of inner) {
        if (el.matches(CONTROL) || el.closest(CONTROL)) continue;
        const cs = getComputedStyle(el);
        if (el.hasAttribute('data-card') && el !== card) { frames.push(tag(el)); continue; }
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 28) continue;
        const hasText = (el.innerText ?? '').trim().length > 0;
        if (!hasText) continue;
        const bg = cs.backgroundColor;
        if (alpha(bg) > 0.02 && bg !== cardBg && parseFloat(cs.paddingLeft) >= 6) tints.push(tag(el));
        const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => parseFloat(cs[`border${s}Width`]) > 0 && alpha(cs[`border${s}Color`]) > 0.02);
        if (sides.length === 4) frames.push(tag(el));
      }
      const heading = card.querySelector('h1,h2,h3,h4,.page-section');
      const head = heading && shown(heading) ? firstTextLeft(heading) : null;
      if (!head) continue;
      const blocks = inner.filter((el) => el.matches('p,li,dt,dd,h2,h3,h4,h5,blockquote,figcaption') && !el.closest('table,[role=tablist],[role=grid],pre,code,' + CONTROL));
      for (const el of blocks) {
        const cs = getComputedStyle(el);
        if (cs.textAlign === 'center') { centered.push(tag(el)); continue; }
        if (el.tagName === 'LI' && cs.listStyleType !== 'none') continue;
        const text = firstTextLeft(el);
        if (!text) continue;
        // A pill (chip, badge) stands on the axis by its edge, not its letters.
        const isPill = (n) => n && n.matches('.chip,.badge,[class*="rounded-full"]') && (alpha(getComputedStyle(n).backgroundColor) > 0.02 || parseFloat(getComputedStyle(n).borderLeftWidth) > 0);
        let pillEl = isPill(el) ? el : null;
        if (!pillEl) {
          const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) }).nextNode();
          for (let n = node?.parentElement; n && n !== el; n = n.parentElement) if (isPill(n)) { pillEl = n; break; }
        }
        const first = pillEl ? pillEl.getBoundingClientRect() : text;
        const off = Math.round(first.left - head.left);
        if (Math.abs(off) < 2 || Math.abs(off) > 40) continue;
        // Anything painted in front of the text on its line (an avatar, a
        // mark, a bullet, a chip, a column) makes it a continuation of that
        // line, not a line of its own: only a line's first block has an axis.
        const led = inner.some((other) => {
          // The block's own leading mark (a check, a bullet glyph) counts too: it sits
          // inside the item, wholly left of the first letter.
          if (other === el || other.contains(el)) return false;
          if (!other.matches('img,svg,canvas,video,input,button,span,a,[role],[data-keep-icon],div,p,li') || !rectOk(other, 4, 4)) return false;
          const r = other.getBoundingClientRect();
          return r.right <= first.left + 1 && r.right > Math.min(head.left, first.left) + 1 && r.bottom > first.top + 2 && r.top < first.bottom - 2;
        });
        if (!led) offAxis.push(`${off > 0 ? '+' : ''}${off}px ${tag(el)}`);
      }
    }

    // Glyphs: small icons still painted outside controls.
    const glyphs = [];
    for (const svg of main.querySelectorAll('svg')) {
      if (svg.closest(CONTROL) || svg.closest('[data-keep-icon]') || svg.closest('.recharts-wrapper,[data-chart]')) continue;
      // State glyphs say something (done, empty, locked, working); they stay by design.
      if (/\blucide-(check|circle-check|circle-check-big|check-circle|check-circle-2|circle|lock|loader-2|loader-circle|x|star|star-half|trending-up|trending-down|triangle-alert|alert-triangle|circle-alert|alert-circle|info)\b/.test(svg.getAttribute('class') ?? '')) continue;
      // An icon placed inside a field (the search magnifier) is part of the field.
      if (/(^|\s)absolute(\s|$)/.test(svg.getAttribute('class') ?? '')) continue;
      const r = svg.getBoundingClientRect();
      if (r.width < 6 || r.width > 32 || !shown(svg)) continue;
      glyphs.push(tag(svg.parentElement ?? svg));
    }

    // Duplicates: a heading's exact text painted again elsewhere.
    const norm = (s) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    const heads = [...main.querySelectorAll('h1,h2,h3')].filter(shown).map((h) => ({ h, t: norm(h.innerText) })).filter((x) => x.t.length >= 6);
    const leaves = all.filter((el) => el.children.length === 0 && shown(el));
    const dupes = [];
    for (const { h, t } of heads) {
      const again = leaves.filter((el) => !h.contains(el) && !el.contains(h) && norm(el.innerText) === t && rectOk(el, 2, 2) && !el.closest('.sr-only, h1,h2,h3,' + CONTROL));
      if (again.length) dupes.push(`"${t.slice(0, 40)}" x${again.length + 1}`);
    }
    // Echoes: a heading whose next line says the same thing again ("Billing"
    // over "Manage your billing"). English halves only, so the two languages
    // of one line are not compared with each other.
    const STOP = new Set(['the','a','an','and','or','of','to','your','you','for','in','on','with','manage','view','see','all','here','this','is','are','be','by','from','at','as','it','its','our']);
    const wordsOf = (t) => (t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
    const enOf = (el) => (el.querySelector('[lang="en"]')?.textContent ?? el.textContent ?? '');
    const echoes = [];
    for (const h of [...main.querySelectorAll('h1,h2,h3,h4')].filter(shown)) {
      const next = h.nextElementSibling ?? h.parentElement?.nextElementSibling;
      if (!next || !next.matches('p') || !shown(next)) continue;
      const hw = new Set(wordsOf(enOf(h)));
      const nw = wordsOf(enOf(next));
      if (hw.size < 1 || nw.length < 1 || nw.length > 8) continue;
      const shared = nw.filter((w) => hw.has(w) || hw.has(w.replace(/s$/, '')) || hw.has(w + 's')).length;
      if (shared / nw.length >= 0.5) echoes.push(`"${enOf(h).trim().slice(0, 30)}" / "${enOf(next).trim().slice(0, 50)}"`);
    }
    const words = (main.innerText ?? '').split(/\s+/).filter(Boolean).length;
    // The skip link's target: one main#main-content per page. The research
    // canvas is the documented exception: its own named role="main", because
    // #main-content's global CSS would change the canvas.
    const landmark = document.querySelectorAll('main#main-content').length === 1
      || (document.querySelectorAll('main#main-content').length === 0 && document.querySelectorAll('[role="main"][aria-label]').length === 1);
    return { cards: cards.length, shadows, tints, frames, offAxis, centered, glyphs, dupes, echoes, words, landmark };
  });
  const row = { route, status, ...m };
  rows.push(row);
  console.log(`${route} | ${status} | ${m.landmark ? '' : 'NO-MAIN | '}cards ${m.cards} | shadows ${m.shadows.length} | tints ${m.tints.length} | frames ${m.frames.length} | offAxis ${m.offAxis.length} | centered ${m.centered.length} | glyphs ${m.glyphs.length} | dupes ${m.dupes.length} | echoes ${m.echoes.length} | words ${m.words}`);
}
const sum = (k) => rows.reduce((n, r) => n + (Array.isArray(r[k]) ? r[k].length : 0), 0);
console.log('\n=== TOTALS ===');
console.log(`routes ${rows.length} | without main#main-content ${rows.filter((r) => !r.landmark).length} | cards ${rows.reduce((n, r) => n + (r.cards ?? 0), 0)} | shadows ${sum('shadows')} | tints ${sum('tints')} | frames ${sum('frames')} | offAxis ${sum('offAxis')} | centered ${sum('centered')} | glyphs ${sum('glyphs')} | dupes ${sum('dupes')} | echoes ${sum('echoes')} | words ${rows.reduce((n, r) => n + (r.words ?? 0), 0)}`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
await b.close();
