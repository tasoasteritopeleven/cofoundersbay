import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const CASES = [
  // tag-based locators: pressable cards match getByRole('button') by name and
  // swallow the click meant for the real inner button.
  { route: '/matches', tagTrigger: /^Breakdown|Κράτηση/, name: 'match-breakdown' },
  { route: '/mentoring', tagTrigger: /Book·|Κράτηση/, name: 'mentor-book' },
  { route: '/admin/billing', preTab: /Coupons|Κουπόνια/i, trigger: /New coupon|Νέο κουπόνι/i, name: 'admin-billing-coupon' },
  { route: '/discover?saveSearch=true', trigger: null, name: 'discover-savesearch' },
  { route: '/discover?q=mentor&roles=mentor&locations=Athens', name: 'discover-run-params', checkFilters: true },
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
  { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
  for (const tour of ['matches','founder-dashboard','milestones','groups','messages','sidebar','main','onboarding','welcome','discover','mentoring'])
    for (const u of ['preview','u_1','preview-demo-user']) localStorage.setItem(`cfb.tour.${tour}.${u}`, 'done');
});
for (const c of CASES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 90)));
  await page.goto('http://localhost:3000' + c.route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => errors.push('NAV'));
  await page.waitForTimeout(4000);
  if (c.preTab) {
    await page.getByRole('tab', { name: c.preTab }).first().click({ timeout: 8000 }).catch(() => errors.push('PRE'));
    await page.waitForTimeout(700);
  }
  if (c.tagTrigger) {
    const loc = page.locator('button').filter({ hasText: c.tagTrigger });
    const n = await loc.count();
    if (!n) { console.log(c.route, '| no tag-trigger |', errors.join(';') || 'none'); await page.close(); continue; }
    await loc.first().click({ timeout: 8000 }).catch(() => errors.push('CLICK'));
    await page.waitForTimeout(900);
  } else if (c.trigger) {
    const loc = page.getByRole('button', { name: c.trigger });
    const n = await loc.count();
    if (!n) { console.log(c.route, '| no trigger |', errors.join(';') || 'none'); await page.close(); continue; }
    await loc.nth(c.nth ?? 0).click({ timeout: 8000 }).catch(() => errors.push('CLICK'));
    await page.waitForTimeout(900);
  } else {
    await page.waitForTimeout(1500);
  }
  if (c.checkFilters) {
    const qInput = await page.locator('input[placeholder]').evaluateAll((els) => els.map((e) => e.value).filter(Boolean).slice(0, 5)).catch(() => []);
    console.log(c.route, '| url:', page.url().split('3000')[1], '| inputs:', JSON.stringify(qInput), '| errors:', errors.join(';') || 'none');
    await page.screenshot({ path: `.probes/modal-${c.name}-1440.png` });
    await page.close();
    continue;
  }
  const dialog = page.getByRole('dialog').first();
  const open = await dialog.count();
  if (!open) { console.log(c.route, '| no dialog |', errors.join(';') || 'none'); await page.close(); continue; }
  const metrics = await dialog.evaluate((d) => {
    const r = d.getBoundingClientRect();
    const unnamed = [];
    for (const el of d.querySelectorAll('button, input, select, textarea, [role="button"]')) {
      const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')
        || (el.textContent || '').trim() || el.getAttribute('placeholder')
        || (el.labels && el.labels.length ? 'label' : '') || '';
      if (!name) unnamed.push(el.tagName + '.' + (el.className + '').split(' ')[0]);
    }
    const f = document.activeElement;
    return { w: Math.round(r.width), h: Math.round(r.height), overVw: r.right > innerWidth || r.left < 0,
      overVh: r.bottom > innerHeight, unnamed: unnamed.slice(0,6), focusedTag: f?.tagName, insideDialog: f ? d.contains(f) : false };
  });
  await page.screenshot({ path: `.probes/modal-${c.name}-1440.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log(c.route, '| open:', !!open, '| esc-closed:', !(await page.getByRole('dialog').count()), '|', JSON.stringify(metrics), '| errors:', errors.join('; ') || 'none');
  await page.close();
}
await b.close();
