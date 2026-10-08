import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    { name: 'cfb_session', value: 'e2e', domain: 'localhost', path: '/' },
    { name: 'cfb_primary_role', value: 'founder', domain: 'localhost', path: '/' },
  ]);
  await page.context().addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    for (const tour of ['founder-dashboard', 'builder', 'research']) {
      for (const user of ['preview', 'u_1', 'preview-demo-user']) localStorage.setItem(`cfb.tour.${tour}.${user}`, 'done');
    }
    localStorage.setItem('theme', 'light');
  });
});

test('builder shortcuts stay reachable without nested button frames', async ({ page }) => {
  await page.goto('/builder', { waitUntil: 'networkidle' });
  const shortcut = page.getByRole('button', { name: /^Edit Idea Core/ });
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toHaveCSS('border-top-width', '0px');
  await page.keyboard.press('Tab');
  await shortcut.focus();
  await expect(shortcut).toHaveCSS('outline-style', 'solid');
  await expect(shortcut).toHaveCSS('outline-width', '2px');
  await shortcut.press('Enter');
  await expect(page.getByRole('tab', { name: /^Idea Core/ })).toHaveAttribute('data-state', 'active');
});

test('project cards contain long roles and expose compact actions without hover', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'networkidle' });
  const links = page.getByRole('link', { name: /^View project/ });
  await expect(links).toHaveCount(3);
  const menu = page.getByRole('button', { name: /^Project actions/ }).first();
  await expect(menu).toHaveCSS('opacity', '1');
  const overflow = await page.locator('[data-surface="card"]').evaluateAll((cards) => cards
    .filter((card) => card.querySelector('a[href="/projects/1"]'))
    .map((card) => card.scrollWidth - card.clientWidth));
  expect(overflow).toHaveLength(1);
  expect(overflow.every((width) => width <= 1)).toBe(true);
  for (const link of await links.all()) {
    expect(await link.evaluate((el) => el.classList.contains('bg-primary'))).toBe(false);
  }
  await menu.click();
  await expect(page.getByRole('menuitem', { name: /Share project/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await links.first().click();
  await expect(page).toHaveURL(/\/projects\/1$/);
  for (const name of [/^Team/, /^Milestones/, /^Updates/, /^Overview/]) {
    const tab = page.getByRole('tab', { name });
    await tab.click();
    await expect(tab).toHaveAttribute('data-state', 'active');
  }
});

test('project filters communicate selection and keep a phone-sized target', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'networkidle' });
  const all = page.getByRole('button', { name: /^All stages/ });
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  const building = page.getByRole('button', { name: /^Building/ });
  await building.click();
  await expect(building).toHaveAttribute('aria-pressed', 'true');
  await expect(all).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('link', { name: /^View project/ })).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 1440) < 640) {
    // The phone button floor is 39.71px (globals.css, 5% under 41.8); fields stay 44.
    // Layout snaps it to 1/64px units, so the box reads just under 39.71.
    expect((await building.boundingBox())!.height).toBeGreaterThanOrEqual(39.66);
  }
});

test('pitch suggestions lose decorative frames without losing slide creation', async ({ page }) => {
  await page.goto('/builder/pitch-deck', { waitUntil: 'networkidle' });
  const add = page.getByRole('button', { name: /^Add Solution/ });
  await expect(add).toBeVisible();
  await expect(add).toHaveCSS('border-top-width', '0px');
  await add.click();
  await expect(add).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^Slide title/ })).toHaveValue('Solution');
});

test('pitch fields have durable labels and preserve drafts between slides', async ({ page }) => {
  await page.goto('/builder/pitch-deck', { waitUntil: 'networkidle' });
  const content = page.getByRole('textbox', { name: /^Slide Content/ });
  const notes = page.getByRole('textbox', { name: /^Speaker Notes/ });
  await expect(content).toBeVisible();
  await expect(notes).toBeVisible();
  await content.fill('A clear founder story');
  await notes.fill('Explain the evidence');
  await page.getByRole('button', { name: /^Next slide/ }).click();
  await page.getByRole('button', { name: /^Previous slide/ }).click();
  await expect(content).toHaveValue('A clear founder story');
  await expect(notes).toHaveValue('Explain the evidence');
});

for (const theme of ['light', 'alliance', 'minimal', 'apricot']) {
  test(`Greek project actions remain clear in the ${theme} theme`, async ({ page }, testInfo) => {
    await page.addInitScript((chosenTheme) => {
      localStorage.setItem('theme', chosenTheme);
      localStorage.setItem('cfb_locale', 'el');
      localStorage.setItem('cfb:primary-language', 'el');
      localStorage.setItem('cfb:language-display', 'primary-only');
    }, theme);
    await page.goto('/projects', { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: /^Προβολή έργου/ })).toHaveCount(3);
    const action = page.getByRole('button', { name: /Ενέργειες έργου/ }).first();
    await expect(action).toHaveCSS('opacity', '1');
    await page.keyboard.press('Tab');
    await action.focus();
    await expect(action).toHaveCSS('outline-width', '2px');
    await expect(action).toHaveCSS('outline-style', 'solid');
    if (theme !== 'light') await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-greek-projects.png`), fullPage: true });
  });
}

for (const route of [
  '/dashboard/founder', '/readiness', '/analytics', '/builder',
  '/builder/pitch-deck', '/builder/applications', '/research',
  '/research/board-gtm', '/milestones', '/projects', '/projects/1',
  '/fundraising', '/ai', '/messages', '/calendar',
]) {
  test(`requested workspace renders without page errors or overflow: ${route}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration|hydrated|unique.*key|each child/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.getByRole('main').first()).toBeVisible();
    await expect.poll(() => page.getByRole('main').first().innerText()).not.toBe('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true });
  });
}
