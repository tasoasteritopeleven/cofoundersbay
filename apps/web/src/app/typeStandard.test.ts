import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One type standard for every page in the shell.
 *
 * Overview, Readiness and Analytics used to keep their own ladder behind a
 * `data-type-lock` attribute while every other page was remapped onto a
 * flatter five-size cluster (title 15.42, sections 14.28). Every page now
 * shares the steps tuned on those three:
 *
 *   caption 12.24 · meta 12.87 · body 13.86 · figure 15.27 · section 16.49 · title 17.46
 *
 * This reads the CSS, resolves rem against the root each breakpoint uses,
 * and checks that the Tailwind steps and the named roles land on those
 * steps. The figure, section and title roles themselves are guarded by
 * pageChromeType.test.ts.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const APP_SHELL = readFileSync('src/components/layout/AppShell.tsx', 'utf8');
const PAGE_RAIL = readFileSync('src/components/layout/PageRail.tsx', 'utf8');

const PHONE_ROOT_PX = 16;
const DESKTOP_ROOT_PX = 0.82 * 16;

const STEP = { caption: 12.2412, meta: 12.8661, body: 13.8558, section: 16.4875, title: 17.4636 };

function toPx(value: string, rootPx: number): number {
  const parts = /^max\((.+)\)$/.exec(value)?.[1].split(',') ?? [value];
  return Math.max(
    ...parts.map((part) => {
      const token = part.trim();
      const rem = /^([\d.]+)rem$/.exec(token);
      if (rem) return Number(rem[1]) * rootPx;
      const px = /^([\d.]+)px$/.exec(token);
      if (px) return Number(px[1]);
      throw new Error(`Cannot resolve "${token}"`);
    }),
  );
}

/** The CSS between two markers, split at its desktop media query. */
function section(from: string, to: string): { phone: string; desktop: string } {
  const start = CSS.indexOf(from);
  const end = CSS.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`Missing ${from} … ${to} in globals.css`);
  const text = CSS.slice(start, end);
  const split = text.indexOf('@media (min-width: 1024px)');
  if (split < 0) throw new Error(`No desktop block between ${from} and ${to}`);
  return { phone: text.slice(0, split), desktop: text.slice(split) };
}

/** font-size of the first rule whose selector list names `selector` exactly. */
function fontSize(source: string, selector: string): string {
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').map((s) => s.trim()).includes(selector)) continue;
    const value = /font-size:\s*([^;]+);/.exec(body)?.[1];
    if (value) return value.trim();
  }
  throw new Error(`No font-size for ${selector}`);
}

const LADDER = section('#main-content .text-2xs {', '#main-content .text-xl,');
const ROLES = section('.type-caption {', '#main-content .score-emblem-figure');

describe('product type standard', () => {
  it('has no per-page type split', () => {
    expect(CSS).not.toContain('data-type-lock');
    expect(APP_SHELL).not.toContain('data-type-lock');
    expect(PAGE_RAIL).not.toContain('data-type-lock');
    expect(CSS).not.toMatch(/\.type-(hold|kicker)\b/);
  });

  it('has no leftover hold/kicker class names in source', () => {
    // A plain walk rather than `fs.globSync`, which Node 20 - still within
    // the engines range - does not have.
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.(ts|tsx|css)$/.test(entry) && !entry.includes('.test.') ? [full] : [];
      });
    const hits = ['src/app', 'src/components', 'src/lib']
      .flatMap(walk)
      .filter((path) => /type-hold|type-kicker/.test(readFileSync(path, 'utf8')))
      .map((path) => path.replace(/\\/g, '/'));
    expect(hits).toEqual([]);
  });

  it.each([
    ['phone', LADDER.phone, PHONE_ROOT_PX],
    ['desktop', LADDER.desktop, DESKTOP_ROOT_PX],
  ] as const)('lands every Tailwind step on a standard step (%s)', (_, source, root) => {
    const px = (selector: string) => toPx(fontSize(source, selector), root);

    expect(px('#main-content .text-2xs')).toBeCloseTo(STEP.caption, 2);
    expect(px('#main-content .text-xs')).toBeCloseTo(STEP.meta, 2);
    expect(px('#main-content .sm\\:text-xs')).toBeCloseTo(STEP.meta, 2);
    expect(px("#main-content [role='tab']")).toBeCloseTo(STEP.meta, 2);
    expect(px('#main-content .text-sm')).toBeCloseTo(STEP.body, 2);
    expect(px('#main-content .sm\\:text-sm')).toBeCloseTo(STEP.body, 2);
    expect(px('#main-content .text-base')).toBeCloseTo(STEP.section, 2);
    expect(px('#main-content .text-lg')).toBeCloseTo(STEP.section, 2);
    expect(px('#main-content h2.page-section')).toBeCloseTo(STEP.section, 2);
    expect(px('#main-content [data-rail-content] .text-lg')).toBeCloseTo(STEP.body, 2);
  });

  it.each([
    ['phone', ROLES.phone, PHONE_ROOT_PX],
    ['desktop', ROLES.desktop, DESKTOP_ROOT_PX],
  ] as const)('puts the named roles inside the page on the same steps (%s)', (_, source, root) => {
    const px = (selector: string) => toPx(fontSize(source, selector), root);

    expect(px('#main-content .type-caption')).toBeCloseTo(STEP.caption, 2);
    expect(px('#main-content .type-support')).toBeCloseTo(STEP.meta, 2);
    expect(px('#main-content .type-ui')).toBeCloseTo(STEP.meta, 2);
    expect(px('#main-content .type-identity')).toBeCloseTo(STEP.body, 2);
    expect(px('#main-content .type-page')).toBeCloseTo(STEP.title, 2);
  });

  it('keeps headings semibold and never reaches for black weights', () => {
    // The weight ladder (AGENTS.md): body normal, labels medium, headings and
    // figures semibold, bold only for tabular figures. Seventeen headings on
    // the landing, pricing and Alliance pages had drifted to bold, and two
    // match figures to black - heavier than any face the display font loads.
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return entry.endsWith('.tsx') && !entry.includes('.test.') ? [full] : [];
      });
    const offenders = ['src/app', 'src/components'].flatMap(walk).flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      const rel = path.replace(/\\/g, '/');
      return [
        ...[...text.matchAll(/<h[1-3]\b[^>]*className="[^"]*\bfont-(bold|extrabold|black)\b/g)].map(() => `${rel}: bold heading`),
        ...[...text.matchAll(/\bfont-(extrabold|black)\b/g)].map((m) => `${rel}: ${m[0]}`),
      ];
    });
    expect(offenders).toEqual([]);
  });

  it('keeps the SideNav mode switcher on its own chrome caption', () => {
    expect(fontSize(ROLES.phone, '.type-caption')).toBe('12.61px');
  });

  it('declares each override after the step it overrides', () => {
    for (const source of [LADDER.phone, LADDER.desktop]) {
      // `text-base sm:text-sm` (inputs, selects) resolves to the sm step.
      expect(source.indexOf('#main-content .sm\\:text-sm')).toBeGreaterThan(source.indexOf('#main-content .text-base'));
      // The tab trigger also carries `text-sm`.
      expect(source.indexOf("#main-content [role='tab']")).toBeGreaterThan(source.indexOf('#main-content .text-sm'));
    }
    // `text-lg sm:text-xl` still reaches the title step from `sm` up.
    expect(CSS.indexOf('#main-content .text-lg')).toBeLessThan(CSS.indexOf('#main-content .sm\\:text-xl'));
  });
});
