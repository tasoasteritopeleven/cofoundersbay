import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const base = 'http://localhost:3000';
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await pg.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'platform_admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
  for (const tour of ['sidebar','main','onboarding','welcome'])
    for (const u of ['preview','u_1','preview-demo-user']) localStorage.setItem(`cfb.tour.${tour}.${u}`, 'done');
});
for (const [route, name] of [['/admin/sso','sso'], ['/admin/tenants','tenants'], ['/feed','feed']]) {
  try {
    await pg.goto(base + route, { waitUntil: 'networkidle', timeout: 45000 });
    await pg.waitForTimeout(2500);
    if (name === 'tenants') {
      const gear = pg.locator('tr, .rounded-lg, [class*=row]').locator('button:has(svg)').last();
      const orgBtn = pg.locator('button').filter({ has: pg.locator('svg') }).nth(-1);
      try { await pg.locator('svg.lucide-settings, [aria-label*="ettings"], button:has(.lucide-settings)').first().click({ timeout: 4000 }); } catch {}
      await pg.waitForTimeout(1500);
    }
    await pg.screenshot({ path: `.probes/lab-${name}-1440.png`, fullPage: false });
    // count label[for] vs labels, aria groups
    const stats = await pg.evaluate(() => ({
      labels: document.querySelectorAll('label').length,
      linked: document.querySelectorAll('label[for]').length,
      groups: document.querySelectorAll('[role="group"]').length,
      switches: document.querySelectorAll('[role="switch"]').length,
      pressed: document.querySelectorAll('[aria-pressed]').length,
    }));
    console.log(route, 'OK', JSON.stringify(stats));
  } catch (e) { console.log(route, 'FAIL', e.message.slice(0, 140)); }
}
await b.close();
