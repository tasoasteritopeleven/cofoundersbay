// Card anatomy audit: does every card read like the Endorsements and
// Connections cards? Measured in a real browser, per innermost [data-card].
//   node .probes/card_audit.mjs <routes.txt> [width=390] [out.json]
// Env: BASE (default http://localhost:3000), ROLE (demo role cookie, default
// existing_founder), STATE=stub (sample data off), LANG_PREF (default en).
//
// Per card:
//   offAxis     a line that starts the card's text (nothing in front of it on
//               the same line) but sits neither on the title's left edge nor
//               on the avatar's: the "tab" under a title, a flattened badge
//               that kept its padding.
//   overTitle   text not at least 0.3px under the card's own title (stat
//               cards, whose only content is figures and their labels, are
//               exempt).
//   bodyLoud    a sentence under the header that is not at least 0.3px under
//               the title's subtitle (the thesis that read as loud as the byline).
//   tight       wrapped text whose line-height is under 1.35 x its size.
//   lower       a block of content that starts with a lowercase letter.
//   escape      text that leaves the card's box on the left or the top.
//   overlap     text drawn over the avatar.
//   centered    centred text in a card that is not a stat card.
//   loneRight   a right-aligned line with nothing to its left.
// Anatomy (the Endorsements/Connections card, measured 2026-10-10: 16px
// inset on a phone and 24px from 640px, a 2.5rem mark, title 15.343/16.32,
// the line under it no louder than 14.906/14.28):
//   titleStep   the card's head title is off the card-title step by >0.4px
//               (a display title, an h1 or a stat figure is exempt).
//   subStep     the line under the title is louder than the subtitle step.
//   markSize    the mark beside the title is not 2.5rem (a hero cover's
//               avatar, 3rem and up beside an h1, is exempt).
//   inset       the card's left axis sits more than 4px off its padding
//               (12px compact rows and 16-24px cards pass).
//   tile        a framed box inside the card that holds a person (an
//               avatar and a name): a card drawn inside a card.
// Per page:
//   fields      a field whose text (value or placeholder) is not smaller than
//               its label; an unlabelled field is judged against the body step.
// Measurement, not proof: one role, one width, one language, demo data
// unless STATE=stub.
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

