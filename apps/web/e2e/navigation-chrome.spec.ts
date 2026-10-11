import { test, expect, type Page } from '@playwright/test';

/**
 * Two pieces of chrome that jsdom cannot see.
 *
 * The left sidebar folds to a rail with its edge button and opens over the
 * page while a mouse rests on it, as the page rail on the right does. Escape
 * closes that peek and it stays closed while the pointer is still there: the
 * reflow fires a fresh pointerenter, which once reopened it at once.
 *
 * Icon-only controls keep their icon. The decorative-icon CSS once read an
 * sr-only name as a visible label and painted 364 buttons as empty squares
 * (copy, delete, more options, help).
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
    for (const tour of ['matches', 'founder-dashboard']) {
      for (const user of ['preview', 'u_1', 'preview-demo-user']) localStorage.setItem(`cfb.tour.${tour}.${user}`, 'done');
    }
  });
}

async function skipTours(page: Page) {
  const skip = page.getByRole('button', { name: /Skip tour/ });
  for (let i = 0; i < 6 && (await skip.count()); i++) {
    await skip.first().click({ force: true });
    await page.waitForTimeout(250);
  }
}

test.describe('left sidebar', () => {
  test.skip(({ isMobile }) => isMobile, 'the desktop sidebar; phones use the drawer and bottom bar');

  test('collapses, peeks on hover, and Escape keeps it closed', async ({ page }) => {
    await signIn(page);
    await page.goto('/matches', { waitUntil: 'networkidle' });
    await skipTours(page);
    const nav = page.locator('aside:has([data-sidebar-edge-toggle])').first();
    const toggle = page.locator('[data-sidebar-edge-toggle]');
    const width = async () => Math.round((await nav.boundingBox())?.width ?? 0);

    const pinned = await width();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await page.mouse.move(900, 450);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(width).toBeLessThan(pinned / 2);
    const rail = await width();

    await page.mouse.move(30, 300);
    await expect(nav).toHaveAttribute('data-peek', 'true');
    await expect.poll(width).toBeGreaterThan(rail * 2);

    await page.mouse.move(900, 450);
    await expect(nav).not.toHaveAttribute('data-peek', 'true');

    await page.mouse.move(30, 300);
    await expect(nav).toHaveAttribute('data-peek', 'true');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await expect(nav).not.toHaveAttribute('data-peek', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('right page tools', () => {
  test('keyboard focus reveals the named section without pinning it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'phones use the tools sheet');
    await signIn(page);
    await page.goto('/projects', { waitUntil: 'networkidle' });
    await skipTours(page);
    const rail = page.locator('[data-page-rail]');
    const filters = rail.getByRole('button', { name: /^Filters\./ });
    await filters.focus();
    await expect(rail.getByRole('region', { name: /^Filters\./ })).toBeVisible();
    await expect(filters).toHaveAttribute('aria-expanded', 'true');
    await expect(rail.getByRole('button', { name: /^Keep page tools open/ }).first()).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await expect(rail.getByRole('region')).toHaveCount(0);
  });

  test('the mobile sheet has a name and keeps every tool section reachable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the sheet is the phone navigation path');
    await signIn(page);
    await page.goto('/projects', { waitUntil: 'networkidle' });
    await skipTours(page);
    await page.getByRole('button', { name: /^Page tools/ }).click();
    const sheet = page.getByRole('dialog', { name: /Page tools/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /^Filters/ }).click();
    await expect(sheet.getByRole('button', { name: /^Filters/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(sheet.getByRole('button', { name: /^Layout/ })).toBeVisible();
  });
});

const ICON_ROUTES = ['/builder/pitch-deck', '/dashboard/founder', '/matches', '/admin', '/settings', '/events'];

test.describe('icon-only controls', () => {
  for (const route of ICON_ROUTES) {
    test(`${route} paints every icon-only control`, async ({ page }) => {
      await signIn(page);
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const blank = await page.evaluate(() => {
        const shown = (n: Element) => {
          const c = getComputedStyle(n);
          return c.display !== 'none' && c.visibility !== 'hidden';
        };
        const visibleText = (el: Element) => {
          let t = '';
          const walk = (n: Node) => {
            if (n.nodeType === 3) { t += n.textContent; return; }
            if (n.nodeType !== 1) return;
            const e = n as Element;
            if (!shown(e) || e.classList.contains('sr-only')) return;
            n.childNodes.forEach(walk);
          };
          walk(el);
          return t.trim();
        };
        const out: string[] = [];
        for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
          const box = el.getBoundingClientRect();
          if (box.width < 4 || box.height < 4 || !shown(el) || getComputedStyle(el).opacity === '0' || visibleText(el)) continue;
          const icons = [...el.querySelectorAll('svg, img')];
          if (icons.length && !icons.some((i) => shown(i) && i.getBoundingClientRect().width > 0)) {
            out.push(el.getAttribute('aria-label') || el.getAttribute('title') || el.outerHTML.slice(0, 80));
          }
        }
        return out;
      });
      expect(blank, `blank icon-only controls on ${route}`).toEqual([]);
    });
  }
});
