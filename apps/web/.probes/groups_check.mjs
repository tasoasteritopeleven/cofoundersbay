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
await pg.goto('http://localhost:3000/groups', { waitUntil: 'networkidle', timeout: 60000 });
await pg.waitForTimeout(3000);
await pg.screenshot({ path: '.probes/press-groups-1440.png' });
const stats = await pg.evaluate(() => ({
  url: location.pathname,
  cards: document.querySelectorAll('.card-interactive').length,
  linkRole: document.querySelectorAll('[role="link"]').length,
  anyRole: document.querySelectorAll('[role]').length,
  tabbable: document.querySelectorAll('[tabindex="0"]').length,
}));
console.log(JSON.stringify(stats));
await b.close();
