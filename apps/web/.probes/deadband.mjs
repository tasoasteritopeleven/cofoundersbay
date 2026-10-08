import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const BASE = 'http://localhost:3000';
const routes = (process.env.PROBE_ROUTES || 'ai/capabilities,investor/analytics,marketplace,projects/create,reputation,tenant/analytics').split(',');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: Number(process.env.W || 1440), height: 900 } });
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
  const route = r.startsWith('/') ? r : '/' + r;
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(900);
  const cards = await page.evaluate(() => {
    const main = document.querySelector('#main-content') || document.querySelector('main') || document.body;
    const out = [];
    for (const card of main.querySelectorAll('[class*="rounded-xl"][class*="border"], [class*="rounded-2xl"][class*="border"]')) {
      const cr = card.getBoundingClientRect(); if (cr.height < 120) continue;
      let maxBottom = cr.top;
      for (const el of card.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.width > 0 && (el.textContent?.trim() || el.tagName === 'svg' || el.tagName === 'IMG' || el.tagName === 'CANVAS')) maxBottom = Math.max(maxBottom, r.bottom); }
      const pad = parseFloat(getComputedStyle(card).paddingBottom) || 0;
      const gap = cr.bottom - pad - maxBottom;
      if (gap > 60) out.push({ gap: Math.round(gap), h: Math.round(cr.height), cls: (card.className || '').slice(0, 120), txt: (card.textContent || '').trim().slice(0, 80) });
    }
    return out;
  });
  console.log('\n===', route, 'dead:', cards.length);
  cards.forEach((c) => console.log(`  gap:${c.gap} h:${c.h} | ${c.cls} | "${c.txt}"`));
}
await b.close();
