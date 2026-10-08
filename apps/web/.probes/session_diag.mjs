import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
await pg.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('accessToken', 'preview-demo');
  localStorage.setItem('cfb_cookie_consent', 'true');
});
for (const r of ['/milestones', '/groups', '/feed']) {
  await pg.goto('http://localhost:3000' + r, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForTimeout(4000);
  const st = await pg.evaluate(() => ({
    url: location.pathname,
    hasDemo: localStorage.getItem('cfb_demo_data'),
    hasUser: !!localStorage.getItem('user'),
    cookie: document.cookie.includes('cfb_session'),
    title: document.title.slice(0, 50),
  }));
  console.log(r, '->', JSON.stringify(st));
}
await pg.screenshot({ path: '.probes/diag-groups.png' });
await b.close();
