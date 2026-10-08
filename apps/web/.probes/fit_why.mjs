// For each clipped/escaping bilingual pair on the given routes, print the
// element that clips it and its ancestors, so the fix lands at the cause.
//   node .probes/fit_why.mjs <width> <route> [route...]
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const [W, ...routes] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(W), height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
const page = await ctx.newPage();
for (const r of routes) {
  await page.goto('http://localhost:3000' + r, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(900);
  const out = await page.evaluate(() => {
    const desc = (n) => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 110)} [w${Math.round(n.getBoundingClientRect().width)}]`;
    const rows = [];
    for (const el of document.querySelectorAll('[data-bilingual-pair]')) {
      const pair = el.parentElement;
      if (!pair || pair.closest('.sr-only')) continue;
      const box = pair.getBoundingClientRect();
      if (box.width <= 2) continue;
      if (pair.closest('aside, nav, [role="tablist"], [data-page-rail], [data-sidebar], header')) continue;
      const shown = (p) => p === pair || p.getBoundingClientRect().top < box.bottom - 2;
      const parts = [pair, ...pair.children].filter(shown);
      const clip = parts.find((p) => p.scrollWidth > p.clientWidth + 1 && getComputedStyle(p).textOverflow === 'ellipsis');
      if (!clip) continue;
      const chain = [];
      let n = pair.parentElement;
      for (let i = 0; i < 4 && n; i++, n = n.parentElement) chain.push('    ' + desc(n));
      rows.push(`${pair.textContent.trim().slice(0, 60)}\n  clip on ${clip === pair ? 'pair' : clip === el ? 'primary' : 'secondary'}: ${desc(clip)}\n${chain.join('\n')}`);
    }
    return rows;
  });
  console.log(`### ${r} (${out.length})`);
  for (const row of [...new Set(out)].slice(0, 4)) console.log(row);
}
await b.close();
