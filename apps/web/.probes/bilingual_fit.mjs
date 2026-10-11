// Bilingual-fit sweep: for every route, counts bilingual labels that
//   (a) ESCAPE their surface — right edge past the nearest card / dialog /
//       button / viewport, i.e. text painted outside its box;
//   (b) are CLIPPED — an ellipsised half (scrollWidth > clientWidth).
// Clipping inside the sidebar/tab strips is by design and is reported apart.
//   node .probes/bilingual_fit.mjs <routes.txt> [width=1440]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean);
const W = Number(process.argv[3] ?? 1440);
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
});
const page = await ctx.newPage();
const all = [];
let tEsc = 0, tClip = 0, tChrome = 0;
for (const r of routes) {
  await page.goto('http://localhost:3000' + r, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(700);
  // A client redirect can destroy the context mid-measure; settle and retry once.
  const measure = (fn) => page.evaluate(fn).catch(async () => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    return page.evaluate(fn).catch(() => ({ escapes: [], clips: [], chrome: 0 }));
  });
  const res = await measure(() => {
    const vis = (el) => { const s = getComputedStyle(el); const rc = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && rc.width > 0 && rc.height > 0; };
    const chromeSel = 'aside, nav, [role="tablist"], [data-page-rail], [data-sidebar], [data-mobile-tabs], header';
    const surfaceSel = '[class*="rounded-xl"][class*="border"], [class*="rounded-2xl"][class*="border"], [role="dialog"], button, a, [data-surface], [class*="bg-card"]';
    const escapes = [], clips = []; let chrome = 0;
    for (const el of document.querySelectorAll('[data-bilingual-pair]')) {
      if (!vis(el)) continue;
      const pair = el.parentElement;
      if (!pair) continue;
      // screen-reader-only text is not painted
      if (pair.closest('.sr-only') || pair.getBoundingClientRect().width <= 2) continue;
      const text = pair.textContent.trim().replace(/\s+/g, ' ').slice(0, 70);
      const inChrome = !!pair.closest(chromeSel);
      // content inside a horizontal scroller is meant to run past the viewport
      let sc = pair.parentElement, inScroller = false;
      while (sc) { const o = getComputedStyle(sc).overflowX; if ((o === 'auto' || o === 'scroll') && sc.scrollWidth > sc.clientWidth) { inScroller = true; break; } sc = sc.parentElement; }
      // clipped: either half ellipsised, or the pair box itself
      const pairBox = pair.getBoundingClientRect();
      // a half wrapped onto the clipped second line is hidden, not cut
      const shown = (p) => p === pair || p.getBoundingClientRect().top < pairBox.bottom - 2;
      const parts = [pair, ...pair.children].filter(shown);
      const clipped = parts.some((p) => p.scrollWidth > p.clientWidth + 1 && getComputedStyle(p).textOverflow === 'ellipsis');
      if (clipped) { if (inChrome) chrome++; else clips.push(text); }
      // escaped: painted right edge beyond its surface
      const surf = pair.parentElement?.closest(surfaceSel);
      const pr = pair.getBoundingClientRect();
      let limit = document.documentElement.clientWidth;
      if (surf) limit = Math.min(limit, surf.getBoundingClientRect().right);
      const right = Math.max(pr.right, ...[...pair.children].filter(shown).map((c) => c.getBoundingClientRect().right));
      if (right > limit + 2 && !inChrome && !inScroller) escapes.push(text + `  [+${Math.round(right - limit)}px]`);
    }
    return { escapes, clips, chrome };
  });
  tEsc += res.escapes.length; tClip += res.clips.length; tChrome += res.chrome;
  all.push({ route: r, ...res });
  if (res.escapes.length || res.clips.length) console.log(`${r} | escape ${res.escapes.length} | clip ${res.clips.length} | chrome-clip ${res.chrome}`);
}
console.log(`\nTOTAL routes ${routes.length} · escapes ${tEsc} · clipped ${tClip} · chrome-clipped (by design) ${tChrome}`);
writeFileSync(`.probes/bilingual_fit_${W}.json`, JSON.stringify(all, null, 1));
await b.close();
