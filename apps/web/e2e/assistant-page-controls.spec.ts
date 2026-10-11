import { test, expect, type Page } from '@playwright/test';

/**
 * The assistant operates the page it was asked on.
 *
 * End to end, against the production build and the API stub: a question
 * typed into a page's Ask AI bar is asked in place (the reader stays on the
 * page), the assistant proposes the page's own control, confirming it
 * changes the page, and a command the page says it cannot run is refused
 * with the page's reason rather than offered.
 *
 * What this does not prove: a model's own tool calls (the stub serves no
 * model), or a write reaching a database. In demo mode the browser preview
 * answers /admin/users with the demo world's accounts, so the row commands
 * are live; the refusal case uses a command the page itself says it cannot
 * run (an export with nothing matching), which is the same code path the
 * sample rows' refusal took.
 */

async function signIn(page: Page) {
  await page.context().addCookies([
    { name: 'cfb_session', value: 'e2e', domain: 'localhost', path: '/' },
    { name: 'cfb_primary_role', value: 'platform_admin', domain: 'localhost', path: '/' },
  ]);
  await page.context().addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'u_1', email: 'admin@cofounderbay.test', role: 'admin' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
  });
}

async function askFromHeader(page: Page, question: string) {
  const box = page.locator('header form input[aria-label*="Ask AI"]').first();
  await box.fill(question);
  await box.press('Enter');
}

test.describe('assistant and page controls', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('asks in place, proposes the page control, and confirming changes the page', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    const count = page.locator('p[aria-live="polite"]').first();
    await expect(count).toContainText(/\d+ of \d+ users/);
    // The total comes from the directory, which is the demo world's; read it
    // rather than pinning it, and check the filter narrows within it.
    const total = Number((await count.innerText()).match(/of (\d+) users/)?.[1]);
    expect(total).toBeGreaterThan(1);

    await askFromHeader(page, 'show only suspended users');
    await expect(page).toHaveURL(/\/admin\/users$/);

    const chat = page.getByRole('dialog', { name: /Chat/ });
    await expect(chat.getByText('Status filter: Suspended').first()).toBeVisible({ timeout: 20_000 });
    await chat.getByRole('button', { name: /^Apply/ }).first().click();

    await expect(count).toContainText(`of ${total} users`);
    await expect(count).toContainText('Suspended');
    const shown = Number((await count.innerText()).match(/(\d+) of/)?.[1]);
    expect(shown).toBeLessThan(total);
    await expect(chat.getByText(/^Done/).first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('refuses a command the page cannot run, with the page’s reason', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    const count = page.locator('p[aria-live="polite"]').first();
    await expect(count).toContainText('users');

    // Nothing matches, so the page's own export says it cannot run.
    await page.getByRole('textbox', { name: /Search users by name or email/ }).fill('zzzz-no-such-person');
    await expect(count).toContainText(/^0 of/);

    await askFromHeader(page, 'export users as CSV');
    const chat = page.getByRole('dialog', { name: /Chat/ });
    await expect(
      chat.getByText(/Export users as CSV is not available right now: No users match the current filters/).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(chat.getByRole('button', { name: /^Apply/ })).toHaveCount(0);
  });
});
