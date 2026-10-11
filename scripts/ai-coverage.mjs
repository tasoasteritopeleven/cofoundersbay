/**
 * AI coverage census: for every `page.tsx`, what the assistant can do there.
 *
 * Reads each page and the components it imports (two levels, `@/` and
 * relative paths) and records:
 *   controls — ids passed to `usePageControls` (filters, periods, commands)
 *   list     — whether it publishes its rows with `usePageList`
 *   rail     — whether it mounts a page rail (sections `open_rail_section` opens)
 *   askAi    — whether it renders inside `AppShell` (the header's Ask AI) or
 *              names its own `askAi` prompt
 *
 * A page is `operable` when it has controls or a published list, `askable`
 * when it only has the Ask AI seam, and `dark` when it has neither. Every page
 * that is not operable must carry a reason in `scripts/ai-coverage-reasons.json`;
 * `apps/web/src/lib/aiCoverage.test.ts` fails on one that has none, so a new
 * page cannot quietly ship out of the assistant's reach.
 *
 *   node scripts/ai-coverage.mjs            # table
 *   node scripts/ai-coverage.mjs --json     # rows as JSON
 *
 * Static presence, not proof: a control that is declared is not a control that
 * works. The page-controls tests and the e2e assistant spec cover that.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const WEB_SRC = join(REPO, 'apps/web/src');
const APP = join(WEB_SRC, 'app');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(WEB_SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// Shared infrastructure every page imports; scanning it would credit every
// page with controls that belong to the chrome.
const SKIP = /\/(components\/(ui|layout|common|providers|icons|brand)|lib|hooks|contexts)\//;

function gather(file, depth, seen) {
  if (seen.has(file)) return '';
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  if (depth === 0) return source;
  let text = source;
  for (const m of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const target = resolveImport(m[1], file);
    if (!target || SKIP.test(target.replace(/\\/g, '/'))) continue;
    text += '\n' + gather(target, depth - 1, seen);
  }
  return text;
}

function routeOf(file) {
  const rel = relative(APP, dirname(file)).replace(/\\/g, '/');
  const route = '/' + rel.split('/').filter((seg) => !/^\(.*\)$/.test(seg)).join('/');
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

export function census() {
  const rows = [];
  for (const file of walk(APP).sort()) {
    const text = gather(file, 2, new Set());
    const controls = new Set();
    for (const block of text.matchAll(/usePageControls\(\[([\s\S]*?)\]\);/g)) {
      for (const m of block[1].matchAll(/\bid:\s*[`'"]([a-z][\w-]*)/g)) controls.add(m[1]);
      for (const m of block[1].matchAll(/choiceControl\(\s*'([a-z][\w-]*)'/g)) controls.add(m[1]);
    }
    const list = /usePageList\(\[/.test(text);
    const rail = /\brail=\{/.test(text) || /<PageRail\b/.test(text);
    const askAi = /<AppShell\b/.test(text) || /\baskAi=/.test(text);
    const level = controls.size > 0 || list ? 'operable' : askAi ? 'askable' : 'dark';
    rows.push({ route: routeOf(file), file: relative(REPO, file).replace(/\\/g, '/'), controls: [...controls].sort(), list, rail, askAi, level });
  }
  return rows;
}

export function loadReasons() {
  const path = join(HERE, 'ai-coverage-reasons.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = census();
  const reasons = loadReasons();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows.map((r) => ({ ...r, reason: reasons[r.route] ?? null })), null, 2));
  } else {
    const by = (level) => rows.filter((r) => r.level === level);
    for (const r of rows) {
      const flags = [r.list ? 'list' : '', r.rail ? 'rail' : '', r.askAi ? 'ask' : ''].filter(Boolean).join(',');
      const why = r.level === 'operable' ? '' : reasons[r.route] ? ` — ${reasons[r.route]}` : ' — NO REASON';
      console.log(`${r.level.padEnd(8)} ${r.route.padEnd(34)} controls=${String(r.controls.length).padStart(2)} ${flags}${why}`);
    }
    console.log(`\npages ${rows.length} · operable ${by('operable').length} · askable ${by('askable').length} · dark ${by('dark').length} · unexplained ${rows.filter((r) => r.level !== 'operable' && !reasons[r.route]).length}`);
  }
}
