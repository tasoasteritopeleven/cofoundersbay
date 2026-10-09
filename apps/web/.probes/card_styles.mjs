// Print each card's text styles on one route, to see which ones a card mixes.
//   node .probes/card_styles.mjs <route> [width=390] [cards=2]   (env ROLE; needs a running server on :3000)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/user/cofoundersbay/apps/web/package.json')('@playwright/test');
const [route, W = '390', max = '2'] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(W), height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },{ name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },{ name: 'cfb_primary_role', value: process.env.ROLE ?? 'existing_founder', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => { try { localStorage.setItem('cfb_demo_data','1'); localStorage.setItem('cfb_cookie_consent','true'); localStorage.setItem('cfb:primary-language','en'); const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : g.call(this, k); }; } catch {} });
const p = await ctx.newPage();
await p.goto('http://localhost:3000' + route, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
const out = await p.evaluate((max) => {
  const main = document.querySelector('main#main-content') ?? document.body;
  const shown = (el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
  const CONTROL = 'button,a,input,select,textarea,label,[role=button],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=option],[role=menuitem]';
  const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const cards = [...main.querySelectorAll('[data-card]')].filter((c) => shown(c) && !c.querySelector('[data-card]'));
  const res = [];
  for (const card of cards.slice(0, Number(max))) {
    const m = new Map();
    for (const el of card.querySelectorAll('*')) {
      if (!own(el) || !shown(el) || el.closest(CONTROL) || el.closest('.sr-only,[aria-hidden="true"],[data-keep-icon],svg')) continue;
      const cs = getComputedStyle(el);
      const k = `${(Math.round(parseFloat(cs.fontSize)*2)/2)}|${cs.fontWeight}|${cs.color}`;
      if (!m.has(k)) m.set(k, `${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ').slice(0,4).join('.')} "${el.textContent.trim().slice(0,30)}"`);
    }
    res.push([...m.entries()].map(([k, v]) => `   ${k.padEnd(34)} ${v}`).join('\n'));
  }
  return res;
}, max);
out.forEach((c, i) => console.log(`card ${i + 1}\n${c}`));
await b.close();
