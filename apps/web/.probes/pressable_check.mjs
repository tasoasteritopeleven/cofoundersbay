import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();
const pg = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await pg.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
  for (const t of ['sidebar','main','onboarding','welcome'])
    for (const u of ['preview','u_1','preview-demo-user']) localStorage.setItem(`cfb.tour.${t}.${u}`, 'done');
});
const results = [];
try {
  await pg.goto('http://localhost:3000/groups', { waitUntil: 'networkidle', timeout: 45000 });
  await pg.waitForTimeout(2500);
  // find a card with role=link, focus it, press Enter
  const card = pg.locator('[role="link"][tabindex="0"]').first();
  const count = await pg.locator('[role="link"][tabindex="0"]').count();
  await card.focus();
  const focused = await pg.evaluate(() => document.activeElement?.getAttribute('role'));
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(2000);
  results.push({ route: '/groups', linkCards: count, focusedRole: focused, urlAfterEnter: pg.url() });
} catch (e) { results.push({ route: '/groups', error: e.message.slice(0,120) }); }
try {
  await pg.goto('http://localhost:3000/research', { waitUntil: 'networkidle', timeout: 45000 });
  await pg.waitForTimeout(2000);
  const stats = await pg.evaluate(() => ({
    pressable: document.querySelectorAll('[role="link"][tabindex="0"], [role="button"][tabindex="0"]').length,
    groups: document.querySelectorAll('[role="group"]').length,
  }));
  results.push({ route: '/research', ...stats });
} catch (e) { results.push({ route: '/research', error: e.message.slice(0,120) }); }
console.log(JSON.stringify(results, null, 1));
await b.close();
