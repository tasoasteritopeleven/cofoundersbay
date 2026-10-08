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
    localStorage.setItem('cfb_tours_done', '1');
  });
});

test('question navigation preserves the draft and each field has a label', async ({ page }) => {
  await page.goto('/builder/applications', { waitUntil: 'networkidle' });
  const fields = page.locator('main textarea');
  await expect(fields).toHaveCount(12);
  for (const field of await fields.all()) {
    await expect(field).toHaveAccessibleName(/.+/);
  }
  const first = page.getByRole('textbox', { name: /Describe what your company does/ });
  await first.fill('My unsaved application draft');
  await page.getByRole('combobox', { name: /Go to question/ }).selectOption('yc12');
  await expect(fields.last()).toBeFocused();
  await expect(first).toHaveValue('My unsaved application draft');
  await expect(fields.last()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
});

test('readiness retains the radar and dimensions without horizontal overflow', async ({ page }) => {
  await page.goto('/readiness', { waitUntil: 'networkidle' });
  await expect(page.getByRole('tab', { name: /All Dimensions/ })).toBeVisible();
  await expect(page.locator('.recharts-radar-polygon').first()).toBeVisible();
  const screenWidth = page.viewportSize()?.width ?? 0;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(screenWidth + 1);
  const radar = await page.locator('.recharts-wrapper').first().boundingBox();
  expect(radar).not.toBeNull();
  expect(radar!.x).toBeGreaterThanOrEqual(0);
  expect(radar!.x + radar!.width).toBeLessThanOrEqual(screenWidth + 1);
});
