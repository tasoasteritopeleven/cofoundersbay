import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGE_RAIL_WIDTH } from './PageRailContext';

/**
 * The page rail is chrome of the same kind as the left sidebar.
 *
 * - One width: the panel and the main column's reserved margin both read
 *   `--page-rail-width`, so widening the rail can never leave the column
 *   reserving the old width (the panel would overlap the page, or a gap
 *   would open beside it).
 * - One surface: the panel and its strip wear the sidebar's translucent card,
 *   glass while they float, and a default card inside the rail drops its
 *   frame so sections read as groups on the surface, not cards on a card.
 */
// On Windows the checkout may be CRLF; the selectors we look for span line
// breaks, so read every source with line endings normalised to LF.
const src = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const css = src('src/app/globals.css');
const shell = src('src/components/layout/AppShell.tsx');
const rail = src('src/components/layout/PageRail.tsx');

describe('page rail width', () => {
  it('has one source, read by the panel and by the column beside it', () => {
    expect(PAGE_RAIL_WIDTH).toBe('var(--page-rail-width)');
    expect(shell).toContain("lg:mr-[calc(var(--page-rail-width)+3.25rem)]");
    expect(shell).not.toMatch(/lg:mr-\[\d+(\.\d+)?rem\]'\s*:\s*'lg:mr-\[3\.25rem\]/);
  });

  it('keeps 18.5rem at 1024px and widens from 1280px', () => {
    expect(css).toMatch(/--page-rail-width:\s*18\.5rem;/);
    expect(css).toMatch(/@media \(min-width: 1280px\) \{\s*:root \{ --page-rail-width: 22rem; \}/);
    expect(css).toMatch(/@media \(min-width: 1536px\) \{\s*:root \{ --page-rail-width: 24rem; \}/);
  });
});

describe('page rail surface', () => {
  it('marks both the panel and the strip as the rail surface', () => {
    expect(rail.match(/data-rail-surface=""/g)?.length).toBe(2);
    expect(rail).toContain("data-peek={peeked && !pinned ? 'true' : undefined}");
  });

  it('gives the rail and a peeking sidebar the same glass', () => {
    expect(css).toContain('[data-page-rail][data-peek] [data-rail-surface],\naside[data-peek]:not([data-page-rail]) {');
  });

  it('flattens only default cards inside the rail', () => {
    const flat = css.slice(css.indexOf('[data-rail-content] [data-surface="card"].bg-card {'));
    expect(flat).toMatch(/^\[data-rail-content\] \[data-surface="card"\]\.bg-card \{\s*background-color: transparent;\s*border-color: transparent;/);
  });
});
