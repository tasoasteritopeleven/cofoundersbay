import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LOGOTYPE } from './axe-scope';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Static WCAG 2.2 AA + layout sweep of the top founder-facing routes, run in
 * the built-in preview demo mode (no API). Run with:
 *
 *   A11Y_BASE_URL=http://localhost:3000 npx playwright test e2e/demo-a11y-sweep.spec.ts
 *
 * Writes a machine-readable report to test-results/demo-a11y-sweep.json so the
 * findings can be triaged outside the runner.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const ROUTES = [
  '/dashboard/founder',
  '/matches',
  '/discover',
  '/builder',
  '/builder/pitch-deck',
  '/builder/applications',
  '/research',
  '/readiness',
  '/analytics',
  '/messages',
  '/connections',
  '/milestones',
  '/projects',
  '/commitments',
  '/commitments/new',
  '/commitments/need-harbor',
  '/commitments/need-athens-intros',
  '/c/harbor-commercial-demo',
  '/fundraising',
  '/opportunities',
  '/programs',
  '/marketplace',
  '/expert-reviews',
  '/feed',
  '/settings',
  '/org/cohorts/cohort-autumn-2026',
  '/dashboard/mentor',
  '/mentor/sessions',
  '/mentor/requests',
  '/mentor/mentees',
  '/mentor/availability',
  '/mentor/earnings',
  '/mentor/reviews',
  '/mentor/profile',
  '/mentoring',
  '/dashboard/investor',
  '/investor/scouting',
  '/investor/pipeline',
  '/investor/portfolio',
  '/investor/watchlist',
  '/investor/analytics',
  '/investors',
  '/dashboard/incubator',
  '/org/programs',
  '/org/applications',
  '/org/cohorts',
  '/org/startups',
  '/org/members',
  '/org/mentors',
  '/org/events',
  '/org/analytics',
  '/org/settings',
];

type Finding = {
  route: string;
  viewport: string;
  violations: { id: string; impact: string | null | undefined; help: string; nodes: number; targets: string[] }[];
  overflow: string[];
  status: number | null;
};

const findings: Finding[] = [];

async function waitForStableDom(page: Page, quietMs = 700, timeoutMs = 12_000) {
  await page.evaluate(
    ([quiet, limit]) =>
      new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const done = () => { observer.disconnect(); resolve(); };
        const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, quiet); });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        timer = setTimeout(done, quiet);
        setTimeout(done, limit);
      }),
    [quietMs, timeoutMs] as const,
  );
}

async function enterDemo(page: Page) {
  await page.goto('/demo');
  await page.waitForURL(/\/dashboard\/founder/, { timeout: 20_000 });
  // Tours are covered by their own test; keep them out of the page scans.
  await page.evaluate(() => {
    for (const id of ['matches', 'builder', 'research', 'founder-dashboard', 'activity', 'achievements']) {
      localStorage.setItem(`cfb.tour.${id}.preview-demo-user`, 'done');
    }
  });
}

for (const route of ROUTES) {
  test(`a11y + layout: ${route}`, async ({ page }, testInfo) => {
    await enterDemo(page);
    const response = await page.goto(route);
    await waitForStableDom(page);
    // The auth guard redirects to /login without a session — a scan of the login
    // page would pass silently, so the route itself must have rendered.
    expect(page.url(), `${route} redirected to ${page.url()}`).toContain(route.split('/')[1]);
    expect((await page.locator('main').first().innerText()).trim().length, `${route} rendered an empty main`).toBeGreaterThan(40);

    const results = await new AxeBuilder({ page }).withTags(TAGS).exclude(LOGOTYPE).analyze();
    // Only real page-level horizontal scroll counts. Elements inside their own
    // scroll container (tab strips, chip rows) are by design wider than the screen.
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const main = document.querySelector('main') ?? document.body;
      if (main.scrollWidth <= main.clientWidth + 1 && root.scrollWidth <= root.clientWidth + 1) return [];
      const inScroller = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        }
        return false;
      };
      return [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !inScroller(e))
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 3).join('.')}`);
    });

    const finding: Finding = {
      route,
      viewport: testInfo.project.name,
      status: response?.status() ?? null,
      overflow,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      })),
    };
    findings.push(finding);
    mkdirSync('test-results/a11y', { recursive: true });
    writeFileSync(`test-results/a11y/${testInfo.project.name}${route.replace(/[^a-z0-9]+/gi, '-')}.json`, JSON.stringify(finding, null, 2));

    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect.soft(blocking, `${route} @ ${testInfo.project.name}: ${blocking.map((v) => v.id).join(', ')}`).toEqual([]);
    expect.soft(overflow, `${route} @ ${testInfo.project.name} overflows horizontally`).toEqual([]);
  });
}

test('first-run tour dialog is accessible', async ({ page }, testInfo) => {
  await page.goto('/demo');
  await page.waitForURL(/\/dashboard\/founder/, { timeout: 20_000 });
  await page.goto('/matches');
  // By role, not test id: this suite runs a production build, and
  // next.config's reactRemoveProperties strips data-test* attributes there.
  const dialog = page.getByRole('dialog', { name: /Your match summary/ });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(TAGS).include('[role="dialog"][aria-modal="true"]').analyze();
  findings.push({
    route: '/matches#tour',
    viewport: testInfo.project.name,
    status: 200,
    overflow: [],
    violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
  });
  expect.soft(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cfb.tour.matches.preview-demo-user'))).toBe('done');
});

test.afterAll(async ({}, testInfo) => {
  mkdirSync('test-results', { recursive: true });
  writeFileSync(`test-results/demo-a11y-sweep.${testInfo.project.name}.json`, JSON.stringify(findings, null, 2));
});
