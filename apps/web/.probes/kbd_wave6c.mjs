import { createRequire } from 'node:module';
const requireFromWeb = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = requireFromWeb('@playwright/test');

const BASE = 'http://localhost:3000';
const shot = (p, n) => p.screenshot({ path: `.probes/${n}.png`, fullPage: false });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
// demo-mode sign-in like the platform sweep does
await page.evaluate(() => {
  try {
    document.cookie = 'cfb_session=preview; path=/';
    localStorage.setItem('cfb_session', 'preview');
    localStorage.setItem('cfb.tour.global.preview', 'done');
    localStorage.setItem('cfb.tour.discover.preview', 'done');
    localStorage.setItem('cfb.tour.matches.preview', 'done');
  } catch {}
});
await page.goto(`${BASE}/discover`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

const out = { url1: page.url() };

// 1. '?' opens the shortcuts dialog
await page.keyboard.press('Shift+/');
await page.waitForTimeout(700);
out.shortcutsDialog = await page.locator('[role="dialog"]').count();
out.shortcutsTitle = await page.locator('[role="dialog"] h2, [role="dialog"] [class*="title"]').first().textContent().catch(() => null);
await shot(page, 'kbd_shortcuts');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 2. 'g' then 'm' navigates to /messages
await page.keyboard.press('g');
await page.keyboard.press('m');
await page.waitForTimeout(1500);
out.afterGM = page.url();

// 3. '/' opens the command palette
await page.keyboard.press('/');
await page.waitForTimeout(600);
out.paletteOpen = await page.locator('[role="dialog"]').count();
await shot(page, 'kbd_palette');

// 4. "Keyboard shortcuts" item in palette opens the dialog
await page.keyboard.type('shortcut');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
out.afterItem = await page.locator('[role="dialog"]').count();
out.afterItemText = await page.locator('[role="dialog"]').first().textContent().catch(() => '');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// 5. Ctrl+K palette, run "Switch to Dark mode", verify theme state sync
await page.keyboard.press('Control+k');
await page.waitForTimeout(600);
await page.keyboard.type('dark mode');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
out.themeAfterDark = await page.evaluate(() => ({
  cls: document.documentElement.className,
  dataTheme: document.documentElement.getAttribute('data-theme'),
  stored: localStorage.getItem('theme'),
}));

// switch back to light
await page.keyboard.press('Control+k');
await page.waitForTimeout(600);
await page.keyboard.type('light mode');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
out.themeAfterLight = await page.evaluate(() => ({
  cls: document.documentElement.className,
  dataTheme: document.documentElement.getAttribute('data-theme'),
  stored: localStorage.getItem('theme'),
}));

console.log(JSON.stringify(out, null, 2));

// 6. typing 'g' inside an input must NOT navigate
const out2 = {};
try {
  await page.goto(`${BASE}/discover`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const input = page.locator('input[aria-label="Search"]').first();
  await input.focus();
  await page.keyboard.type('g m test');
  await page.waitForTimeout(900);
  out2.afterTypingInInput = page.url();
  out2.inputValue = await input.inputValue();
} catch (e) {
  out2.error = String(e).slice(0, 200);
}
console.log(JSON.stringify(out2, null, 2));
await browser.close();
