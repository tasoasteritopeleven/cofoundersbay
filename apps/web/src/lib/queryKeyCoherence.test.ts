import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One API read, one cache prefix.
 *
 * `invalidateQueries({ queryKey: ['admin', 'reports'] })` refreshes every key
 * that starts with `['admin', 'reports']` and nothing else. Round 12 found 33
 * reads cached under two or more keys, and in a dozen of them the prefixes
 * differed: resolving a report on /admin/reports refreshed `['admin',
 * 'reports']` while the admin home counted from `['admin-reports']`;
 * archiving a programme refreshed `['admin', 'programs']` while /programs
 * read `['programs', ...]`; an organisation editing a programme refreshed
 * `['org', 'programs']` and left the founder's `['programs', 'my']` stale.
 * Each view showed the old number until its cache aged out.
 *
 * Each read now keeps one first segment everywhere it is cached - a
 * discriminating suffix where the arguments differ - so invalidating the
 * resource reaches every view of it. This fails when a new call site caches
 * a read under a different first segment.
 */

const SRC = 'src';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/** Reads that are genuinely different things despite sharing a function. */
const EXCEPTIONS: Record<string, string> = {
  // The endorsement dialog's recipient picker and the member directory are two
  // unrelated searches; no write refreshes either, and sharing a prefix would
  // only let one search's invalidation drop the other's results.
  searchProfiles: 'two unrelated searches',
};

/** `qk('root', ...)` and `queryKeys.x...` resolve to their literal first segment. */
function firstSegment(key: string): string {
  const built = key.match(/^qk\(\s*'([^']+)'/);
  if (built) return built[1];
  const factory = key.match(/^queryKeys\.(\w+)/);
  if (factory) {
    const source = readFileSync('src/lib/query-keys.ts', 'utf8');
    const direct = source.match(new RegExp(`\\b${factory[1]}:\\s*(?:\\[|qk\\(|\\(\\)\\s*=>\\s*qk\\()\\s*'([^']+)'`));
    if (direct) return direct[1];
    const assigned = source.match(new RegExp(`const ${factory[1]}\\s*=\\s*Object\\.assign\\((?:\\[|qk\\()\\s*'([^']+)'`));
    if (assigned) return assigned[1];
    if (factory[1] === 'connectionsPending') return 'connections';
    return factory[1];
  }
  return key.match(/^\[\s*'([^']+)'/)?.[1] ?? key;
}

const USE_QUERY =
  /useQuery\(\{\s*queryKey:\s*(\[[^\]\n]*\]|qk\([^)\n]*\)|queryKeys\.[\w.()]+)\s*,\s*\n?\s*queryFn:\s*(?:\(\)\s*=>\s*)?(?:async\s*\(\)\s*=>\s*)?\{?\s*(?:return\s+)?(?:await\s+)?([a-z]\w*)\s*[(,\n]/g;

describe('query key coherence', () => {
  const byRead = new Map<string, Map<string, string[]>>();
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(USE_QUERY)) {
      const [, key, read] = m;
      // A block body (`queryFn: async () => { if (...) ... }`) is not a read.
      if (['if', 'const', 'let', 'return', 'await', 'try', 'async', 'function'].includes(read)) continue;
      const prefix = firstSegment(key);
      if (!byRead.has(read)) byRead.set(read, new Map());
      const prefixes = byRead.get(read)!;
      if (!prefixes.has(prefix)) prefixes.set(prefix, []);
      prefixes.get(prefix)!.push(file.replace(/\\/g, '/'));
    }
  }

  it('reads the queries it is meant to check', () => {
    expect(byRead.size).toBeGreaterThan(100);
  });

  it('caches each API read under one first key segment', () => {
    const offenders: string[] = [];
    for (const [read, prefixes] of byRead) {
      if (prefixes.size < 2 || EXCEPTIONS[read]) continue;
      offenders.push(`${read}: ${[...prefixes].map(([p, files]) => `'${p}' (${files.join(', ')})`).join(' vs ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
