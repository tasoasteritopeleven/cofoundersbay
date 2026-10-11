import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One section rhythm on every page-level stack (§29, Phase 4): the first
 * stack under `<AppShell>` spaces its sections with `space-y-6`; a `<Tabs>`
 * wrapper keeps `space-y-4` so the tab bar stays next to its panel. Pages
 * whose first child is a grid, a component or an expression set no stack
 * rhythm here and are not judged. Phase 4 normalised 39 pages by hand; 14
 * older ones it did not measure were still at 4 or 5 - this keeps the rule.
 */

/** Index of the `>` closing the JSX opening tag that starts at `start`. */
function tagEnd(src: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && src[i - 1] !== '=') return i;
  }
  return -1;
}

function firstStacks(file: string): { tag: string; spacing: string | null }[] {
  const src = readFileSync(file, 'utf8');
  const found: { tag: string; spacing: string | null }[] = [];
  let at = src.indexOf('<AppShell');
  while (at !== -1) {
    const end = tagEnd(src, at);
    if (end === -1) break;
    if (src[end - 1] !== '/') {
      let i = end + 1;
      for (;;) {
        const rest = src.slice(i);
        const ws = rest.match(/^\s+/);
        if (ws) { i += ws[0].length; continue; }
        if (rest.startsWith('{/*')) { i = src.indexOf('*/}', i) + 3; continue; }
        break;
      }
      if (src[i] === '<') {
        const tag = src.slice(i, tagEnd(src, i) + 1);
        found.push({ tag: tag.match(/^<([A-Za-z.]+)/)?.[1] ?? '', spacing: tag.match(/\bspace-y-(\d+(?:\.5)?)\b/)?.[1] ?? null });
      }
    }
    at = src.indexOf('<AppShell', end);
  }
  return found;
}

describe('page rhythm', () => {
  // A shell grep would not run on Windows; walk the tree in-process instead.
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? walk(join(dir, d.name)) : d.name === 'page.tsx' ? [join(dir, d.name)] : [],
    );
  const pages = walk('src/app').filter((f) => readFileSync(f, 'utf8').includes('<AppShell'));

  it('finds the pages it judges', () => {
    expect(pages.length).toBeGreaterThan(100);
  });

  it('spaces the first stack under AppShell with space-y-6 (Tabs: space-y-4)', () => {
    const off: string[] = [];
    for (const page of pages) {
      for (const { tag, spacing } of firstStacks(page)) {
        if (spacing === null) continue;
        const want = tag === 'Tabs' ? '4' : '6';
        if (spacing !== want) off.push(`${page}: <${tag}> space-y-${spacing}`);
      }
    }
    expect(off).toEqual([]);
  });
});
