// Writes .probes/routes-<role>.txt: every route the role's sidebar offers in
// its Work mode (the mode that differs per role), plus its dashboard.
//   ROLES=mentor,angel_investor node .probes/role_routes.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const roles = (process.env.ROLES ?? 'existing_founder,mentor,angel_investor,service_provider,incubator_admin').split(',');
const b = await chromium.launch();
for (const role of roles) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([
    { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
    { name: 'cfb_primary_role', value: role, domain: 'localhost', path: '/' },
  ]);
  await ctx.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'admin' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('cfb:sidebar-mode', 'work');
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const landing = new URL(page.url()).pathname;
  const hrefs = await page.evaluate(() => [...(document.querySelector('nav.flex-1, aside nav')?.querySelectorAll('a[href]') ?? [])]
    .map((a) => a.getAttribute('href').split(/[?#]/)[0]).filter((h) => h.startsWith('/')));
  const routes = [...new Set([landing, ...hrefs])];
  writeFileSync(`.probes/routes-${role}.txt`, routes.join('\n') + '\n');
  console.log(`${role}: ${routes.length} routes`);
  await ctx.close();
}
await b.close();
