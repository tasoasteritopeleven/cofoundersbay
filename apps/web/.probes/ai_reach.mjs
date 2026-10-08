import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });

await page.goto('http://localhost:3000/ai/capabilities', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);
const caps = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    url: location.pathname,
    cards: document.querySelectorAll('article').length,
    get_profile: /Read your profile/.test(text),
    get_messages: /Read your conversations/.test(text),
    get_connections: /Read your connections/.test(text),
    update_profile: /Update your profile/.test(text),
    respond: /Answer a connection request/.test(text),
    create_milestone: /Create a milestone/.test(text),
    update_ms: /milestone.s status/.test(text),
    rsvp: /RSVP to an event/.test(text),
    create_event: /Create an event/.test(text),
  };
});
console.log('CAPS ' + JSON.stringify(caps));

await page.goto('http://localhost:3000/ai', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);
const input = page.locator('textarea, input').last();
const has = await input.count();
if (has) {
  await input.fill('any unread messages?');
  await input.press('Enter');
  await page.waitForTimeout(7000);
  const body = await page.evaluate(() => document.body.innerText);
  const m = body.match(/conversation|συνομιλ|did not answer|unread|αδιάβασ/i);
  console.log('AI_REPLY ' + JSON.stringify({ matched: m?.[0] ?? null, tail: body.slice(-400) }));
}
console.log('ERRORS ' + JSON.stringify(errors.slice(0, 8)));
await browser.close();
