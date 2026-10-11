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
  for (const t of ['matches','founder-dashboard','milestones','groups','messages','sidebar','main','onboarding','welcome'])
    for (const u of ['preview','u_1','preview-demo-user']) localStorage.setItem(`cfb.tour.${t}.${u}`, 'done');
});
for (const r of ['/matches', '/mentoring', '/admin/billing', '/saved-searches']) {
  await pg.goto('http://localhost:3000' + r, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForTimeout(4000);
  const st = await pg.evaluate(() => ({
    url: location.pathname,
    buttons: [...document.querySelectorAll('button')].slice(0, 40).map(b => (b.textContent||'').trim().slice(0,30)).filter(Boolean),
    btnCount: document.querySelectorAll('button').length,
  }));
  console.log('\n', r, '->', st.url, 'buttons:', st.btnCount);
  console.log('   ', st.buttons.join(' | ').slice(0, 400));
  await pg.screenshot({ path: '.probes/diag-' + r.replace(/\//g,'_') + '.png' });
}
await b.close();
