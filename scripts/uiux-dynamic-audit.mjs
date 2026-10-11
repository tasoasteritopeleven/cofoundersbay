/**
 * Read-only, resumable dynamic-route sample. Requires an already-running preview.
 * node scripts/uiux-dynamic-audit.mjs --limit=12 [--width=390] [--locale=en] [--theme=dark]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

const app = new URL('../apps/web/src/app/', import.meta.url).pathname;
const out = new URL('../docs/audit/', import.meta.url).pathname;
const requireWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireWeb('@playwright/test');
let AxeBuilder;
try { AxeBuilder = requireWeb('@axe-core/playwright').default; } catch { /* explicitly recorded */ }
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const base = args.base ?? 'http://localhost:80';
const widths = args.width ? [Number(args.width)] : [390, 1440];
const locales = args.locale ? [args.locale] : ['en', 'el'];
const themes = args.theme ? [args.theme] : ['dark', 'light'];
const limit = Number(args.limit ?? 12);
if (!/^http:\/\/localhost(?::\d+)?$/.test(base) || widths.some(w => ![390, 1440].includes(w)) ||
    locales.some(l => !['en', 'el'].includes(l)) || themes.some(t => !['dark', 'light'].includes(t)) ||
    !Number.isInteger(limit) || limit < 1) throw new Error('Invalid base/width/locale/theme/limit');

// A source ID is not a claim that the detail page renders it correctly.
// Missing IDs are explicitly absent, not guessed from search suggestions.
const fixtures = [
  { template: '/admin/user-detail/[id]', source: 'admin/user-detail/[id]/page.tsx', known: 'user-elena', evidence: 'lib/preview-api.ts PREVIEW_ADMIN_USERS id user-elena' },
  { template: '/data-room/[id]', source: 'data-room/[id]/page.tsx', blocked: 'No verified persisted data-room ID in preview' },
  { template: '/events/[id]', source: 'events/[id]/page.tsx', known: 'ev-demo-day', evidence: 'lib/preview-api.ts PREVIEW_EVENTS id ev-demo-day' },
  { template: '/groups/[groupId]', source: 'groups/[groupId]/page.tsx', known: 'grp-athens-founders', evidence: 'lib/preview-api.ts PREVIEW_GROUPS id grp-athens-founders; getGroup(id)' },
  { template: '/matches/[userId]', source: 'matches/[userId]/page.tsx', blocked: 'Directory user ID is not proof of a matching-vs detail fixture' },
  { template: '/org/[slug]', source: 'org/[slug]/page.tsx', blocked: 'Server-side fetch requires backend; previewOrgApi fixture alone does not validate SSR fetch' },
  { template: '/org/[slug]/admin', source: 'org/[slug]/admin/page.tsx', known: 'aegean-lab', evidence: 'lib/demo/org-world.ts ORG_SLUG; lib/demo/org-api.ts previewOrgApi' },
  { template: '/org/cohorts/[id]', source: 'org/cohorts/[id]/page.tsx', known: 'cohort-autumn-2026', evidence: 'lib/demo/org-world.ts cohortId cohort-autumn-2026' },
  { template: '/p/[username]', source: 'p/[username]/page.tsx', blocked: 'No source-confirmed public username profile detail fixture' },
  { template: '/pitch/[id]', source: 'pitch/[id]/page.tsx', blocked: 'No source-confirmed published public pitch deck fixture' },
  { template: '/profiles/[userId]', source: 'profiles/[userId]/page.tsx', blocked: 'SSR public profile fetch needs real API; directory IDs do not prove public profile fixture' },
  { template: '/programs/[id]', source: 'programs/[id]/page.tsx', known: 'prog-seed-autumn-2026', evidence: 'lib/demo/org-world.ts programs id prog-seed-autumn-2026' },
  { template: '/projects/[projectId]', source: 'projects/[projectId]/page.tsx', known: '1', evidence: 'lib/projects-demo.ts DEMO_PROJECTS_SEED id 1; getDemoProject' },
  { template: '/research/[boardId]', source: 'research/[boardId]/page.tsx', known: 'board-gtm', evidence: 'lib/preview-api.ts kitchenSink().boards id board-gtm; /api/research/boards/{id}' },
  { template: '/share/[token]', source: 'share/[token]/page.tsx', blocked: 'No source-confirmed active share token/password fixture' },
  { template: '/startups/[id]', source: 'startups/[id]/page.tsx', known: 'deal-harbor', evidence: 'lib/preview-api.ts PREVIEW_DEALS id deal-harbor; /api/investor/deals/{id}' },
  { template: '/t/[slug]', source: 't/[slug]/page.tsx', known: 'aegean-lab', evidence: 'lib/demo/org-world.ts ORG_SLUG; lib/demo/org-api.ts previewOrgApi tenant' },
];
const discovered = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (item.name === 'page.tsx' && relative(app, file).split('/').some(p => p.startsWith('[')))
      discovered.push(relative(app, file));
  }
}
walk(app);
if (fixtures.length !== 17 || discovered.some(f => !fixtures.some(x => x.source === f)) || discovered.length !== 17)
  throw new Error(`Dynamic inventory drift: ${JSON.stringify(discovered)}`);
