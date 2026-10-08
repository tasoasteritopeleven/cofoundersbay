/**
 * Read-only rendering probe against the already-running preview.
 * Usage: node scripts/uiux-resumable-audit.mjs --matrix --width=390 --locale=en --theme=dark --limit=8
 * Re-run to resume; --retry-failed revisits completed failures.
 * Requires Playwright browser libraries (e.g. the Nix shell documented in docs/audit/README.txt).
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('../apps/web/src/app/', import.meta.url).pathname;
const out = new URL('../docs/audit/', import.meta.url).pathname;
const requireWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = requireWeb('@playwright/test');
let AxeBuilder;
try { AxeBuilder = requireWeb('@axe-core/playwright').default; } catch { /* record unavailable below */ }
const flags = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [name, ...value] = arg.replace(/^--/, '').split('=');
  return [name, value.length ? value.join('=') : true];
}));
const width = Number(flags.width ?? 390);
const limit = Number(flags.limit ?? 8);
const base = flags.base ?? 'http://localhost:80';
const requestedRole = 'existing_founder';
const matrix = Boolean(flags.matrix);
const reflow = Boolean(flags.reflow);
const motion = flags.motion ?? 'no-preference';
const locale = flags.locale ?? 'en';
const theme = flags.theme ?? 'dark';
const themes = ['dark', 'light', 'alliance', 'cofounder', 'minimal'];
const locales = ['en', 'el'];
// IDs below are literal fixtures in lib/preview-api.ts; missing is intentionally not a fixture.
const dynamicCases = [
  { route: '/events/ev-demo-day', fixture: 'known_fixture', sourceFile: 'events/[id]/page.tsx' },
  { route: '/events/__audit_missing__', fixture: 'missing_fixture', sourceFile: 'events/[id]/page.tsx' },
];
// Version the dynamic fixture expectation: old fallback observations must not
// masquerade as evidence after the preview endpoint changes.
const fixtureRevision = 2;
if (!(reflow && matrix ? [320, 720] : [390, 1440]).includes(width) || !Number.isInteger(limit) || limit < 1 || !/^http:\/\/localhost(?::\d+)?$/.test(base)) {
  throw new Error('Use --width=390|1440 (or --matrix --reflow --width=320|720) --limit=positiveInteger --base=http://localhost:80');
}
if (matrix && (!locales.includes(locale) || ![...themes, 'system'].includes(theme) || !['reduce', 'no-preference'].includes(motion))) {
  throw new Error('Use --locale=en|el --theme=dark|light|alliance|cofounder|minimal|system');
}
const routeFiles = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) walk(join(dir, item.name));
    else if (item.isFile() && /^page\.[jt]sx?$/.test(item.name)) routeFiles.push(join(dir, item.name));
  }
}
walk(root);
const routeMap = new Map();
for (const file of routeFiles.sort()) {
  const parts = relative(root, file).split('/').slice(0, -1);
  if (parts.some((part) => part.startsWith('@') || part.startsWith('[') || part.startsWith('(.)'))) continue;
  const route = '/' + parts.filter((part) => !/^\(.*\)$/.test(part)).join('/');
  if (routeMap.has(route)) throw new Error(`Duplicate static route ${route}: ${file} and ${routeMap.get(route)}`);
  routeMap.set(route, relative(root, file));
}
const routes = [...routeMap.keys()].sort();
const dynamicTemplates = routeFiles.filter((file) => relative(root, file).split('/').some((part) => part.startsWith('[')))
  .map((file) => {
    const parts = relative(root, file).split('/').slice(0, -1);
    return {
      template: '/' + parts.filter((part) => !/^\(.*\)$/.test(part)).join('/'),
      sourceFile: relative(root, file),
      status: 'not_tested',
      reason: 'A literal fixture navigation, if present, samples one ID only; full dynamic-template/content coverage is not established.',
      sampledFixtures: dynamicCases.filter((c) => c.sourceFile === relative(root, file)).map((c) => c.route),
    };
  }).sort((a, b) => a.template.localeCompare(b.template));
const selectedRoutes = matrix && flags.routes
  ? flags.routes.split(',').map((route) => route.trim())
  : routes;
