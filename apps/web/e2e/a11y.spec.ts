import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LOGOTYPE } from './axe-scope';

/**
 * Routes reachable without a session. Everything else is behind the auth
 * middleware, which 307s to /login, so an unauthenticated crawl of them would
 * only ever assert against the login page.
 */
const PUBLIC_ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/pricing', name: 'pricing' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/terms', name: 'terms' },
  { path: '/privacy', name: 'privacy' },
  // A need card shared on LinkedIn, opened without an account.
  { path: '/c/e2e-public-card', name: 'public need card' },
];

/**
 * Rules asserted on every public page. Scoped deliberately: this is a
 * regression guard for the defects fixed in the accessibility pass, not a
 * blanket audit that would fail on unrelated pre-existing issues and get
 * switched off within a week.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).exclude(LOGOTYPE).analyze();
}

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    // Cookie banner and floating UI mount after hydration; scanning before they
    // exist would miss exactly the kind of late-mounted control that regresses.
    await page.waitForTimeout(1200);

    const results = await scan(page);

    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`,
    );
    expect(summary, `axe violations on ${route.path}`).toEqual([]);
  });
}

test('skip link is the first focusable element and targets main', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Off-screen until focused. It is moved with a percentage translate, so an
  // offset that does not clear the element's own height leaves a sliver of it
  // showing on every page — 4px, before this was pinned down.
  const link = page.locator('a.skip-to-content');
  const hidden = await link.boundingBox();
  expect(hidden, 'skip link should be in the layout').not.toBeNull();
  expect(hidden!.y + hidden!.height, 'skip link must sit fully above the viewport').toBeLessThanOrEqual(0);

  await page.keyboard.press('Tab');

  const focused = page.locator(':focus');
  await expect(focused).toHaveClass(/skip-to-content/);
  await expect(focused).toHaveAttribute('href', '#main-content');

  // …and fully visible once it is focused, or it bypasses nothing. The reveal
  // is a 150ms transform transition, so this has to settle rather than sample.
  await expect
    .poll(async () => (await link.boundingBox())?.y ?? -1, {
      message: 'focused skip link must come fully on screen',
      timeout: 3_000,
    })
    .toBeGreaterThanOrEqual(0);
});

test('viewport does not lock zoom', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).not.toContain('user-scalable=no');
  expect(content).not.toContain('maximum-scale=1');
});

test('every icon-only control has an accessible name', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const unnamed = await page.evaluate(() => {
    const offenders: string[] = [];
    document.querySelectorAll('button, a[href]').forEach((el) => {
      const text = (el.textContent || '').trim();
      const named =
        text.length > 0 ||
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        el.getAttribute('title');
      if (!named) offenders.push(el.outerHTML.slice(0, 120));
    });
    return offenders;
  });

  expect(unnamed, 'controls with no accessible name').toEqual([]);
});

/**
 * A control's name must not depend on the viewport.
 *
 * Two buttons in this product were named on a desktop and anonymous on a
 * phone: the label was the only thing naming them and it carried
 * `hidden sm:inline`, so below 640px axe reported `button-name (critical)`
 * while the very same page passed at 1440. That is a whole class of defect a
 * desktop-only scan cannot see, and it is invisible in review because the
 * markup plainly contains the word.
 *
 * This runs on the mobile project only — the narrow viewport is the one where
 * a responsive-hidden label actually disappears.
 */