mkdirSync(out, { recursive: true });
function atomic(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  renameSync(temp, path);
}
const cases = fixtures.flatMap(f => f.known
  ? ['known', 'missing'].flatMap(kind => [390, 1440].flatMap(width => ['en', 'el'].flatMap(locale =>
    ['dark', 'light'].map(theme => ({
      template: f.template, kind, source: f.source, evidence: f.evidence,
      route: f.template.replace(/\[[^/]+\]/, kind === 'known' ? f.known : '__audit_missing__'),
      width, locale, theme,
    })))))
  : []);
const checkpoint = c => join(out, 'dynamic-evidence', String(c.width), c.locale, c.theme,
  `${c.template.replace(/^\//, '').replaceAll('/', '__').replace(/\[[^\]]+\]/g, c.kind)}.json`);
function index() {
  const rows = cases.map(c => {
    const path = checkpoint(c);
    let result = { status: 'not_tested' };
    if (existsSync(path)) {
      try { result = JSON.parse(readFileSync(path, 'utf8')); }
      catch (error) { result = { status: 'invalid_checkpoint', error: String(error) }; }
    }
    return { ...c, status: result.status, httpStatus: result.httpStatus ?? null,
      finalPath: result.finalPath ?? null, checkpoint: existsSync(path) ? relative(out, path) : null };
  });
  const inventory = fixtures.map(f => ({
    ...f, fixtureStatus: f.known ? 'source_confirmed_sample_only' : 'blocked_no_valid_detail_fixture',
    status: f.known ? 'partial_sample_possible_not_template_coverage' : 'blocked',
    sampled: rows.filter(r => r.template === f.template && r.status !== 'not_tested').length,
  }));
  const tally = Object.fromEntries([...new Set(rows.map(r => r.status))].map(status =>
    [status, rows.filter(r => r.status === status).length]));
  atomic(join(out, 'dynamic-index.json'), { generatedAt: new Date().toISOString(),
    scope: 'Read-only synthetic demo founder; no real authorization, other roles, writes, or full template coverage',
    caveat: 'A missing ID can fall back to a different entity. HTTP 200 is not proof of lookup correctness.',
    inventory, tally, rows });
  return tally;
}
index();
if (!args['summary-only']) {
  async function preflight() {
    try {
      const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(7000) });
      return response.status === 200;
    } catch { return false; }
  }
  async function ready() {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await preflight()) return true;
      await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
    }
    return false;
  }
  let browser;
  try {
    browser = await chromium.launch({ executablePath: args.browser ?? '/repl/tools/bin/chromium' });
    let done = 0;
    for (const c of cases) {
      if (done >= limit) break;
      if (!widths.includes(c.width) || !locales.includes(c.locale) || !themes.includes(c.theme) ||
          (args.template && args.template !== c.template)) continue;
      const path = checkpoint(c);
      if (existsSync(path)) {
        const old = JSON.parse(readFileSync(path, 'utf8'));
        if (!args['retry-measured'] &&
            (!args['retry-incomplete'] || !['loading', 'navigation_failure', 'preview_unavailable'].includes(old.status))) continue;
      }
      if (!await ready()) {
        atomic(join(out, 'dynamic-availability.json'), { at: new Date().toISOString(), before: c.route, issue: 'Preview unavailable after bounded retries; no navigation attempted' });
        break;
      }
      const row = { ...c, at: new Date().toISOString(), status: 'incomplete', requestedRole: 'existing_founder (synthetic preview)', axe: { status: AxeBuilder ? 'not_run' : 'unavailable' }, pageErrors: [], blockedMutations: [] };
      const context = await browser.newContext({ viewport: { width: c.width, height: 900 }, serviceWorkers: 'block', colorScheme: c.theme });
      try {
        await context.addCookies([
          { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
          { name: 'cfb_primary_role', value: 'existing_founder', domain: 'localhost', path: '/' },
          { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
        ]);
        await context.addInitScript(({ locale, theme }) => {
          localStorage.setItem('user', JSON.stringify({ id: 'preview-demo-user', email: 'demo@cofounderbay.com', role: 'founder', displayName: 'Alex Demo', firstName: 'Alex', lastName: 'Demo' }));
          localStorage.setItem('cfb_demo_data', '1');
          localStorage.setItem('accessToken', 'preview-demo');
          localStorage.setItem('cfb_cookie_consent', 'true');
          localStorage.setItem('theme', theme);
          localStorage.setItem('cfb:primary-language', locale);
          localStorage.setItem('cfb:language-display', 'primary-only');
        }, { locale: c.locale, theme: c.theme });
        await context.route('**/*', route => {
          const req = route.request();
          if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
            row.blockedMutations.push(`${req.method()} ${new URL(req.url()).pathname}`);
            return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => row.pageErrors.push(error.message.slice(0, 220)));
        try {
          const response = await page.goto(base + c.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
          row.httpStatus = response?.status() ?? null;
          await page.waitForTimeout(5000); // palette transitions settle beyond 4.2 seconds
          row.finalPath = new URL(page.url()).pathname;
          row.measurement = await page.evaluate(() => {
            const main = document.querySelector('#main-content, main') ?? document.body;
            const text = main.innerText?.trim() ?? '';
            return {
              title: document.title, headings: [...document.querySelectorAll('h1')].filter(e => e.getClientRects().length).map(e => e.innerText.trim().slice(0, 100)),
              textExcerpt: text.slice(0, 500), wordCount: text.split(/\s+/).filter(Boolean).length,
              visibleAlerts: [...document.querySelectorAll('[role="alert"], [role="status"], [aria-busy="true"]')].filter(e => e.getClientRects().length).slice(0, 8).map(e => e.innerText.slice(0, 110)),
              lang: document.documentElement.lang, themeClass: document.documentElement.className,
              overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
              unnamedControls: [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(e =>
                e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' &&
                !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') ||
                  [...(e.labels ?? [])].map(l => l.textContent).join('') || e.textContent || '').trim()
              ).slice(0, 10).map(e => ({ tag: e.tagName.toLowerCase(), html: e.outerHTML.slice(0, 180) })),
            };
          });
          // Tab only: semantic focus observations, not a complete keyboard journey.
          row.keyboard = [];
          for (let i = 0; i < 6; i++) {
            await page.keyboard.press('Tab');
            row.keyboard.push(await page.evaluate(() => {
              const e = document.activeElement;
              return { tag: e?.tagName.toLowerCase(), role: e?.getAttribute('role'),
                name: (e?.getAttribute('aria-label') || e?.getAttribute('title') || e?.textContent || '').trim().slice(0, 65),
                visible: Boolean(e?.getClientRects().length), outline: e ? getComputedStyle(e).outlineStyle : null };
            }));
          }
          if (row.httpStatus === 200 && AxeBuilder) {
            try {
              const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
              row.axe = { status: 'completed', violations: result.violations.map(v => ({
                id: v.id, impact: v.impact, count: v.nodes.length,
                nodes: v.nodes.slice(0, 4).map(n => ({ target: n.target, failureSummary: n.failureSummary?.slice(0, 250) })),
              })), incompleteCount: result.incomplete.length };
            } catch (error) { row.axe = { status: 'error', error: String(error).slice(0, 240) }; }
          }
          row.status = row.httpStatus !== 200 ? 'http_non_200' :
            row.finalPath !== c.route ? 'redirect' :
            row.measurement.wordCount < 20 || row.measurement.visibleAlerts.some(x => /loading|φορτών/i.test(x)) ? 'loading' :
            c.kind === 'missing' ? 'missing_rendered_unverified' :
            row.pageErrors.length || row.measurement.overflowPx || row.measurement.unnamedControls.length || row.axe.violations?.length ? 'issue' : 'rendered_sample';
          if (c.kind === 'missing' && row.status === 'missing_rendered_unverified') {
            const knownPath = checkpoint({ ...c, kind: 'known' });
            if (existsSync(knownPath)) {
              const known = JSON.parse(readFileSync(knownPath, 'utf8'));
              row.sameContentAsKnown = row.measurement.headings.join('|') === known.measurement?.headings?.join('|') &&
                row.measurement.textExcerpt === known.measurement?.textExcerpt;
              if (row.sameContentAsKnown) row.status = 'missing_aliases_known';
            }
          }
        } catch (error) {
          row.status = 'navigation_failure';
          row.error = String(error).slice(0, 350);
          row.finalPath = new URL(page.url()).pathname;
        }
      } finally {
        await context.close();
        mkdirSync(join(out, 'dynamic-evidence', String(c.width), c.locale, c.theme), { recursive: true });
        // Preserve prior checkpoint when retrying a transient interruption.
        if (existsSync(path)) {
          const history = join(out, 'dynamic-history');
          mkdirSync(history, { recursive: true });
          atomic(join(history, `${c.width}-${c.locale}-${c.theme}-${c.template.replaceAll('/', '_')}-${c.kind}-${Date.now()}.json`),
            JSON.parse(readFileSync(path, 'utf8')));
        }
        atomic(path, row);
        console.log(c.width, c.locale, c.theme, c.route, row.status, row.httpStatus ?? '');
        index();
        done++;
      }
    }
  } finally {
    await browser?.close();
  }
}
console.log('Dynamic tally:', index());