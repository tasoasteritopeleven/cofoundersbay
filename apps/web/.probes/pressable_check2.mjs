import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
                      { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' }]);
const pg = await ctx.newPage();
await pg.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
  for (const t of ['sidebar','main','onboarding','welcome'])
    for (const u of ['preview','u_1','preview-demo-user']) localStorage.setItem(`cfb.tour.${t}.${u}`, 'done');
});
// groups card Enter->navigates
await pg.goto('http://localhost:3000/groups', { waitUntil: 'domcontentloaded', timeout: 60000 });
await pg.waitForTimeout(4000);
const n = await pg.locator('[role="link"][tabindex="0"]').count();
console.log('groups link-cards:', n);
if (n > 0) {
  await pg.locator('[role="link"][tabindex="0"]').first().focus();
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(2500);
  console.log('after Enter ->', pg.url());
}
// research board cards
await pg.goto('http://localhost:3000/research', { waitUntil: 'domcontentloaded', timeout: 60000 });
await pg.waitForTimeout(3500);
const st = await pg.evaluate(() => ({
  links: document.querySelectorAll('[role="link"][tabindex="0"]').length,
  pressed: document.querySelectorAll('[aria-pressed]').length,
  groups: document.querySelectorAll('[role="group"]').length,
}));
console.log('research:', JSON.stringify(st));
await b.close();
