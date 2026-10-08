// Opens every dialog a route offers and measures it at one width.
//   node .probes/dialog_sweep.mjs <routes.txt> [width=390]
// For each trigger (aria-haspopup="dialog", or a Radix trigger whose
// aria-controls names a dialog) on each route: click it, then check the open
// [role=dialog|alertdialog] for
//   name     - an accessible name (aria-labelledby text or aria-label)
//   fits     - inside the viewport (no part off-screen sideways, top visible)
//   close    - a close control >= 39.71x39.71 below 640px, the phone button floor (>= 24 otherwise)
//   escape   - Escape closes it
//   focus    - focus returns to the trigger after closing
//   unnamed  - controls inside without an accessible name
//   overflow - horizontal overflow inside the dialog
// Measurement, not proof: one role (platform_admin, demo), one width.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');
const routes = readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter(Boolean);
const W = Number(process.argv[3] ?? 390);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 844 } });
await ctx.addCookies([
  { name: 'cfb_session', value: 'probe', domain: 'localhost', path: '/' },
  { name: 'cfb_primary_role', value: process.env.ROLE ?? 'platform_admin', domain: 'localhost', path: '/' },
]);
await ctx.addInitScript(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'a@b.test', role: 'admin' }));
  localStorage.setItem('cfb_demo_data', '1');
  localStorage.setItem('cfb_cookie_consent', 'true');
  // first-run tours would sit over every page
  const get = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
});
const page = await ctx.newPage();
const results = [];
for (const route of routes) {
  await page.goto('http://localhost:3000' + route, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  // Controlled dialogs carry no aria-haspopup, so every plain button in the
  // page column is a candidate. Destructive or session-ending verbs and
  // submit buttons are never clicked. Tagging is a function: a click that
  // navigates reloads the page and the tags with it.
  const DESTRUCTIVE = /delete|remove|archive|sign ?out|log ?out|leave|reject|decline|disconnect|withdraw|\bban\b|suspend|revoke|reset|clear|pass on|unfollow|block|report|διαγρ|αφαίρ|αποχώρ|απόρρ|αποσύνδ|αναστολ|καθαρ/i;
  const tag = () => page.evaluate((destructiveSrc) => {
    const destructive = new RegExp(destructiveSrc, 'i');
    const main = document.querySelector('#main-content') ?? document.body;
    const seen = new Set();
    const triggers = [...main.querySelectorAll('button, [role="button"]')].filter((el) => {
      if (el.closest('[role="dialog"], nav, aside, [data-page-rail], [role="tablist"], form')) return false;
      if (el.getAttribute('type') === 'submit' || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const text = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim();
      if (!text || destructive.test(text)) return false;
      if (el.getAttribute('aria-pressed') !== null || el.getAttribute('role') === 'tab' || el.getAttribute('aria-expanded') === 'true') return false;
      const key = text.replace(/\s+/g, ' ').slice(0, 60);
      if (seen.has(key)) return false; // one of each repeated row action
      seen.add(key);
      return true;
    });
    triggers.forEach((el, i) => el.setAttribute('data-dlg-probe', String(i)));
    return triggers.length;
  }, DESTRUCTIVE.source);
  const count = await tag();
  const startUrl = page.url();
  for (let i = 0; i < Math.min(count, 30); i++) {
    const trigger = page.locator(`[data-dlg-probe="${i}"]`);
    if (!(await trigger.count())) continue;
    const label = ((await trigger.getAttribute('aria-label')) || (await trigger.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ timeout: 3000 }).catch(() => {});
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
    const opened = await dialog.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
    if (!opened) {
      // not a dialog: undo whatever the click did (menu, navigation) and move on
      await page.keyboard.press('Escape').catch(() => {});
      if (page.url() !== startUrl) {
        await page.goto(startUrl, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(500);
        await tag();
      }
      continue;
    }
    await page.waitForTimeout(350);
    const m = await dialog.evaluate((d, width) => {
      const vw = document.documentElement.clientWidth;
      const r = d.getBoundingClientRect();
      const byId = (ids) => (ids || '').split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
      const name = d.getAttribute('aria-label') || byId(d.getAttribute('aria-labelledby'));
      const closeEl = [...d.querySelectorAll('button')].find((btn) => /close|κλείσιμο/i.test(btn.getAttribute('aria-label') || btn.textContent || ''));
      const cr = closeEl?.getBoundingClientRect();
      const minClose = width < 640 ? 39.66 : 24; // 39.71px floor, snapped to 1/64px
      const unnamed = [...d.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role="combobox"], [role="switch"], [role="checkbox"]')]
        .filter((el) => {
          const er = el.getBoundingClientRect();
          if (!er.width || !er.height) return false;
          const n = el.getAttribute('aria-label') || byId(el.getAttribute('aria-labelledby')) || el.textContent?.trim() || el.getAttribute('title') || el.getAttribute('placeholder')
            || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()) || el.closest('label')?.textContent?.trim();
          return !n;
        }).length;
      return {
        name: name.slice(0, 50),
        fits: r.left >= -1 && r.right <= vw + 1 && r.top >= -1,
        close: closeEl ? (cr.width >= minClose - 0.5 && cr.height >= minClose - 0.5 ? 'ok' : `${Math.round(cr.width)}x${Math.round(cr.height)}`) : 'none',
        overflow: Math.max(0, d.scrollWidth - d.clientWidth),
        unnamed,
        closeHtml: closeEl ? closeEl.outerHTML.slice(0, 160) : '',
        wide: [...d.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > d.getBoundingClientRect().right + 1).slice(0, 2).map((el) => el.tagName + '.' + String(el.className).slice(0, 80)),
      };
    }, W);
    await page.keyboard.press('Escape');
    const closed = await dialog.waitFor({ state: 'hidden', timeout: 1500 }).then(() => true).catch(() => false);
    await page.waitForTimeout(250);
    const focusBack = closed && (await page.evaluate((idx) => document.activeElement?.getAttribute('data-dlg-probe') === String(idx) || !!document.activeElement?.closest(`[data-dlg-probe="${idx}"]`), i));
    const row = { route, trigger: label, ...m, escape: closed, focus: focusBack };
    results.push(row);
    const bad = !m.name || !m.fits || m.close !== 'ok' || m.overflow > 1 || m.unnamed || !closed || !focusBack;
    console.log(`${bad ? '✗' : '✓'} ${route} | ${label} | name:${m.name ? 'y' : 'NO'} fits:${m.fits ? 'y' : 'NO'} close:${m.close} esc:${closed ? 'y' : 'NO'} focus:${focusBack ? 'y' : 'NO'} unnamed:${m.unnamed} xOverflow:${m.overflow}`);
    if (process.env.DETAIL && m.close !== 'ok') console.log('    close: ' + m.closeHtml);
    if (process.env.DETAIL && m.overflow > 1) console.log('    wide: ' + m.wide.join(' | '));
    if (!closed) { await page.goto(startUrl, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(500); await tag(); }
  }
}
const fail = (k) => results.filter(k).length;
console.log(`\nSUMMARY @${W}px · dialogs opened ${results.length} on ${new Set(results.map((r) => r.route)).size} routes`);
console.log(`  no name ${fail((r) => !r.name)} · off-screen ${fail((r) => !r.fits)} · close<min ${fail((r) => r.close !== 'ok')} · no Escape ${fail((r) => !r.escape)} · focus lost ${fail((r) => !r.focus)} · unnamed controls ${fail((r) => r.unnamed > 0)} · x-overflow ${fail((r) => r.overflow > 1)}`);
writeFileSync(`.probes/dialog_sweep_${W}.json`, JSON.stringify(results, null, 1));
await b.close();