test('every control keeps its name at phone width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'the defect only exists below the breakpoint');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const nameless = await page.evaluate(() => {
    const out: string[] = [];
    const selector = 'button, [role="button"], a[href], select, [role="switch"], [role="tab"]';
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const labelled = el.getAttribute('aria-label')?.trim()
        || el.getAttribute('title')?.trim()
        || (el.getAttribute('aria-labelledby')
            && document.getElementById(el.getAttribute('aria-labelledby')!.split(/\s+/)[0])?.textContent?.trim());
      if (labelled) continue;
      // Text that is itself hidden at this width does not name anything.
      const visibleText = Array.from(el.querySelectorAll('*'))
        .concat([el])
        .filter((n) => {
          const s = getComputedStyle(n as Element);
          return s.display !== 'none' && s.visibility !== 'hidden';
        })
        .map((n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join(''))
        .join(' ')
        .trim();
      // A bare number (a count badge) is not a name.
      if (/[\p{L}]{2,}/u.test(visibleText)) continue;
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`);
    }
    return [...new Set(out)];
  });

  expect(nameless, 'controls with no accessible name at phone width').toEqual([]);
});

test('toast region exists as a live region before any toast fires', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // The region must be in the DOM before a toast is inserted, or screen
  // readers do not announce the insertion.
  // Bilingual name ("Notifications. Ειδοποιήσεις"), so match its English start.
  const region = page.locator('[role="region"][aria-label^="Notifications"]');
  await expect(region).toHaveCount(1);
  await expect(region).toHaveAttribute('aria-live', 'polite');
});

test('security headers are present on a document response', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  const headers = response!.headers();

  expect(headers['content-security-policy']).toBeTruthy();
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['permissions-policy']).toContain('geolocation=()');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-content-type-options']).toBe('nosniff');
});

test('unauthenticated app routes redirect to login', async ({ page }) => {
  const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  expect(response!.url()).toContain('/login');
  expect(response!.url()).toContain('redirect=%2Fdashboard');
});

/**
 * iOS Safari zooms the whole page whenever a focused form control renders below
 * 16px, and the user has to pinch back out to carry on. It is a platform rule,
 * not a style preference, so it is enforced rather than reviewed. Above `sm`
 * the design system's 14px density is intentional and out of scope here.
 */
test('form controls are at least 16px on phone viewports', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone viewports only');

  for (const path of ['/login', '/register', '/forgot-password']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const small = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea',
        ),
      )
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden'
            && parseFloat(cs.fontSize) < 16;
        })
        .map((el) => `${el.tagName.toLowerCase()} ${getComputedStyle(el).fontSize} ${el.className}`),
    );

    expect(small, `controls under 16px on ${path} — iOS Safari will zoom on focus`).toEqual([]);
  }
});

/**
 * Content occluding content. Layered UI (dialogs, popovers, sticky chrome) is
 * excluded; what is left is a laid-out box covering another one, which is how
 * the /builder tab labels ended up behind the header buttons on a phone.
 */
test('no laid-out element occludes another', async ({ page }) => {
  for (const path of ['/', '/pricing', '/login']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const hits = await page.evaluate(() => {
      const layered = (el: Element) => {
        for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute') return true;
          if (a.getAttribute('aria-hidden') === 'true') return true;
          if (a.getAttribute('role') === 'dialog' || a.getAttribute('role') === 'tooltip') return true;
        }
        return false;
      };

      // Two inline fragments of the same wrapped paragraph share an inline
      // formatting context: with tight leading their line boxes overlap even
      // though the glyphs sit on separate lines. That is type metrics, not
      // occlusion, so pairs like that are not comparable.
      const blockOf = (el: Element) => {
        for (let a = el.parentElement; a; a = a.parentElement) {
          if (!/^(inline|inline-block|inline-flex|contents)$/.test(getComputedStyle(a).display)) return a;
        }
        return null;
      };
      const inlineIn = new Map<Element, Element | null>();

      const boxes: { el: Element; r: DOMRect; label: string }[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (el.children.length || el.closest('svg')) continue;
        if (!(el.textContent || '').trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        if (layered(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        inlineIn.set(el, /^inline/.test(cs.display) ? blockOf(el) : null);
        boxes.push({ el, r, label: (el.textContent || '').trim().slice(0, 30) });
      }

      boxes.sort((a, b) => a.r.top - b.r.top);
      const out: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j];
          if (B.r.top >= A.r.bottom - 0.5) break;
          if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
          const ba = inlineIn.get(A.el), bb = inlineIn.get(B.el);
          if (ba && bb && ba === bb) continue;      // same run of inline text

          const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
          const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
          if (ox <= 1 || oy <= 1) continue;
          const smaller = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
          if (smaller <= 0 || (ox * oy) / smaller < 0.15) continue;
          out.push(`"${A.label}" is covered by "${B.label}"`);
        }
      }
      return out;
    });

    expect(hits, `occluded content on ${path}`).toEqual([]);
  }
});

/**
 * WCAG 1.4.3 over the design tokens, for every theme.
 *
 * The app ships thirteen theme contexts — light, dark, system, alliance,
 * cofounder, and four role palettes that are each applied *alongside* light or
 * dark. axe only ever sees the one the page is currently rendering, so a token
 * pair that fails under `[data-theme="alliance"]`, or under `role-mentor` on a
 * light ground, is invisible to the browser suite. This runs the static check
 * that reads globals.css directly.
 */
test('every theme clears WCAG AA on its token pairs', async () => {
  const { execFileSync } = await import('node:child_process');
  let out = '';
  try {
    out = execFileSync('python3', ['scripts/check-theme-contrast.py'], { encoding: 'utf8' });
  } catch (e) {
    const err = e as { stdout?: string };
    out = err.stdout ?? String(e);
    const failing = out.split('\n').filter((l) => /^\s{2}\S.*\d\.\d{2}\s+#/.test(l));
    throw new Error('theme contrast failures:\n' + failing.join('\n'));
  }
  expect(out).toContain('TOTAL FAILURES BELOW 4.5:1 -> 0');
});

/**
 * The corner system.
 *
 * Corners are the one property in this app that is set from two places at
 * once: a Tailwind utility on nearly every element, and a token ladder in
 * globals.css that those utilities resolve against. That is exactly the shape
 * of thing that drifts — someone adds `rounded-[14px]` because 13 "looked a
 * bit tight", and six months later the product draws nine radii again. These
 * three assertions pin the ladder, the curvature, and the nesting rule that
 * the radius work established, so a drift shows up as a failing test rather
 * than as a page that is subtly noisier than the one next to it.
 */
test.describe('corner system', () => {
  // The ladder is derived from `--radius` rather than written out, because
  // the token is per-theme: `:root` sets 12px and the minimal theme 8px, and
  // every Tailwind step is a calc() off it (see tailwind.config.ts). Hard
  // numbers here would pass on one theme and fail on another for no reason.
  // The 2px heat-map cell is below the bottom of the ladder on purpose — its
  // box is 6-10px square — so it is allowed explicitly.
  const ladderFor = (base: number) =>
    [0, 2, base - 6, base - 4, base - 2, base, base + 4, base + 8, base + 14];

  test('every corner comes from the radius ladder', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const base = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius')) || 12);
    const strays = await page.evaluate((ladder: number[]) => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (el.closest('svg')) continue;
        // The brand mark scales its corner with its size (28%, app-icon
        // geometry), so at 41px it is 11px. It is artwork, not a UI surface.
        if (el.closest('[data-brand-mark]')) continue;
        for (const k of ['borderTopLeftRadius', 'borderTopRightRadius',
                         'borderBottomRightRadius', 'borderBottomLeftRadius'] as const) {
          const v = Math.round((parseFloat(cs[k]) || 0) * 100) / 100;
          // A pill is `9999px` clamped by the browser to half the short side,
          // so it resolves to an arbitrary number and is not a ladder step.
          if (v >= Math.min(r.width, r.height) / 2 - 0.6 && v > 0) continue;
          if (ladder.includes(v)) continue;
          out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} → ${v}px`);
        }
      }
      return [...new Set(out)];
    }, ladderFor(base));
    expect(strays, `radii outside the ladder derived from --radius: ${base}px`).toEqual([]);
  });

  // 0e792ce chose plain circular arcs ("as on cursor.com"): a superellipse
  // at the same radius pulls the curve tight and reads abrupt. This holds
  // that decision; it used to assert the opposite.
  test('corners are plain circular arcs, pills included', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const res = await page.evaluate(() => {
      if (!CSS.supports('corner-shape', 'squircle')) return { supported: false, shaped: [] as string[] };
      const shaped: string[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || !(parseFloat(cs.borderTopLeftRadius) > 0)) continue;
        const shape = cs.getPropertyValue('corner-shape').trim();
        if (shape && shape !== 'round') shaped.push(`${el.tagName.toLowerCase()} → ${shape}`);
      }
      return { supported: true, shaped: [...new Set(shaped)] };
    });
    if (!res.supported) test.skip(true, 'browser does not implement corner-shape');
    expect(res.shaped, 'corners with a non-circular shape').toEqual([]);
  });

  test('no inset child out-radiuses the surface it sits in', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const hits = await page.evaluate(() => {
      const rad = (el: Element) => Math.max(...['borderTopLeftRadius', 'borderTopRightRadius',
        'borderBottomRightRadius', 'borderBottomLeftRadius']
        .map((k) => parseFloat(getComputedStyle(el)[k as never]) || 0));
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const p = el.parentElement;
        if (!p) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const cr = rad(el), prr = rad(p);
        if (!cr || !prr) continue;
        if (cr >= Math.min(r.width, r.height) / 2 - 0.6) continue;        // pill
        if (prr >= Math.min(pr.width, pr.height) / 2 - 0.6) continue;     // pill parent
        // A full-bleed child correctly carries its parent's exact radius; only
        // an *inset* child with a bigger corner bulges past the surface edge.
        const inset = (pr.width - r.width) + (pr.height - r.height);
        if (inset < 4) continue;
        if (cr > prr) out.push(`${String(el.className).slice(0, 40)} ${cr} inside ${prr}`);
      }
      return [...new Set(out)];
    });
    expect(hits, 'inner corner larger than the surface around it').toEqual([]);
  });
});
