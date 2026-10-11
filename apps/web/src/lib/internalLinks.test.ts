import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every internal link lands on a route that exists.
 *
 * A sweep found 47 links to 23 routes the app never had: every event card
 * pointed at /events/:id, the investor board at /startups/:id, the public
 * programmes list at /programs/:id, "Schedule Session" at
 * /mentor/sessions/new, the role guard's redirect at /unauthorized. Each was a
 * 404 at the end of a click that looked like it worked. They now go to real
 * pages (some new, some existing); this keeps it that way.
 *
 * Reads `href=`, `router.push(` and `router.replace(` with a literal or
 * template path, and `href:` in data (nav arrays, footers, assistant
 * citations: the landing footer's /about, /blog and /contact and the
 * assistant's /opportunities/:id hid there), substitutes `${...}` with a
 * placeholder segment, and matches
 * the result against the `page.tsx` tree (a `[param]` directory matches any
 * one segment; `(group)` directories add none). Query strings and fragments
 * are ignored. A path that *starts* with an interpolation is skipped - it is
 * someone else's URL.
 */

const APP = 'src/app';
const SRC = 'src';

function walk(dir: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, match));
    else if (match(entry)) out.push(full);
  }
  return out;
}

const routePatterns = walk(APP, (n) => n === 'page.tsx').map((file) => {
  const route = file
    .replace(/\\/g, '/')
    .slice(APP.length)
    .replace(/\/page\.tsx$/, '')
    .replace(/\/\([^)]*\)/g, '');
  const segments = route.split('/').filter(Boolean);
  const body = segments
    .map((s) => (s.startsWith('[') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^/${body}/?$`);
});

const LINK = /(?:href|push|replace)\s*[=(:]\s*\{?\s*(["'`])(\/[^"'`]*)\1/g;
/** A file under `public/` (an icon, a manifest), not a route. */
const ASSET = /\.[a-z0-9]{2,5}$/i;

function exists(path: string): boolean {
  return routePatterns.some((re) => re.test(path));
}

describe('internal links', () => {
  it('knows the route tree', () => {
    expect(routePatterns.length).toBeGreaterThan(100);
    expect(exists('/events/abc')).toBe(true);
    expect(exists('/definitely/not/here')).toBe(false);
  });

  it('points every link at a route that exists', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, (n) => /\.tsx?$/.test(n) && !n.includes('.test.'))) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(LINK)) {
        const raw = m[2];
        if (raw.startsWith('/api/') || raw.startsWith('/_next') || raw.startsWith('//')) continue;
        const path = raw.replace(/\$\{[^}]*\}/g, 'X').split('?')[0].split('#')[0];
        if (!path || path.startsWith('/X') || ASSET.test(path)) continue;
        if (!exists(path)) {
          const line = source.slice(0, m.index ?? 0).split('\n').length;
          offenders.push(`${file.replace(/\\/g, '/')}:${line} -> ${path}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