if (matrix) for (const route of selectedRoutes) {
  const fixture = dynamicCases.find((c) => c.route === route);
  if (!routeMap.has(route) && !fixture) throw new Error(`Unknown route ${route}; dynamic routes require an explicit known/missing fixture case`);
}
mkdirSync(out, { recursive: true });
function atomic(path, data) {
  const temp = `${path}.tmp.${process.pid}`;
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  renameSync(temp, path);
}
atomic(join(out, 'static-routes.json'), { generatedAt: new Date().toISOString(), source: 'apps/web/src/app/**/page.[jt]sx?', count: routes.length, routes: Object.fromEntries(routeMap) });
const key = (route) => route === '/' ? 'root' : route.slice(1).replaceAll('/', '__');
const evidencePath = (route) => matrix
  ? join(out, 'matrix-evidence', String(width), locale, theme, ...(motion === 'reduce' ? ['reduce'] : []), `${key(route)}.json`)
  : join(out, 'evidence', String(width), `${key(route)}.json`);
function matrixOverview() {
  const cells = [];
  for (const w of [390, 1440]) for (const lang of locales) for (const palette of [...themes, 'system']) {
    for (const route of [...routes, ...dynamicCases.map((c) => c.route)]) {
      const fixture = dynamicCases.find((c) => c.route === route);
      const path = join(out, 'matrix-evidence', String(w), lang, palette, `${key(route)}.json`);
      let record = { status: 'not_tested' };
      if (existsSync(path)) {
        try { record = JSON.parse(readFileSync(path, 'utf8')); }
        catch (error) { record = { status: 'invalid_checkpoint', error: String(error) }; }
      }
      if (record.status === 'issue' && record.consoleErrors?.some((error) =>
        /502 \(Bad Gateway\)|Failed to load chunk/.test(error))) {
        record = { ...record, status: 'infrastructure_failure' };
      }
      if (fixture && record.status !== 'not_tested' && record.fixtureRevision !== fixtureRevision) {
        record = { ...record, status: 'historical_pre_fix' };
      }
      // A source fix does not rewrite the original browser result. Annotate
      // affected measurements so readers know which findings need a fresh
      // same-cell probe before treating them as current.
      const postCheckpointChanges = [];
      if (w === 1440 && lang === 'en' && palette === 'dark'
        && record.axe?.violations?.some((v) => v.id === 'target-size'
          && v.nodes?.some((n) => n.target?.some((target) =>
            ['.h-6', '.right-0', '.translate-x-1\\/2', '.z-50'].includes(target))
            && /19\.7px by 24px/.test(n.failureSummary ?? '')))) {
        postCheckpointChanges.push('shared_side_nav_target_size_fixed_after_checkpoint_not_retested');
      }
      if (w === 390 && lang === 'en' && palette === 'dark'
        && record.measurement?.unnamedVisibleControls?.some((control) => control.tag === 'input')) {
        postCheckpointChanges.push('mobile_input_labels_changed_after_checkpoint_heuristic_not_retested');
      }
      if (w === 390 && lang === 'en' && palette === 'dark' && route === '/reputation'
        && record.measurement?.horizontalOverflowPx > 0) {
        postCheckpointChanges.push('reputation_layout_fixed_after_checkpoint_not_retested');
      }
      cells.push({
        width: w, locale: lang, theme: palette, requestedRole, requestedRoute: route,
        routeType: fixture ? 'dynamic' : 'static', fixture: fixture?.fixture ?? null,
        status: record.status, finalPath: record.finalPath ?? null, httpStatus: record.httpStatus ?? null,
        ...(postCheckpointChanges.length ? { postCheckpointChanges } : {}),
        checkpoint: record.status === 'not_tested' ? null : relative(out, path),
      });
    }
  }
  // Reflow and reduced-motion probes are separate sampled rows, never counted as
  // full native zoom or full route/theme/locale coverage.
  const supplemental = [];
  for (const w of [320, 720, 390, 1440]) for (const lang of locales) for (const palette of [...themes, 'system']) {
    const dir = join(out, 'matrix-evidence', String(w), lang, palette, 'reduce');
    for (const route of [...routes, ...dynamicCases.map((c) => c.route)]) {
      const path = join(dir, `${key(route)}.json`);
      if (existsSync(path)) supplemental.push({ width: w, locale: lang, theme: palette, motion: 'reduce', requestedRoute: route, checkpoint: relative(out, path) });
    }
  }
  for (const w of [320, 720]) for (const lang of locales) for (const palette of [...themes, 'system']) {
    for (const route of [...routes, ...dynamicCases.map((c) => c.route)]) {
      const path = join(out, 'matrix-evidence', String(w), lang, palette, `${key(route)}.json`);
      if (existsSync(path)) supplemental.push({ width: w, locale: lang, theme: palette, motion: 'no-preference', requestedRoute: route, checkpoint: relative(out, path) });
    }
  }
  const tally = Object.fromEntries([...new Set(cells.map((r) => r.status))].map((status) => [status, cells.filter((r) => r.status === status).length]));
  atomic(join(out, 'matrix.json'), {
    generatedAt: new Date().toISOString(), base, dimensions: { widths: [390, 1440], locales, themes: [...themes, 'system'], role: requestedRole },
    scope: 'Read-only synthetic preview-demo founder browser rendering; system is a separate theme, not included in the five named palette count.',
    roleLimit: 'Other roles and authorization not tested. Cookie/localStorage do not establish identity or permissions.',
    operationLimit: 'Writes, persistence, CRUD, email, real authentication, keyboard journeys, and backend authorization not tested.',
    notTestedScopes: [
      ...['platform_admin', 'investor', 'mentor', 'incubator', 'provider', 'cofounder_candidate'].map((role) => ({ dimension: 'authenticated_role', value: role, status: 'not_tested', reason: 'Synthetic demo always renders existing_founder; no credentials/authorization probe' })),
      ...['create', 'update', 'delete', 'send_email', 'save_contact', 'backend_persistence', 'authorization', 'keyboard_journey', 'native_browser_zoom', 'assistive_technology'].map((operation) => ({ dimension: 'operation', value: operation, status: 'not_tested', reason: 'Read-only navigation and rendering probe' })),
    ],
    reflowNote: '320 CSS px and 720 CSS px are viewport simulations of 400%/200% reflow, NOT native browser zoom.',
    reducedMotionNote: 'Only supplemental rows explicitly marked motion=reduce request reduced motion; preference detection is not proof animations obey it.',
    postCheckpointChangeNote: 'Annotations identify historical measured findings affected by later source fixes; original checkpoint statuses/tally are deliberately unchanged. A separate targeted feed axe check was reported zero after SideNav fix; other affected pages are not retested here.',
    sourceRouteCount: routes.length, dynamicCases, dynamicTemplates,
    legacyEvidence: [{ route: '/events/event-mixer', checkpoint: 'matrix-evidence/390/el/light/events__event-mixer.json', status: 'historical_misclassified_as_known_fixture', note: 'Search suggestion ID; not a PREVIEW_EVENTS fixture. Old fallback served the first event.' }],
    tally, cells, supplemental,
  });
  return tally;
}
function overview() {
  if (matrix) return matrixOverview();
  const rows = routes.map((route) => {
    const file = evidencePath(route);
    if (!existsSync(file)) return { requestedRoute: route, status: 'not_tested' };
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch (e) { return { requestedRoute: route, status: 'invalid_checkpoint', error: String(e) }; }
  });
  const tally = Object.fromEntries([...new Set(rows.map((r) => r.status))].map((status) => [status, rows.filter((r) => r.status === status).length]));
  atomic(join(out, `results-${width}.json`), { generatedAt: new Date().toISOString(), width, base, requestedRole, roleNote: 'Demo mode fixes rendered role to existing_founder; cookie alone does not establish authorization.', sourceRouteCount: routes.length, tally, rows });
  return tally;
}
async function preflight() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${base}/login`, { signal: controller.signal });
    return response.status === 200 ? null : `GET /login returned ${response.status}`;
  } catch (error) { return `GET /login failed: ${error.message}`; }
  finally { clearTimeout(timer); }
}
if (matrix && flags['summary-only']) {
  console.log('Checkpoint tally:', overview());
} else {
const down = await preflight();
if (down) {
  atomic(join(out, matrix ? 'matrix-availability.json' : `availability-${width}.json`), { at: new Date().toISOString(), base, error: down, browserNotStarted: true, width, locale, theme });
  console.error(`Preview unavailable; stopped without navigating: ${down}`);
  overview();
  process.exitCode = 2;
} else {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: flags.browser ?? '/repl/tools/bin/chromium' });
    const pending = selectedRoutes.filter((route) => {
      if (flags.route && flags.route !== route) return false;
      const path = evidencePath(route);
      if (!existsSync(path)) return true;
      if (flags['retry-incomplete']) {
        try {
          const previous = JSON.parse(readFileSync(path, 'utf8'));
          return ['loading', 'navigation_or_measurement_failure', 'invalid_checkpoint', 'infrastructure_failure', 'preference_mismatch', 'locale_mismatch'].includes(previous.status)
            || previous.consoleErrors?.some((error) => /502 \(Bad Gateway\)|Failed to load chunk/.test(error));
        }
        catch { return true; }
      }
      if (flags['retry-failed']) {
        try { return JSON.parse(readFileSync(path, 'utf8')).status !== 'pass'; } catch { return true; }
      }
      return false;
    }).slice(0, limit);
    let failuresInARow = 0;
    for (const route of pending) {
      const unavailable = await preflight();
      if (unavailable) {
        atomic(join(out, matrix ? 'matrix-availability.json' : `availability-${width}.json`), { at: new Date().toISOString(), base, error: unavailable, stoppedBeforeRoute: route, width, locale, theme });
        console.error(`Preview unavailable before ${route}: ${unavailable}`);
        break;
      }
      const row = {
        requestedRoute: route, sourceFile: routeMap.get(route) ?? dynamicCases.find((c) => c.route === route)?.sourceFile,
        fixtureRevision: matrix && !routeMap.has(route) ? fixtureRevision : null,
        routeType: routeMap.has(route) ? 'static' : 'dynamic',
        fixture: dynamicCases.find((c) => c.route === route)?.fixture ?? null,
        width, locale: matrix ? locale : 'unspecified', theme: matrix ? theme : 'unspecified',
        motion: matrix ? motion : 'unspecified', viewportType: reflow ? 'CSS viewport reflow simulation, NOT native zoom' : 'baseline', requestedRole,
        mode: 'synthetic preview demo (read-only navigation; no form submission)',
        startedAt: new Date().toISOString(), status: 'incomplete', actualFinalUrl: null,
        httpStatus: null, renderedRole: null, axe: { status: AxeBuilder ? 'not_run' : 'unavailable' },
        consoleErrors: [], pageErrors: [],
      };
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', colorScheme: 'dark', reducedMotion: motion });
      await context.addCookies([
        { name: 'cfb_session', value: 'preview-demo', domain: 'localhost', path: '/' },
        { name: 'cfb_primary_role', value: requestedRole, domain: 'localhost', path: '/' },
        { name: 'cfb_preview_demo', value: '1', domain: 'localhost', path: '/' },
      ]);
      await context.addInitScript(({ locale, theme, matrix }) => {
        localStorage.setItem('user', JSON.stringify({ id: 'preview-demo-user', email: 'demo@cofounderbay.com', role: 'founder', displayName: 'Alex Demo', firstName: 'Alex', lastName: 'Demo' }));
        localStorage.setItem('cfb_demo_data', '1');
        localStorage.setItem('accessToken', 'preview-demo');
        localStorage.setItem('cfb_cookie_consent', 'true');
        if (matrix) {
          localStorage.setItem('theme', theme);
          localStorage.setItem('cfb:primary-language', locale);
          localStorage.setItem('cfb:language-display', 'primary-only');
        }
      }, { locale, theme, matrix });
      const page = await context.newPage();
      page.on('pageerror', (e) => row.pageErrors.push(e.message.slice(0, 250)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') row.consoleErrors.push(msg.text().replace(/https?:\/\/[^\s)]+/g, '[URL]').slice(0, 250));
      });
      try {
        const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 35000 });
        row.httpStatus = response?.status() ?? null;
        // Wait for meaningful content rather than interpreting skeleton/loading as a pass.
        await page.waitForFunction(() => {
          const main = document.querySelector('#main-content, main') || document.body;
          const text = main?.innerText?.trim() || '';
          const loading = [...document.querySelectorAll('[role="status"],[aria-busy="true"],[class*="skeleton" i]')]
            .some((el) => el.getClientRects().length && /loading|φορτών|skeleton/i.test((el.innerText || el.className || '').toString()));
          return text.split(/\s+/).length >= 20 && !loading;
        }, null, { timeout: 12000 }).catch(() => {});
        // Palette transitions briefly interpolate low-contrast colors after
        // hydration. Measure the settled state, not a mid-transition frame.
        await page.waitForTimeout(4200);
        row.actualFinalUrl = page.url();
        row.finalPath = new URL(page.url()).pathname;
        row.measurement = await page.evaluate(() => {
          const main = document.querySelector('#main-content, main') || document.body;
          const text = main?.innerText?.trim() || '';
          const headings = [...document.querySelectorAll('h1')].filter((el) => el.getClientRects().length).map((el) => el.innerText.trim().slice(0, 100));
          const loadingElements = [...document.querySelectorAll('[role="status"],[aria-busy="true"],[class*="skeleton" i]')].filter((el) => el.getClientRects().length).slice(0, 5).map((el) => (el.innerText || el.getAttribute('aria-label') || el.className || '').toString().slice(0, 70));
          const unnamed = [...document.querySelectorAll('button,a[href],input,select,textarea')].filter((el) => {
            if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden' || el.getAttribute('aria-hidden') === 'true') return false;
            if (el.tagName === 'INPUT' && el.type === 'hidden') return false;
            const label = el.labels?.length ? [...el.labels].map((l) => l.textContent).join(' ') : '';
            return !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || label || el.textContent || '').trim();
          }).slice(0, 15).map((el) => ({ tag: el.tagName.toLowerCase(), html: el.outerHTML.slice(0, 180) }));
          const de = document.documentElement;
          return {
            title: document.title.slice(0, 120), headings, wordCount: text.split(/\s+/).filter(Boolean).length,
            textExcerpt: text.slice(0, 220), loadingElements, bodyBusy: document.body.getAttribute('aria-busy'),
            htmlLang: de.lang, activeTheme: localStorage.getItem('theme'), themeClass: de.className, dataTheme: de.getAttribute('data-theme'),
            activeLocale: localStorage.getItem('cfb:primary-language'), languageDisplay: localStorage.getItem('cfb:language-display'),
            reducedMotionRequested: matchMedia('(prefers-reduced-motion: reduce)').matches,
            greekCharacters: (text.match(/[\u0370-\u03ff\u1f00-\u1fff]/g) || []).length,
            horizontalOverflowPx: Math.max(0, de.scrollWidth - de.clientWidth),
            unnamedVisibleControls: unnamed,
            renderedRoleCookie: document.cookie.match(/(?:^|;\s*)cfb_primary_role=([^;]+)/)?.[1] ?? null,
            roleSignals: [...document.querySelectorAll('[data-role], [data-primary-role]')].slice(0, 5).map((e) => ({ role: e.getAttribute('data-role'), primary: e.getAttribute('data-primary-role') })),
          };
        });
        row.renderedRole = row.measurement.renderedRoleCookie === 'existing_founder'
          ? 'existing_founder (preview-demo fixed role, not authorization proof)'
          : `unverified (cookie: ${row.measurement.renderedRoleCookie ?? 'absent'})`;
        if (matrix) {
          const cls = row.measurement.themeClass.split(/\s+/);
          const expectedClass = ['light', 'alliance', 'minimal'].includes(theme) ? 'light' : 'dark';
          row.preferenceApplied = {
            locale: row.measurement.htmlLang === locale,
            theme: cls.includes(expectedClass) && (
              ['dark', 'light'].includes(theme) ? row.measurement.dataTheme === null : row.measurement.dataTheme === theme
            ),
            reducedMotion: row.measurement.reducedMotionRequested === (motion === 'reduce'),
          };
        }
        row.loadingState = row.measurement.wordCount < 20 || !!row.measurement.bodyBusy || (row.measurement.loadingElements.length > 0 && row.measurement.wordCount < 45);
        if (row.httpStatus === 200 && !row.loadingState && AxeBuilder) {
          try {
            const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
            row.axe = { status: 'completed', violations: result.violations.map((v) => ({
              id: v.id, impact: v.impact, description: v.help, count: v.nodes.length,
              nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target, failureSummary: n.failureSummary?.slice(0, 250) })),
            })), incompleteCount: result.incomplete.length };
          } catch (error) { row.axe = { status: 'error', error: String(error).slice(0, 250) }; }
        }
        row.status = row.httpStatus !== 200
          ? matrix && row.fixture === 'missing_fixture' && row.httpStatus === 404 ? 'missing_fixture_http_404' : 'http_failure'
          : row.finalPath !== route ? 'redirect'
          : row.loadingState ? 'loading'
          : row.consoleErrors.some((error) => /502 \(Bad Gateway\)|Failed to load chunk/.test(error)) ? 'infrastructure_failure'
          : matrix && (row.measurement.activeTheme !== theme || !row.preferenceApplied.theme) ? 'preference_mismatch'
          : matrix && (row.measurement.activeLocale !== locale || !row.preferenceApplied.locale || !row.preferenceApplied.reducedMotion) ? 'preference_mismatch'
          : matrix && locale === 'el' && row.measurement.greekCharacters === 0 ? 'locale_mismatch'
          : row.pageErrors.length || row.consoleErrors.length || row.measurement.horizontalOverflowPx > 0 ||
            row.measurement.unnamedVisibleControls.length || row.axe.status === 'error' ||
            row.axe.violations?.length ? 'issue' : 'pass';
        if (matrix && row.fixture === 'missing_fixture' && row.status === 'pass') {
          row.status = 'missing_fixture_rendered';
          const knownCase = dynamicCases.find((c) => c.fixture === 'known_fixture' && c.sourceFile === row.sourceFile);
          if (knownCase && existsSync(evidencePath(knownCase.route))) {
            const known = JSON.parse(readFileSync(evidencePath(knownCase.route), 'utf8'));
            row.sameContentAsKnownFixture = row.measurement.textExcerpt === known.measurement?.textExcerpt
              && JSON.stringify(row.measurement.headings) === JSON.stringify(known.measurement?.headings);
            if (row.sameContentAsKnownFixture) row.status = 'missing_fixture_alias';
          }
        }
      } catch (error) {
        row.status = 'navigation_or_measurement_failure';
        row.error = String(error).slice(0, 400);
        row.actualFinalUrl = page.url();
      } finally {
        row.finishedAt = new Date().toISOString();
        mkdirSync(join(out, matrix ? 'matrix-evidence' : 'evidence', String(width), ...(matrix ? [locale, theme, ...(motion === 'reduce' ? ['reduce'] : [])] : [])), { recursive: true });
        if (existsSync(evidencePath(route))) {
          const history = join(out, matrix ? 'matrix-history' : 'history', String(width), ...(matrix ? [locale, theme, ...(motion === 'reduce' ? ['reduce'] : [])] : []));
          mkdirSync(history, { recursive: true });
          copyFileSync(evidencePath(route), join(history, `${key(route)}.${Date.now()}.json`));
        }
        atomic(evidencePath(route), row);
        await context.close();
      }
      console.log(`${width} ${route} ${row.status} HTTP=${row.httpStatus ?? '-'} final=${row.finalPath ?? row.actualFinalUrl}`);
      overview();
      if (row.httpStatus === 502 || row.httpStatus === 503 || row.status === 'navigation_or_measurement_failure') failuresInARow++;
      else failuresInARow = 0;
      if (failuresInARow >= 2) { console.error('Stopped after two consecutive server/navigation failures'); break; }
    }
  } finally {
    await browser?.close();
    console.log('Checkpoint tally:', overview());
  }
}
}