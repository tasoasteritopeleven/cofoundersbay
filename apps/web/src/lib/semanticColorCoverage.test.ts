import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the semantic-colour contract for surfaces that follow the theme.
 *
 * The research/canvas panels sit on `bg-card` / `bg-secondary` / `bg-muted`,
 * all of which change with the theme — but they had been painted with fixed
 * Tailwind palette shades (`text-emerald-400`, `bg-amber-400/5`, …) chosen as if
 * the background were permanently dark. Measured against the real light-theme
 * surfaces, every one of those failed WCAG AA: contrast ran 1.45–2.72 where 4.5
 * is required. The semantic tokens land at 4.32–9.07 because they carry a
 * separate value per theme.
 *
 * This test fails if a raw palette shade reappears in those files, so the class
 * of defect cannot be reintroduced by a later edit.
 */

/*
 * The whole product, not one directory.
 *
 * This guarded `src/components/research` alone, because that is where the
 * repaint happened; everywhere else kept 382 raw shades across 75 files
 * because nothing was looking. A `bg-emerald-500` is 84% saturation where the
 * success token is 32% - not a different shade of the same idea, a colour
 * chosen without reference to the theme, which is exactly what competes with
 * it. They are mapped onto the tones now, so the rule can cover what it was
 * always right about.
 */
const GUARDED_DIRS = ['src/app', 'src/components'];

/**
 * Identity palettes are a different problem and the status tones are the wrong
 * tool for them. A tag category or a copilot mode is coded by hue so the user can
 * tell one from another at a glance; there are more of those than the six
 * semantic tones, so mapping them onto the tones makes distinct things look
 * identical — `strategy` and `pitch` both became "accent", `product` collided
 * with `research`. A line opts out by carrying this marker, which keeps every
 * exception visible in review instead of silently absent from the sweep.
 */
const OPT_OUT = 'categorical-palette';

/** Files whose whole colour vocabulary is categorical and already theme-aware. */
const OPT_OUT_FILES = [
  'NodeTagsEditor.tsx',       // tag categories, one hue each
  'ContributionGraph.tsx',    // a sequential heatmap: the ramp is the reading
  'CanvasCopilotPanel.tsx',   // copilot modes, one hue each
  'themes/alliance/page.tsx', // a theme preview, built from gradients
  'themes/alliance/loading.tsx', // its skeleton, same gradients
];

const RAW_PALETTE =
  /\b(?:hover:|focus:|group-hover:|dark:)?(?:text|bg|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g;

/** Neutral ramps are still legitimate for hairlines/overlays; only hues are guarded. */
const ALLOWED = /-(?:slate|gray|zinc|neutral|stone)-/;

/**
 * A quoted hex literal in a theme-aware component has the same defect as a raw
 * palette shade: it ignores the active theme entirely (`#4ade80` in the Mint
 * theme was a green that belonged to no palette). Only quoted strings are
 * matched, so `#333333` inside a comment does not count.
 *
 * The allowlist is places where a hex is the *point*, not a styling shortcut:
 * colour pickers (tenant/org branding forms), third-party brand marks
 * (Google/LinkedIn logos, share targets), the theme switcher's swatch previews,
 * the favicon and meta theme-color, presence cursors, and the canvas
 * user-content palettes (sticky notes, shape fills, node templates — colours a
 * user picked for their data, not chrome). Files inside `research/` and
 * `canvas/` hold those content palettes almost exclusively.
 */
const HEX_LITERAL = /["'`]#[0-9a-fA-F]{3,8}\b/g;

const HEX_GUARDED_DIRS = ['src/app', 'src/components', 'src/lib', 'src/hooks'];
const HEX_ALLOWLIST_DIRS = [
  'src/components/research/', 'src/components/canvas/', 'src/app/research/', 'src/lib/canvas/', 'src/lib/demo/',
];
const HEX_ALLOWLIST_FILES = [
  'src/app/icon.tsx',                    // favicon mark
  'src/app/layout.tsx',                  // meta theme-color, evaluated before hydration
  'src/app/settings/page.tsx',           // Google/LinkedIn sign-in logos
  'src/app/admin/tenants/page.tsx',      // tenant branding pickers
  'src/app/org/settings/page.tsx',       // org branding pickers
  'src/app/tenant/branding/page.tsx',    // org branding pickers
  'src/components/theme/ThemeSwitcher.tsx', // swatches preview each theme's own colours
  'src/components/ui/share-modal.tsx',   // X/LinkedIn/Facebook brand colours
  'src/pages/_error.tsx',                // legacy fallback, no theme context
  'src/hooks/useResearchCollaboration.ts', // presence cursors: one hue per user
  'src/lib/themes.ts',                   // theme identifiers and their own palettes
  'src/lib/chart-theme.ts',              // the chart palette definitions themselves
  'src/lib/preview-api.ts',              // demo content: sticky-note colours a user would pick
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe('semantic colour coverage', () => {
  it('keeps hue-bearing palette shades out of theme-aware panels', () => {
    const offenders: string[] = [];

    for (const dir of GUARDED_DIRS) {
      for (const file of walk(dir)) {
        // Compare on one spelling: walk() yields OS paths, and an opt-out
        // written with forward slashes never matches a Windows one.
        const unixPath = file.split('\\').join('/');
        if (OPT_OUT_FILES.some((n) => unixPath.endsWith(n))) continue;
        // Scan line by line so a single opted-out line does not exempt the file.
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          if (line.includes(OPT_OUT)) continue;
          for (const match of line.match(RAW_PALETTE) ?? []) {
            if (ALLOWED.test(match)) continue;
            offenders.push(`${file.replace(/\\/g, '/')}: ${match}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps quoted hex literals out of theme-aware UI', () => {
    const offenders: string[] = [];

    for (const dir of HEX_GUARDED_DIRS) {
      for (const file of walk(dir)) {
        const unixPath = file.split('\\').join('/');
        if (/\.test\.(tsx?|ts)$/.test(unixPath)) continue;
        if (HEX_ALLOWLIST_FILES.some((n) => unixPath.endsWith(n.replace(/^src\//, '')))) continue;
        if (HEX_ALLOWLIST_DIRS.some((d) => unixPath.includes(d.replace(/^src\//, '')))) continue;
        for (const match of readFileSync(file, 'utf8').match(HEX_LITERAL) ?? []) {
          offenders.push(`${unixPath}: ${match}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('actually finds the files it claims to guard', () => {
    // A typo'd path would make the assertion above vacuously pass.
    const files = GUARDED_DIRS.flatMap((d) => walk(d));
    // Product-wide now: a path typo would make the assertion above vacuous,
    // and so would a walk that silently stopped at the first directory.
    expect(files.length).toBeGreaterThan(200);
    expect(files.some((f) => f.includes('BoardSummaryPanel'))).toBe(true);
    const normalised = files.map((f) => f.split('\\').join('/'));
    expect(normalised.some((f) => f.includes('app/analytics'))).toBe(true);
  });
});
