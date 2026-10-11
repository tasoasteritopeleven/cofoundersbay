/**
 * Which pages need a page rail, measured rather than guessed.
 *
 * A rail earns its 52px when a page's main column carries several *families*
 * of supporting controls - things that are about the page rather than the
 * page itself. On a page with one family the rail is a strip and a click to
 * reach what a single inline control showed for free, which is why the rail
 * contract (pageRailContract.test.ts) refuses fewer than two sections.
 *
 * For every page.tsx (following one level of delegation to a *Content /
 * *Workspace / *Client component), the script counts controls and detects
 * families from the source:
 *
 *   filters    search inputs, filter selects, status/type chips
 *   views      grid/list switches, sort controls, tab rows of 5+
 *   export     export / download / print / share
 *   settings   preferences, toggles, thresholds, page-level options
 *   summary    rows of stat / KPI cards above the main content
 *   help       inline tips, "how it works", resource lists
 *
 * Output: one row per page, controls, families, and whether a rail exists.
 * Pages with 3+ families and no rail are the candidates, heaviest first.
 *
 *   node scripts/rail-candidates.mjs            # ranked table
 *   node scripts/rail-candidates.mjs --json     # machine-readable
 *
 * Static and heuristic: it reads what a page *declares*, not what renders for
 * a given user. The numbers in docs/PLATFORM_DESIGN_AI_PLAN.md §22 come from
 * this script; a page can still be argued in or out with a reason.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const APP = join(ROOT, 'apps/web/src/app');
const SRC = join(ROOT, 'apps/web/src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'api') walk(p, out); }
    else if (e === 'page.tsx') out.push(p);
  }
  return out;
}

/** Follow one level of delegation so a 13-line page is measured by what it renders. */
function sourceFor(pagePath) {
  let src = readFileSync(pagePath, 'utf8');
  const lines = src.split('\n').length;
  if (lines > 60) return src;
  const m = src.match(/import\s+(?:\{\s*)?([A-Z][A-Za-z]+)(?:\s*\})?\s+from\s+'([^']+)'/g) || [];
  for (const imp of m) {
    const [, name, spec] = imp.match(/import\s+(?:\{\s*)?([A-Z][A-Za-z]+)(?:\s*\})?\s+from\s+'([^']+)'/);
    if (!/Content|Workspace|Client|Home|View|Dashboard|Page|Screen|Panel/.test(name)) continue;
    let file = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : resolve(dirname(pagePath), spec);
    for (const cand of [file + '.tsx', join(file, 'index.tsx'), file]) {
      if (existsSync(cand) && statSync(cand).isFile()) { src += '\n' + readFileSync(cand, 'utf8'); break; }
    }
  }
  return src;
}

const count = (src, re) => (src.match(re) || []).length;

function measure(src) {
  const controls =
    count(src, /<(Button|Input|Select|Textarea|Switch|Checkbox|TabsTrigger|DropdownMenuItem|SelectItem)\b/g) +
    count(src, /<button\b/g) + count(src, /<select\b/g) + count(src, /<input\b/g);

  const families = {
    filters: /placeholder=\{?["'`][^"'`]*(Search|Αναζήτ|Filter|Φίλτρ)|<Select\b[\s\S]{0,200}(status|type|category|stage|priority|role)|setFilter|Filter\s*=\s*useState|filter(ed)?\w*\s*=\s*useState|(status|type|category|stage)Filter/i.test(src),
    views: /viewMode|setView(Mode)?|['"](grid|list)['"]\s*\)|LayoutGrid|List\b.*icon|sortBy|setSort|(?:<TabsTrigger[\s\S]*?){5,}/i.test(src),
    export: /export(Csv|CSV|Data|Report)|Download\b|handleExport|onExport|window\.print|navigator\.share|Share2/.test(src),
    settings: /<Switch\b|Preferences|preferences|threshold|setting(s)?\b.*useState|Settings\b.*icon-sm/.test(src),
    summary: (count(src, /<StatCard\b/g) >= 3) || /grid[^"]*(sm:grid-cols-2|md:grid-cols-4|lg:grid-cols-4|xl:grid-cols-6)[\s\S]{0,600}<Card\b[\s\S]{0,400}<Card\b[\s\S]{0,400}<Card\b/.test(src),
    help: /HelpCallout|SampleDataNotice|Resources|Πόροι|How it works|Πώς λειτουργεί|Tips\b|Συμβουλές/.test(src),
  };
  const present = Object.entries(families).filter(([, v]) => v).map(([k]) => k);
  const hasRail = /rail=\{|<PageRail\b|PageRailSection/.test(src);
  return { controls, families: present, hasRail };
}

const rows = walk(APP).map((p) => {
  const route = '/' + p.slice(APP.length + 1).replace(/\\/g, '/').replace(/\/page\.tsx$/, '').replace(/\(auth\)\//, '');
  return { route: route === '/page.tsx' ? '/' : route, ...measure(sourceFor(p)) };
});

/*
 * Pages the heuristic flags that were looked at and argued out. Each reason
 * says why the families it counted are the page's content rather than
 * controls about it. A page leaves this list when it changes shape.
 */
const DECLINED = {
  '/org/settings': 'a settings form: its selects and toggles are the page, not options on it',
  '/admin/feature-flags': 'the stat strip mirrors the tabs one-for-one, so the tabs already are the filter',
  '/dashboard/incubator': 'a dashboard: the summary cards are the content',
  '/discover': 'a search page: the filters are how it is used',
  '/help': 'a help centre: search and categories are the content',
  '/groups/manage': 'one three-number strip and a search; a rail would be one thin section',
};

rows.sort((a, b) => b.families.length - a.families.length || b.controls - a.controls);
const declined = rows.filter((r) => r.families.length >= 3 && !r.hasRail && DECLINED[r.route]);
const candidates = rows.filter((r) => r.families.length >= 3 && !r.hasRail && !DECLINED[r.route]);
const done = rows.filter((r) => r.hasRail);
const calm = rows.filter((r) => r.families.length < 3 && !r.hasRail);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ candidates, declined: declined.map((r) => ({ ...r, reason: DECLINED[r.route] })), done, calm: calm.length, total: rows.length }, null, 1));
} else {
  console.log(`pages ${rows.length} · with rail ${done.length} · candidates (3+ families, no rail) ${candidates.length} · declined ${declined.length} · calm ${calm.length}\n`);
  console.log('route'.padEnd(40), 'ctrl', 'fam', 'families');
  for (const r of candidates) console.log(r.route.padEnd(40), String(r.controls).padStart(4), String(r.families.length).padStart(3), r.families.join(','));
  console.log('\n-- declined, with reason --');
  for (const r of declined) console.log(r.route.padEnd(40), DECLINED[r.route]);
  console.log('\n-- already railed --');
  for (const r of done) console.log(r.route.padEnd(40), String(r.controls).padStart(4), String(r.families.length).padStart(3), r.families.join(','));
}
