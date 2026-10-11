/** Read-only keyboard reachability smoke check; never submits a form. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = webRequire('@playwright/test');
const browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium' });
const rows = [];
try {
  for (const route of ['/login', '/register']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const row = { requestedRoute: route, width: 390, at: new Date().toISOString(), tabStops: [], actualFinalUrl: null, error: null };
    try {
      const response = await page.goto(`http://localhost:80${route}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
      row.httpStatus = response?.status() ?? null;
      await page.waitForTimeout(500);
      row.actualFinalUrl = page.url();
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Tab');
        row.tabStops.push(await page.evaluate(() => {
          const e = document.activeElement;
          return {
            tag: e?.tagName.toLowerCase(), type: e?.getAttribute('type'), text: (e?.getAttribute('aria-label') || e?.textContent || '').trim().slice(0, 60),
            visible: Boolean(e?.getClientRects().length), outlineStyle: e ? getComputedStyle(e).outlineStyle : null,
            outlineWidth: e ? getComputedStyle(e).outlineWidth : null,
          };
        }));
        if (row.tabStops.at(-1).tag === 'button' && /show|password|εμφάν/i.test(row.tabStops.at(-1).text)) {
          row.showPasswordReachable = true;
          row.showPasswordFocusVisible = row.tabStops.at(-1).outlineStyle !== 'none' && row.tabStops.at(-1).outlineWidth !== '0px';
          // Only toggle visibility, no user input, network mutation, or form submission.
          await page.keyboard.press('Enter');
          row.passwordVisibilityAfterEnter = await page.locator('input[name="password"],input[autocomplete="current-password"],input[autocomplete="new-password"]').first().getAttribute('type').catch(() => null);
          break;
        }
      }
    } catch (error) { row.error = String(error).slice(0, 350); }
    finally { rows.push(row); await context.close(); }
  }
} finally {
  await browser.close();
}
const out = new URL('../docs/audit/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/keyboard.json`, JSON.stringify({ at: new Date().toISOString(), scope: 'Unauthenticated mobile login/register; Tab/Enter on visibility control only', rows }, null, 2) + '\n');
console.log(rows.map((row) => ({ route: row.requestedRoute, status: row.httpStatus, showReachable: row.showPasswordReachable, focusVisible: row.showPasswordFocusVisible, typeAfterEnter: row.passwordVisibilityAfterEnter, error: row.error })));