import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the order of the desktop type scale.
 *
 * The ladder is the cursor.com steps with +2% on 2xs–base (12.24 / 13.26 /
 * 14.28 / 16.32 / 18 / 20 / 24 / 26 / 36 / 48 / 60 / 72), written as rem
 * against the 82% desktop root. This test states the
 * invariant: rendered smallest to largest, every step is at least as large as
 * the one before it. It reads the CSS rather than a token file, because the
 * desktop scale only exists as @media (min-width: 1024px) overrides, and it
 * resolves rem against the 82% root that the same file declares.
 *
 * What it does not do: prove real-browser layout, or that any given element
 * carries the class the scale assumes. Only that the ladder ascends.
 */

const CSS_PATH = 'src/app/globals.css';
const CSS = readFileSync(CSS_PATH, 'utf8');

/** Browsers resolve a percentage root against their own default of 16px. */
const BROWSER_DEFAULT_PX = 16;

/** Cursor.com caption size — the documented legibility minimum. */
const MIN_TYPE_PX = 12;

/** Ascending. `base` sits where Tailwind puts it, between `sm` and `lg`. */
const STEPS = ['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'] as const;

/** Destinations on the rail share the ui step (xs and sm). */
const EQUAL_ALLOWED = new Set(['2xs->xs', 'xs->sm']);

/** Extracts the `min-width: 1024px` block that contains a given rule. */
function desktopBlock(marker: string): string {
  const opener = /@media\s*\(min-width:\s*1024px\)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = opener.exec(CSS)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < CSS.length && depth > 0) {
      if (CSS[i] === '{') depth += 1;
      else if (CSS[i] === '}') depth -= 1;
      i += 1;
    }
    const body = CSS.slice(start, i - 1);
    if (body.includes(marker)) return body;
  }

  throw new Error(`No min-width:1024px block contains ${marker} in ${CSS_PATH}`);
}

/**
 * Reads one declaration off one rule. The selector is anchored to the start of
 * its line so `.text-lg` cannot be satisfied by `aside .text-lg`, and so
 * `.text-xl` cannot be satisfied by `.sm\:text-xl`.
 */
function declaration(block: string, selector: string, property: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`^[ \\t]*${escaped}[ \\t]*\\{([^}]*)\\}`, 'm').exec(block);
  if (!rule) return undefined;
  return new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`, 'm').exec(rule[1])?.[1]?.trim();
}

/** Resolves `1.2rem`, `13px` or `max(1.2rem, 13px)` into rendered pixels. */
function toPx(value: string, rootPx: number): number {
  const bounded = /max\(\s*([\d.]+)rem\s*,\s*([\d.]+)px\s*\)/.exec(value);
  if (bounded) return Math.max(Number(bounded[1]) * rootPx, Number(bounded[2]));

  const rem = /^([\d.]+)rem$/.exec(value);
  if (rem) return Number(rem[1]) * rootPx;

  const px = /^([\d.]+)px$/.exec(value);
  if (px) return Number(px[1]);

  throw new Error(`Cannot resolve "${value}" to pixels`);
}

/** The 82% desktop root, read from the file instead of assumed. */
function desktopRootPx(): number {
  const percent = declaration(desktopBlock('html'), 'html', 'font-size');
  const parsed = /^([\d.]+)%$/.exec(percent ?? '');
  if (!parsed) throw new Error(`Could not read the desktop root font-size (got ${percent})`);
  return (Number(parsed[1]) / 100) * BROWSER_DEFAULT_PX;
}

const ROOT_PX = desktopRootPx();
const SCALE_BLOCK = desktopBlock('.text-2xs');

/** Rendered size of a ladder, in order, skipping steps that have no override. */
function ladder(prefix: string): Array<{ step: string; px: number }> {
  const out: Array<{ step: string; px: number }> = [];
  for (const step of STEPS) {
    const value = declaration(SCALE_BLOCK, `${prefix}.text-${step}`, 'font-size');
    if (value) out.push({ step, px: toPx(value, ROOT_PX) });
  }
  return out;
}

function assertAscending(steps: Array<{ step: string; px: number }>): void {
  const inversions: string[] = [];

  for (let i = 1; i < steps.length; i += 1) {
    const previous = steps[i - 1];
    const current = steps[i];
    const pair = `${previous.step}->${current.step}`;

    if (current.px < previous.px) {
      inversions.push(
        `text-${current.step} (${current.px.toFixed(3)}px) is smaller than text-${previous.step} (${previous.px.toFixed(3)}px)`,
      );
    } else if (current.px === previous.px && !EQUAL_ALLOWED.has(pair)) {
      inversions.push(
        `text-${current.step} and text-${previous.step} both render ${current.px.toFixed(3)}px, so the step does not exist`,
      );
    }
  }

  expect(inversions).toEqual([]);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

describe('desktop type scale', () => {
  it('renders the page ladder in ascending order', () => {
    assertAscending(ladder(''));
  });

  it('renders the sidebar rail ladder in ascending order', () => {
    // The rail overrides 2xs..xl and has no `text-2xl` of its own, so that step
    // falls through to the page's anchor. Its own ladder has to reach it in
    // order too, which is the inversion the rail originally shared.
    const rail = ladder('aside ');
    const anchor = declaration(SCALE_BLOCK, '.text-2xl', 'font-size');
    expect(anchor).toBeTruthy();
    assertAscending([...rail, { step: '2xl', px: toPx(anchor as string, ROOT_PX) }]);
  });

  it('keeps body copy no larger than the section heading above it', () => {
    const body = declaration(desktopBlock('body'), 'body', 'font-size');
    expect(body).toBeTruthy();

    const bodyPx = toPx(body as string, ROOT_PX);
    const headingPx = toPx(declaration(SCALE_BLOCK, '.text-lg', 'font-size') as string, ROOT_PX);

    expect(bodyPx).toBeLessThanOrEqual(headingPx);
  });

  it('holds every desktop step at or above the 11px legibility floor', () => {
    const tooSmall = [...ladder(''), ...ladder('aside ')]
      .filter((entry) => entry.px < MIN_TYPE_PX)
      .map((entry) => `text-${entry.step} renders ${entry.px.toFixed(3)}px`);

    expect(tooSmall).toEqual([]);
  });

  it('overrides every responsive type variant the product uses', () => {
    // Unprefixed overrides do not apply to `sm:text-sm`, so any variant left
    // unlisted silently falls back to the raw Tailwind scale against the 82%
    // root -- which is how `sm:text-xs` came to render at 9.84px.
    const used = new Set<string>();
    const variant = /\b(sm|md|lg|xl|2xl):text-(2xs|xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/g;

    for (const file of walk('src')) {
      for (const match of readFileSync(file, 'utf8').matchAll(variant)) {
        used.add(`${match[1]}:text-${match[2]}`);
      }
    }

    const missing = [...used]
      .filter((name) => !declaration(SCALE_BLOCK, `.${name.replace(':', '\\:')}`, 'font-size'))
      .sort();

    expect(missing).toEqual([]);
  });

  it('finds the rules it claims to guard', () => {
    // Every assertion above is vacuous if the parse silently returns nothing.
    expect(ROOT_PX).toBeGreaterThan(0);
    expect(ROOT_PX).toBeLessThan(BROWSER_DEFAULT_PX);
    expect(ladder('').map((entry) => entry.step)).toEqual([...STEPS]);
    expect(ladder('aside ').length).toBeGreaterThanOrEqual(6);
    expect(walk('src').length).toBeGreaterThan(100);
  });
});