const KINDS = ['offAxis', 'overTitle', 'bodyLoud', 'tight', 'lower', 'escape', 'overlap', 'centered', 'loneRight', 'titleStep', 'subStep', 'markSize', 'inset', 'tile'];
const page = await ctx.newPage();
const rows = [];
for (const route of routes) {
  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
    status = res?.status() ?? 0;
  } catch { /* measured as is */ }
  await page.waitForTimeout(700);
  // A page that navigates on its own after load (a redirect, a guard)
  // destroys the context mid-measure: settle and measure once more.
  const measure = () => page.evaluate((W) => {
    const main = document.querySelector('main#main-content') ?? document.querySelector('main, [role="main"]') ?? document.body;
    const shown = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
    const FLOAT = '[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[data-radix-popper-content-wrapper],[data-sonner-toaster],[data-rail-surface]';
    const CONTROL = 'button,input,select,textarea,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],[role=menuitem],[role=slider],[contenteditable=true]';
    const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
    const label = (el) => {
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${(el.innerText ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
    };
    // The first glyph of an element's own text, measured on the text itself
    // (a padded badge starts its letters after its padding).
    const firstTextNode = (el) => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      let n = w.nextNode();
      while (n && (!shown(n.parentElement) || n.parentElement.closest('.sr-only,[aria-hidden="true"]'))) n = w.nextNode();
      return n;
    };
    const glyphRect = (el) => {
      const n = firstTextNode(el);
      if (!n) return null;
      const r = document.createRange();
      const t = n.textContent; const i = t.search(/\S/);
      r.setStart(n, i); r.setEnd(n, Math.min(i + 1, t.length));
      const rr = r.getClientRects()[0];
      return rr && rr.width > 0 ? rr : null;
    };
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
    const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const isAvatarBox = (n) => {
      if (n.tagName.toLowerCase() === 'svg' || n.closest('svg')) return false;
      const q = n.getBoundingClientRect();
      if (q.width < 20 || q.width > 112 || Math.abs(q.width - q.height) > 2) return false;
      const cs = getComputedStyle(n);
      return cs.overflow === 'hidden' || n.matches('[data-slot=avatar],img') || parseFloat(cs.borderTopLeftRadius) >= q.width * 0.2;
    };
    const STATIC_FIG = /^[\s\d.,/%$€£+\-–−↑↓×xKkMmBb:]+$/;
    // A card is a [data-card], or any framed box (hairline on every side,
    // rounded, at least 160x60) that is not a control: articles and list
    // boxes that never adopted <Card> are judged too, marked "framed".
    const framed = (el) => {
      if (el.matches(CONTROL + ',a,label,ul,ol,table,form,fieldset,[role=tablist],[role=group],[data-slot=avatar],[data-rail-surface]')) return false;
      // A framed table (a comparison grid) is a table, not a card.
      if (el.querySelector('table')) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 160 || r.height < 60) return false;
      const sides = ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs[`border${s}Width`]) >= 0.5 && cs[`border${s}Style`] !== 'none');
      return sides && parseFloat(cs.borderTopLeftRadius) >= 8;
    };
    // Cards that hold other cards are judged by their innermost cards; a
    // framed box inside a card (a callout, a figure tile) is part of it.
    const dataCards = [...main.querySelectorAll('[data-card]')].filter((c) => !c.querySelector('[data-card]'));
    const framedCards = [...main.querySelectorAll('div,article,section,li,aside')]
      .filter((el) => !el.hasAttribute('data-card') && !el.closest('[data-card]') && !el.querySelector('[data-card]') && framed(el))
      .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
    const cards = [...dataCards, ...framedCards].filter((c) => shown(c) && c.getBoundingClientRect().width >= 60 && c.getBoundingClientRect().height >= 30 && !c.closest(FLOAT));
    const out = [];
    for (const card of cards) {
      const cr = card.getBoundingClientRect();
      // A control inside the card (a whole card that is a button is judged as a card).
      const inCtl = (el, sel = CONTROL) => { const c = el.closest(sel); return Boolean(c && c !== card && card.contains(c)); };
      const ccs = getComputedStyle(card);
      const inner = { left: cr.left + parseFloat(ccs.borderLeftWidth), top: cr.top + parseFloat(ccs.borderTopWidth), right: cr.right - parseFloat(ccs.borderRightWidth) };
      const leaves = [...card.querySelectorAll('*')].filter((el) => ownText(el) && shown(el) && !el.closest('.sr-only,[aria-hidden="true"],svg,[data-keep-icon] [data-slot=avatar-fallback]'))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width >= 2 && r.height >= 2; });
      // Avatars and icon wells: square marks at the card's top.
      // A mark is an avatar-like square, or anything a card names as its
      // mark (a date tile).
      const marks = [...card.querySelectorAll('*')].filter((el) => shown(el) && (el.hasAttribute('data-card-mark') || (isAvatarBox(el) && !el.closest('[data-card-mark]'))) && !inCtl(el) && !(el.parentElement && isAvatarBox(el.parentElement) && el.parentElement !== card));
      // The card's own mark sits beside its first line of text (a cover band
      // can push both well down the card).
      const firstTop = Math.min(...leaves.filter((el) => !marks.some((mk) => mk.contains(el))).map((el) => el.getBoundingClientRect().top), Infinity);
      let avatar = marks.filter((el) => { const t = el.getBoundingClientRect().top; return t - cr.top < 80 || Math.abs(t - firstTop) < 60; }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0] ?? null;
      let ar = avatar?.getBoundingClientRect();
      const inMark = (el) => marks.some((mk) => mk.contains(el));
      const text = leaves.filter((el) => !inMark(el));
      // Stat card: figures and short labels only.
      const words = (card.innerText ?? '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).length;
      const figures = text.filter((el) => STATIC_FIG.test(el.textContent.trim()) && /\d/.test(el.textContent));
      // A card can name itself a chart card (two marks and a donut): centred
      // by design, like a stat card.
      const stat = (figures.length > 0 && words <= 14) || card.hasAttribute('data-card-chart') || Boolean(card.querySelector('.page-stat,.founder-dash-stat'));
      // Title: the first heading, person name, or semibold leaf outside controls.
      const titleEl = text.find((el) => el.matches('h1,h2,h3,h4,h5,[role=heading],.person-name') || (el.closest('h1,h2,h3,h4,h5,[role=heading]') && !inCtl(el)))
        ?? text.find((el) => Number(getComputedStyle(el).fontWeight) >= 600 && fs(el) >= 14 && !inCtl(el) && !STATIC_FIG.test(el.textContent.trim()));
      // A bilingual title's Greek line belongs to the title, not under it.
      const titleBlock = titleEl?.closest('h1,h2,h3,h4,h5,[role=heading]')
        ?? (titleEl?.parentElement?.querySelector(':scope > .bilingual-secondary') ? titleEl.parentElement : titleEl);
      const tg = titleEl ? glyphRect(titleEl) : null;
      const tSize = titleEl ? fs(titleEl) : null;
      // The card's mark is the one beside its title, wherever a cover band
      // put the two.
      const beside = tg ? marks.filter((mk) => { const r = mk.getBoundingClientRect(); return r.right <= tg.left + 1 && r.top < tg.bottom + 8 && r.bottom > tg.top - 8; })
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0] : null;
      if (beside) { avatar = beside; ar = beside.getBoundingClientRect(); }
      const axes = [tg?.left, ar?.left].filter((x) => typeof x === 'number');
      const issues = Object.fromEntries(['offAxis', 'overTitle', 'bodyLoud', 'tight', 'lower', 'escape', 'overlap', 'centered', 'loneRight', 'titleStep', 'subStep', 'markSize', 'inset', 'tile'].map((k) => [k, []]));
      // Things that can sit in front of a text on its line.
      const blockers = [...card.querySelectorAll('svg,img,input,button,a,[role=button],[role=progressbar],progress,[data-slot=avatar],[data-keep-icon]')].filter(shown).map((el) => el.getBoundingClientRect()).concat(marks.map((mk) => mk.getBoundingClientRect()));
      // A filled or framed control is placed by its box; a ghost control's
      // letters are what the eye lines up.
      const boxed = (ctl) => { const cs = getComputedStyle(ctl); return alpha(cs.backgroundColor) > 0.02 || parseFloat(cs.borderLeftWidth) > 0; };
      // A filled pill (a state) is an object too: its box is what aligns.
      // A transparent badge is text, and its letters must sit on the axis.
      const pillOf = (el) => {
        for (let n = el; n && n !== card; n = n.parentElement) {
          const r = n.getBoundingClientRect();
          if (r.height > 40 || r.width > 320) return null;
          const cs = getComputedStyle(n);
          if ((alpha(cs.backgroundColor) > 0.02 || parseFloat(cs.borderLeftWidth) > 0) && parseFloat(cs.borderTopLeftRadius) >= 4) return n;
        }
        return null;
      };
      const placeRect = (el) => {
        const ctl = el.closest(CONTROL + ',a[data-slot=button],a.inline-flex');
        if (ctl && ctl !== card && card.contains(ctl) && boxed(ctl)) return ctl.getBoundingClientRect();
        const pill = pillOf(el);
        if (pill) return pill.getBoundingClientRect();
        return glyphRect(el);
      };
      // A glyph its own overflow box clips away (the second half of a
      // one-line bilingual pair that did not fit) is not on screen.
      const clippedAway = (el, g) => {
        for (let n = el.parentElement; n && n !== card.parentElement; n = n.parentElement) {
          const o = getComputedStyle(n);
          if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
          const r = n.getBoundingClientRect();
          if (g.top >= r.bottom - 1 || g.bottom <= r.top + 1 || g.left >= r.right - 1 || g.right <= r.left + 1) return true;
        }
        return false;
      };
      const glyphs = text.map((el) => ({ el, g: placeRect(el) })).filter((x) => x.g && !clippedAway(x.el, x.g));
      const boxOf = (el) => {
        for (let n = el.parentElement; n && n !== card; n = n.parentElement) {
          const r = n.getBoundingClientRect();
          if (r.width < 120 || r.height <= 40 || n.matches(CONTROL)) continue;
          const cs = getComputedStyle(n);
          const tinted = alpha(cs.backgroundColor) > 0.02 && cs.backgroundColor !== getComputedStyle(card).backgroundColor;
          const framedBox = ['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(cs[`border${side}Width`]) >= 0.5);
          if ((tinted || framedBox) && parseFloat(cs.borderTopLeftRadius) >= 6) return n;
        }
        return null;
      };
      // A checkbox, radio or switch row: its description lines up with the
      // label beside the control, not with the control.
      const toggles = [...card.querySelectorAll('input[type=checkbox],input[type=radio],[role=checkbox],[role=radio],[role=switch],button[role=switch]')].filter(shown).map((t) => t.getBoundingClientRect());
      // A dot or a small glyph in front of a row's first line makes the
      // row's text column an axis too (a hanging indent, like a bullet).
      const dots = [...card.querySelectorAll('span,i,div,svg')].filter((d) => {
        if (!shown(d) || (d.textContent ?? '').trim()) return false;
        const r = d.getBoundingClientRect();
        return r.width > 2 && r.width <= 24 && r.height > 2 && r.height <= 24;
      }).map((d) => d.getBoundingClientRect());
      // A row's own mark (an avatar or an icon well) does the same: its text
      // column is that row's title axis, as on the Connections card.
      const markRects = marks.map((mk) => mk.getBoundingClientRect());
      const labelAxes = glyphs.filter(({ g }) => toggles.concat(dots, markRects).some((t) => t.right <= g.left + 0.5 && g.left - t.right < 20 && t.top < g.bottom && t.bottom > g.top)).map(({ g }) => g.left);
      const lines = (el) => {
        const tops = new Set();
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const q of r.getClientRects()) if (q.width > 1) tops.add(Math.round(q.top));
        }
        return tops.size;
      };
      for (const { el, g } of glyphs) {
        const line = { top: g.top + 1, bottom: g.bottom - 1 };
        const before = (r) => r.right <= g.left + 0.5 && r.top < line.bottom && r.bottom > line.top && r.width > 0;
        // An inline run that follows text in its own paragraph continues a
        // line ("question text *"), wherever the wrap put it.
        const inlineAfterText = getComputedStyle(el).display === 'inline' && (() => {
          for (let n = el.previousSibling; n; n = n.previousSibling) if ((n.textContent ?? '').trim()) return true;
          return false;
        })();
        // A bulleted item's marker stands in front of its first line.
        const li = el.closest('li');
        const bulleted = li && card.contains(li) && getComputedStyle(li).listStyleType !== 'none' && (() => { const g0 = glyphRect(li); return g0 && Math.abs(g0.top - g.top) < 2; })();
        const hasFront = inlineAfterText || bulleted || glyphs.some((o) => o.el !== el && before(o.g)) || blockers.some((r) => before(r) && r.left >= cr.left - 1);
        const cs = getComputedStyle(el);
        const block = el.closest('p,li,dd,dt,h1,h2,h3,h4,h5,blockquote,div') ?? el;
        const align = getComputedStyle(block).textAlign;
        // escape: glyphs left of / above the card box
        if (g.left < inner.left + 2 || g.top < inner.top - 1) issues.escape.push(label(el));
        if (ar && avatar && !avatar.contains(el) && g.left < ar.right - 1 && g.right > ar.left + 1 && g.top < ar.bottom - 1 && g.bottom > ar.top + 1) issues.overlap.push(label(el));
        if (!stat && align === 'center' && !inCtl(el) && !el.closest('[data-chart],svg,.recharts-wrapper') && (el.textContent ?? '').trim().length > 2) issues.centered.push(label(el));
        if (!stat && !hasFront && axes.length && !el.closest('[role=tablist],table,[data-chart],svg,.recharts-wrapper')) {
          // Inside a callout (a tinted or framed box within the card: a danger
          // zone, a chat bubble, a preview) the box's own padding is the axis.
          const box = boxOf(el);
          const local = box ? [box.getBoundingClientRect().left + parseFloat(getComputedStyle(box).paddingLeft) + parseFloat(getComputedStyle(box).borderLeftWidth)] : [];
          const onAxis = [...axes, ...local, ...labelAxes].some((x) => Math.abs(g.left - x) <= 2);
          // Measure where the text box starts too: padding inside a control is its own business.
          if (!onAxis && !inCtl(el)) {
            const rightAligned = Math.abs(el.getBoundingClientRect().right - (cr.right - parseFloat(ccs.paddingRight))) < 40 && g.left > cr.left + cr.width * 0.45;
            // A state pill at the head's right is the aside's place.
            if (rightAligned && !pillOf(el)) issues.loneRight.push(label(el));
            else if (rightAligned) { /* aside pill */ }
            else if (align !== 'center') issues.offAxis.push(`${label(el)} dx=${(g.left - Math.min(...axes)).toFixed(1)}`);
          }
        }
        if (tSize && !stat && el !== titleEl && !titleBlock?.contains(el) && !inCtl(el) && fs(el) > tSize - 0.3) issues.overTitle.push(`${label(el)} ${fs(el).toFixed(2)}>${tSize.toFixed(2)}`);
        const lh = parseFloat(cs.lineHeight);
        const r = el.getBoundingClientRect();
        if (lh && lines(el) >= 2 && lh / fs(el) < 1.35 && !inCtl(el)) issues.tight.push(`${label(el)} ${(lh / fs(el)).toFixed(2)}`);
        const t = (el.textContent ?? '').trim();
        const raised = ['capitalize', 'uppercase'].includes(cs.textTransform) || [el, el.parentElement].some((n) => n && getComputedStyle(n, '::first-letter').textTransform === 'uppercase');
        if (!stat && /^[a-zα-ωά-ώ]/.test(t) && !raised && !hasFront && el.matches('p,li,dd,h1,h2,h3,h4,h5,blockquote,span,div') && t.length > 3 && !/^(e\.g\.|i\.e\.|vs\.?|via|iOS|eBay|npm|pnpm|http|www\.)/.test(t) && !el.closest('code,pre,kbd,[translate=no]')) issues.lower.push(label(el));
      }
      // Subtitle: the first line under the title on the title's axis, smaller than it.
      if (titleEl && tg && !stat) {
        const tb = titleBlock.getBoundingClientRect();
        const sub = glyphs.find(({ el, g }) => !titleBlock.contains(el) && !el.closest('.bilingual-secondary') && (el.textContent ?? '').trim().length <= 100 && g.top >= tb.bottom - 2 && g.top - tb.bottom < 10 && Math.abs(g.left - tg.left) <= 2 && fs(el) < tSize - 0.2);
        // A subtitle already on the caption floor leaves the body nowhere
        // smaller to go; the rule judges real subtitles only.
        if (sub && fs(sub.el) > 13.3) {
          const sSize = fs(sub.el);
          const subBottom = (sub.el.closest('p,div') ?? sub.el).getBoundingClientRect().bottom;
          for (const { el, g } of glyphs) {
            const t = (el.textContent ?? '').trim();
            if (g.top > subBottom + 4 && t.length >= 48 && /\s/.test(t) && !inCtl(el, CONTROL + ',label,legend') && fs(el) > sSize - 0.3) {
              issues.bodyLoud.push(`${label(el)} ${fs(el).toFixed(2)}>=${sSize.toFixed(2)}`);
            }
          }
        }
      }
      // Anatomy against the Endorsements/Connections card.
      if (!stat && titleEl && tg) {
        const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const TITLE = W < 640 ? 15.343 : 16.32;
        const SUB = W < 640 ? 14.906 : 14.28;
        const display = titleEl.closest('h1') || card.matches('[data-card-hero]') || card.querySelector('h1');
        const head = tg.top - inner.top < 90;
        if (head && !display && Math.abs(tSize - TITLE) > 0.4) issues.titleStep.push(`${label(titleEl)} ${tSize.toFixed(2)}`);
        const tb = titleBlock.getBoundingClientRect();
        const subG = glyphs.find(({ el, g }) => !titleBlock.contains(el) && !el.closest('.bilingual-secondary') && g.top >= tb.bottom - 2 && g.top - tb.bottom < 10 && Math.abs(g.left - tg.left) <= 2 && !inCtl(el));
        if (head && !display && subG && fs(subG.el) > SUB + 0.3) issues.subStep.push(`${label(subG.el)} ${fs(subG.el).toFixed(2)}`);
        if (beside && !display) {
          const mw = beside.getBoundingClientRect().width;
          if (Math.abs(mw - 2.5 * root) > 1.5 && mw < 3 * root) issues.markSize.push(`${label(beside)} ${mw.toFixed(1)}`);
        }
        if (head && !display) {
          const axis = Math.min(tg.left, beside ? beside.getBoundingClientRect().left : Infinity);
          const inset = axis - inner.left;
          const want = W < 640 ? 16 : 24;
          if (!(Math.abs(inset - want) <= 4 || Math.abs(inset - 12) <= 1.5 || (inset >= 12 && inset <= want + 4))) issues.inset.push(`${label(card).slice(0, 50)} inset ${inset.toFixed(1)}`);
        }
      }
      for (const box of card.querySelectorAll('div,li,article,section,a')) {
        if (box === card || !shown(box)) continue;
        const bcs = getComputedStyle(box);
        const r = box.getBoundingClientRect();
        if (r.width < 120 || r.height < 40) continue;
        const sides = ['Top', 'Right', 'Bottom', 'Left'].every((sd) => parseFloat(bcs[`border${sd}Width`]) >= 0.5 && bcs[`border${sd}Style`] !== 'none');
        if (!sides || parseFloat(bcs.borderTopLeftRadius) < 6) continue;
        if (box.querySelector('[data-slot=avatar]') && (box.innerText ?? '').trim().length > 2 && !box.parentElement.closest('[data-tile-ok]')) issues.tile.push(label(box).slice(0, 60));
      }
      for (const k of Object.keys(issues)) issues[k] = [...new Set(issues[k])];
      const total = Object.values(issues).reduce((s, a) => s + a.length, 0);
      out.push({ framed: !card.hasAttribute('data-card'), card: label(card).slice(0, 70), title: titleEl ? label(titleEl).slice(0, 60) : null, titleSize: tSize, stat, avatar: Boolean(avatar), issues, total });
    }
    // Fields against their labels.
    const fields = [];
    for (const f of main.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([type=color]),textarea,select')) {
      if (!shown(f) || f.closest(FLOAT)) continue;
      const r = f.getBoundingClientRect(); if (r.width < 40) continue;
      const v = fs(f);
      const ph = f.placeholder ? parseFloat(getComputedStyle(f, '::placeholder').fontSize) : null;
      let lab = f.labels?.[0] ?? null;
      if (!lab && f.getAttribute('aria-labelledby')) lab = document.getElementById(f.getAttribute('aria-labelledby').split(' ')[0]);
      let labSize = null;
      if (lab && shown(lab) && (lab.innerText ?? '').trim()) {
        // The label's own words, not a question number or a marker beside them.
        const sizes = [lab, ...lab.querySelectorAll('*')].filter((n) => ownText(n) && shown(n) && !n.closest('.sr-only,[aria-hidden="true"]')).map(fs);
        labSize = sizes.length ? Math.max(...sizes) : fs(lab);
      }
      const ref = labSize ?? (W < 640 ? 14.906 : 14.28);
      const bad = v >= ref - 0.05 || (ph !== null && ph >= ref - 0.05);
      if (bad) fields.push(`${f.tagName.toLowerCase()}[${f.type ?? ''}] "${(f.placeholder || f.getAttribute('aria-label') || f.name || '').slice(0, 30)}" value ${v.toFixed(2)} ph ${ph?.toFixed(2) ?? '-'} label ${labSize?.toFixed(2) ?? 'none'}`);
    }
    return { cards: out, fields };
  }, W);
  let m;
  for (let attempt = 0; attempt < 3 && !m; attempt++) {
    try { m = await measure(); } catch { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800); }
  }
  if (!m) { console.log(`${route} | ${status} | not measured (the page kept navigating)`); continue; }
  const sum = Object.fromEntries(KINDS.map((k) => [k, m.cards.reduce((s, c) => s + c.issues[k].length, 0)]));
  const row = { route, status, cards: m.cards.length, sum, fields: m.fields, detail: m.cards.filter((c) => c.total) };
  rows.push(row);
  console.log(`${route} | ${status} | cards ${m.cards.length} | ${KINDS.map((k) => `${k} ${sum[k]}`).join(' | ')} | fields ${m.fields.length}`);
}
const totals = Object.fromEntries(KINDS.map((k) => [k, rows.reduce((s, r) => s + r.sum[k], 0)]));
console.log('\n=== TOTALS ===');
console.log(`routes ${rows.length} | cards ${rows.reduce((s, r) => s + r.cards, 0)} | ${KINDS.map((k) => `${k} ${totals[k]}`).join(' | ')} | fields ${rows.reduce((s, r) => s + r.fields.length, 0)}`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
await b.close();
