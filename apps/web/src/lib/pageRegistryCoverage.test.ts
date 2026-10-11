import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_REGISTRY, getPageMeta } from './page-registry';

/**
 * Every route must be in the registry.
 *
 * `getPageMeta` is what gives a page its identity — the header, the breadcrumb,
 * the contextual help, and the description the assistant reads when it is asked
 * what a page is or whether to navigate there. A route missing from the registry
 * is invisible to all four. Forty-nine were, which is why this test exists:
 * the registry is hand-maintained data next to a directory that grows, and data
 * like that drifts silently unless something fails.
 */
const APP_DIR = join(__dirname, '..', 'app');

/** Route-group folders like `(auth)` shape the filesystem, not the URL. */
const stripGroups = (route: string) => route.replace(/\/\([^)]+\)/g, '') || '/';

function routesWithPages(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'page.tsx') out.push(stripGroups(prefix) || '/');
    else if (statSync(full).isDirectory() && !entry.startsWith('_')) {
      out.push(...routesWithPages(full, `${prefix}/${entry}`));
    }
  }
  return out;
}

describe('page registry coverage', () => {
  const routes = [...new Set(routesWithPages(APP_DIR))];

  it('finds the app routes at all', () => {
    // Guards the walker itself: a wrong APP_DIR would make every other
    // assertion below pass vacuously.
    expect(routes.length).toBeGreaterThan(100);
  });

  it('has an entry for every route that has a page', () => {
    const declared = new Set(PAGE_REGISTRY.map((p) => p.path));
    const missing = routes.filter((r) => !declared.has(r)).sort();
    expect(missing, 'routes with a page.tsx and no PAGE_REGISTRY entry').toEqual([]);
  });

  it('has no entry pointing at a route that no longer exists', () => {
    const live = new Set(routes);
    const stale = PAGE_REGISTRY.map((p) => p.path).filter((p) => !live.has(p)).sort();
    expect(stale, 'PAGE_REGISTRY entries with no page.tsx').toEqual([]);
  });

  it('gives every entry a title and a description', () => {
    const thin = PAGE_REGISTRY
      .filter((p) => !p.title?.trim() || !p.description?.trim())
      .map((p) => p.path);
    expect(thin, 'entries missing a title or description').toEqual([]);
  });

  it('keeps workspace page descriptions independent of demonstration company facts', () => {
    for (const path of ['/builder/applications', '/fundraising', '/ai']) {
      const page = getPageMeta(path);
      expect(page).toBeTruthy();
      expect(`${page?.description} ${page?.descriptionEl}`).not.toMatch(/Harbor|Athens Tech Angels|\$750K|\$375K/);
    }
  });

  it('resolves every route through getPageMeta, dynamic segments included', () => {
    // A `[param]` route is matched by pattern rather than by string equality,
    // so presence in the array is not proof the lookup finds it.
    const sample = routes.filter((r) => r.includes('['));
    const unresolved = sample.filter((r) => !getPageMeta(r)).sort();
    expect(unresolved, 'dynamic routes getPageMeta cannot resolve').toEqual([]);
  });
});
