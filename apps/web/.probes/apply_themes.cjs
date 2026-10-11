/* Applies the four-accent theme system to globals.css. Fails loudly on any
 * anchor that is not found, so a drifted file is never half-edited. */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'src', 'app', 'globals.css');
let css = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

function rep(from, to) {
  if (!css.includes(from)) throw new Error('anchor not found:\n' + from.slice(0, 160));
  css = css.replace(from, to);
}

// ── :root — lilac, on the shared tone recipe ─────────────────────────────
rep(`         --input        1.25-1.37 on its card, the one edge a control needs */`,
    `         --input        1.17-1.19 on its card — a field edge as quiet as a card's */`);
rep(`    /* Primary: a true lilac, not electric indigo. Hue 248 sits next to
       the page grey (232); sat 66% keeps it colourful without the 88%
       shout that was pulling the eye off the words. Contrast on white
       stays ≥5:1. */
    --primary:          248 39% 56%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 248 30% 50%;`,
`    /* One tone recipe, four hues (lilac here; cyan, mint and apricot in the
       named themes). Every accent theme carries chroma 30 and the same
       relative luminance as the reference buttons (0.49: Cursor #7bafe9,
       Windsurf #34e8bb, Windsurf #f09f6d), so no theme is louder than
       another — only the hue changes. Read from the reference pixels, then solved for contrast:
       .probes/sample_pixels.mjs, .probes/tone_solver2.cjs.

       --primary        the mid tone: tints (/5 /10), bars, rings, small solid
                        marks with a white label (4.6:1)
       --primary-soft   the filled button: a pastel with a dark ink label of
                        its own hue (9.6:1) — Cursor's "Upgrade" chip and
                        Windsurf's "Download" button, not a saturated block
                        with white text shouting from every page header
       --primary-accessible  link and emphasis text, >=5:1 on a card */
    --primary:          250 45.9% 59%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 250 40.7% 55%;
    --primary-soft:     250 74% 82.6%;
    --primary-soft-foreground: 250 30% 9.5%;`);
rep(`    /* Accent follows primary. A second hue (magenta, cyan) was pulling the
       eye off the words the way cursor.com never does. */
    --accent:           248 39% 56%;
    --accent-foreground: 0 0% 100%;`,
`    /* Accent is the hover surface (shadcn's meaning: every \`hover:bg-accent\`
       row, menu item and toolbar button). It followed primary, so hovering a
       list row painted it solid lilac — the loudest thing on the page for as
       long as the pointer rested there. A quiet step off the card instead,
       as on cursor.com and windsurf.com. */
    --accent:           232 10% 94.2%;
    --accent-foreground: 232 10% 21%;`);
rep(`    --border:           232 7% 93.6%;  /* ~1.12 on card — a hairline, not a frame */
    --input:            232 7% 90.5%;  /* ~1.22 on card — fields only */
    --ring:             248 39% 56%;`,
`    --border:           232 5% 93.6%;  /* 1.14 on card — a hairline, not a frame */
    /* Fields share the card's whisper (1.19, was 1.22-3.14 by theme). The
       field is found by its fill, label and placeholder; focus is the strong
       signal: a 2px --ring outline (globals "Shared keyboard indicator") and
       the edge taking --ring while typing. */
    --input:            232 5% 92%;
    --ring:             250 40.7% 55%; /* the link tone: 4.9:1 on the page */`);

// ── .dark — quiet hover surface, fainter field edge ─────────────────────
rep(`    --accent: 248 47% 76.6%;
    --accent-foreground: 248 32% 12%;
    --destructive: 4 23.5% 47%;`,
`    --accent: 232 14% 15.5%;           /* hover surface, not a lilac fill */
    --accent-foreground: 220 10% 93%;
    --destructive: 4 23.5% 47%;`);
rep(`    --input: 232 12% 16.8%;            /* ~1.22 on card */
    --ring: 248 47% 76.6%;`,
`    --input: 232 12% 15%;              /* ~1.16 on card */
    --ring: 248 47% 76.6%;`);

// ── system ──────────────────────────────────────────────────────────────
rep(`    --accent: 199 36% 40%;
    --accent-foreground: 0 0% 100%;`,
`    --accent: 215 20% 23.6%;           /* hover surface */
    --accent-foreground: 210 20% 98%;`);
rep(`    --input: 215 16% 25.8%;            /* ~1.22 on card */`,
    `    --input: 215 16% 24.4%;            /* ~1.16 on card */`);

// ── alliance → Cyan (Cursor) ────────────────────────────────────────────
rep(`  /* ── Alliance theme: warm cream & amber ──
     Amber primary uses dark foreground — white on amber fails WCAG AA (~2.2:1). */
  [data-theme="alliance"] {`,
`  /* ── "Cyan" (id: alliance) — Cursor's soft sky blue on a cool page.
     Neutral-cool surfaces; the accent lives in the accent-lock block below. ── */
  [data-theme="alliance"] {`);
rep(`    --primary: 34 40% 41%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 34 36% 34%;
    --secondary: 200 16% 93.6%;`,
`    --secondary: 200 16% 93.6%;`);
rep(`    --accent: 34 40% 41%;
    --accent-foreground: 0 0% 100%;
    --destructive: 2 30.5% 42.6%;`,
`    --accent: 210 10% 94%;             /* hover surface */
    --accent-foreground: 220 15% 10%;
    --destructive: 2 30.5% 42.6%;`);
rep(`    --background: 195 26% 96%;`, `    --background: 210 8% 96.4%;`);
rep(`    --card: 195 30% 99.2%;`, `    --card: 210 12% 99.4%;`);
rep(`    --secondary: 200 16% 93.6%;`, `    --secondary: 210 8% 94.6%;`);
rep(`    --muted: 190 22% 94%;`, `    --muted: 210 8% 94.2%;`);
rep(`    --border: 200 12% 93.4%;           /* ~1.12 on card */
    --input: 200 12% 90.4%;            /* ~1.22 on card */
    --ring: 34 40% 41%;`,
`    --border: 210 8% 93.4%;            /* ~1.13 on card */
    --input: 210 8% 91.8%;             /* ~1.18 on card */`);

// ── cofounder (dark) ────────────────────────────────────────────────────
rep(`    --accent: 258 28% 54%;
    --accent-foreground: 0 0% 100%;
    --destructive: 2 23% 48%;`,
`    --accent: 240 6% 11.6%;            /* hover surface */
    --accent-foreground: 0 0% 98%;
    --destructive: 2 23% 48%;`);
rep(`    --input: 240 6% 13.6%;             /* ~1.22 on card */`,
    `    --input: 240 6% 12.2%;             /* ~1.15 on card */`);

// ── minimal → Mint (Windsurf). Drop the first of two identical blocks. ──
const firstMinimal = css.indexOf('  /* ── "minimal" ────');
const secondMinimal = css.indexOf('  /* ── "minimal" ────', firstMinimal + 10);
if (firstMinimal < 0 || secondMinimal < 0) throw new Error('minimal blocks not found');
css = css.slice(0, firstMinimal) + css.slice(secondMinimal);
rep(`  /* ── "minimal" ────────────────────────────────────────────────────────────
     Light-first, near-monochrome on warm paper, one teal-ink accent.`,
`  /* ── "Mint" (id: minimal) ─────────────────────────────────────────────────
     Windsurf's cream page and soft mint, on the same tone recipe as the
     other accent themes. This block used to appear twice, verbatim; the
     first copy was dead (the second always won) and is gone.
     Light-first, near-monochrome on warm paper, one mint accent.`);
rep(`    --background:        40 14% 96.6%;
    --foreground:        30 8% 12%;
    --card:              40 20% 99.3%;`,
`    --background:        40 57.1% 91.8%; /* Windsurf page #f6eede */
    --foreground:        30 8% 11%;
    --card:              37 57.1% 94.5%; /* Windsurf card #f9f3e9 */`);
rep(`    --primary:           190 48% 26%;   /* white on it: 8.00 */
    --primary-foreground: 0 0% 100%;
    --primary-accessible:  190 48% 24%; /* link text — 8.82 on card */

    --secondary:         40 14% 94.2%;`,
`    --secondary:         40 38% 89.4%;`);
rep(`    --muted:             40 14% 93.8%;
    --muted-foreground:  30 6% 37%;     /* 5.61 on muted, 6.29 on card */

    --accent:            40 16% 93%;`,
`    --muted:             40 34% 88.8%;
    --muted-foreground:  30 8% 33%;

    --accent:            43 24.1% 82.9%;`);
rep(`    --border:            36 10% 91.8%;  /* 1.17 on card */
    --input:             36 10% 55%;    /* 3.14 on card — a visible field edge */
    --ring:              190 48% 32%;   /* 5.75 on page */`,
`    --border:            38 30% 87.6%;  /* ~1.15 on card */
    --input:             38 28% 86.2%;  /* ~1.19 on card — was 3.14, a drawn box */`);

// ── apricot (new) — inserted after the minimal block ────────────────────
const afterMinimal = css.indexOf('  .role-founder {');
if (afterMinimal < 0) throw new Error('role-founder not found');
css = css.slice(0, afterMinimal) + `  /* ── "Apricot" (id: apricot) — a soft orange on a warm neutral page, same
     tone recipe. Destructive leans rose (350) so a delete never reads as
     the brand. ── */
  [data-theme="apricot"] {
    --shadow-color: 24 30% 18%;
    --shadow-strength: 1;
    --background: 30 25% 95.5%;
    --foreground: 24 10% 12%;
    --card: 30 30% 98.4%;
    --card-foreground: 24 10% 13%;
    --popover: 0 0% 100%;
    --popover-foreground: 24 10% 13%;
    --secondary: 30 18% 93%;
    --secondary-foreground: 24 10% 17%;
    --muted: 30 18% 92.6%;
    --muted-foreground: 26 8% 38%;
    --accent: 30 22% 92.6%;            /* hover surface */
    --accent-foreground: 24 10% 12%;
    --destructive: 350 30% 42.6%;
    --destructive-foreground: 0 0% 100%;
    --destructive-accessible: 350 33% 38.8%;
    --border: 30 16% 92.6%;            /* ~1.13 on card */
    --input: 30 16% 91%;               /* ~1.18 on card */
    --gradient-hero: linear-gradient(hsl(24 14% 13%), hsl(24 14% 13%));
    color-scheme: light;
  }

` + css.slice(afterMinimal);

// ── role palettes (default light theme) on the recipe ───────────────────
const ROLE = {
  founder:  { p: '250 45.9% 59%', a: '250 40.7% 55%', s: '250 74% 82.6%', i: '250 30% 9.5%' },
  mentor:   { p: '190 45.9% 38%', a: '190 40.7% 36.5%', s: '190 74% 58.7%', i: '190 30% 9.5%' },
  investor: { p: '32 45.9% 41%', a: '32 40.7% 39.25%', s: '32 74% 67%', i: '32 30% 9.5%' },
  org:      { p: '262 45.9% 57.75%', a: '262 40.7% 54.5%', s: '262 74% 81.8%', i: '262 30% 9.5%' },
};
for (const [role, v] of Object.entries(ROLE)) {
  const re = new RegExp(`  \\.role-${role} \\{[^}]*\\}`);
  if (!re.test(css)) throw new Error('role block ' + role);
  css = css.replace(re, `  .role-${role} {
    --primary: ${v.p};
    --primary-foreground: 0 0% 100%;
    --primary-accessible: ${v.a};
    --primary-soft: ${v.s};
    --primary-soft-foreground: ${v.i};
    --accent: 232 10% 94.2%;
    --accent-foreground: 232 10% 21%;
    --ring: ${v.a};
  }`);
  const dre = new RegExp(`(  html\\.dark\\.role-${role} \\{[^}]*?)    --accent: [^;]+;\\n([^}]*?)    --accent-foreground: [^;]+;\\n`);
  if (!dre.test(css)) throw new Error('dark role block ' + role);
  css = css.replace(dre, `$1    --accent: 232 14% 15.5%;\n$2    --accent-foreground: 220 10% 93%;\n`);
}

// ── accent locks + dark soft fallback, right after the last role block ──
const anchor = css.indexOf('  /* ── Semantic status colors');
if (anchor < 0) throw new Error('status anchor');
css = css.slice(0, anchor) + `  /* ── Accent locks ──
     A chosen accent theme outranks the role palette: \`html[data-theme]\`
     (0,1,1) beats \`.role-*\` (0,1,0). Before this the role class quietly
     replaced every named theme's primary, so picking a theme changed the
     page and not the accent. The default light/dark themes keep the role
     hues. Values from .probes/tone_solver.cjs. */
  html[data-theme="alliance"] {
    --primary: 212 44.3% 48.25%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 212 39.3% 45.5%;
    --primary-soft: 212 71.4% 69.8%;           /* Cursor "Upgrade" #7bafe9 */
    --primary-soft-foreground: 0 0% 9.4%;      /* its label, #181818 */
    --accent: 210 10% 94%;
    --accent-foreground: 220 15% 10%;
    --ring: 212 39.3% 45.5%;
  }
  html[data-theme="minimal"] {
    --primary: 165 49.4% 34.25%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 165 43.8% 31.5%;
    --primary-soft: 165 79.6% 55.7%;           /* Windsurf "Download" #34e8bb */
    --primary-soft-foreground: 168 18.5% 5.3%; /* its label, #0b100f */
    --accent: 43 24.1% 82.9%;                  /* Windsurf active nav #ded8c9 */
    --accent-foreground: 30 8% 11%;
    --ring: 165 43.8% 31.5%;
  }
  html[data-theme="apricot"] {
    --primary: 23 50.5% 44%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 23 44.8% 41.5%;
    --primary-soft: 23 81.4% 68.4%;            /* Windsurf quota bar #f09f6d */
    --primary-soft-foreground: 20 30% 9%;
    --accent: 30 22% 92.6%;
    --accent-foreground: 24 10% 12%;
    --ring: 23 44.8% 41.5%;
  }
  /* Dark surfaces already fill with a pastel and a dark label, so the soft
     fill is the primary itself there. */
  html.dark,
  html[data-theme="cofounder"],
  html[data-theme="system"] {
    --primary-soft: var(--primary);
    --primary-soft-foreground: var(--primary-foreground);
  }

` + css.slice(anchor);

// ── status tones: shared light block → root values, then per-theme ──────
const STATUS = fs.readFileSync(path.join(__dirname, 'status_solver.css'), 'utf8');
const blocks = {};
let cur = null;
for (const line of STATUS.split('\n')) {
  const m = line.match(/^\/\* (\w+) \*\//);
  if (m) { cur = m[1]; blocks[cur] = []; continue; }
  if (cur && line.trim()) blocks[cur].push(line);
}
const statusStart = css.indexOf('    --status-success-fg:     145 35% 30%;');
const statusEnd = css.indexOf('    --status-neutral-border: 232 4.5% 90%;');
if (statusStart < 0 || statusEnd < 0) throw new Error('light status block');
const lineEnd = css.indexOf('\n', statusEnd) + 1;
css = css.slice(0, statusStart) + blocks.root.join('\n') + '\n' + css.slice(lineEnd);

const darkStatus = css.indexOf('  .dark,\n  [data-theme="cofounder"],\n  [data-theme="system"] {');
if (darkStatus < 0) throw new Error('dark status anchor');
css = css.slice(0, darkStatus) + `  /* Each accent theme moves the one status hue that would collide with its
     own accent (mint pushes success to leaf green, apricot pushes warning
     to ochre and danger to rose, cyan pushes info to blue) and tints
     \`status-accent\` with its own hue. Same band: fg chroma 21, >=5:1 on
     its tint and on the card (.probes/status_solver.cjs). */
  html[data-theme="alliance"] {
${blocks.alliance.join('\n')}
  }
  html[data-theme="minimal"] {
${blocks.minimal.join('\n')}
  }
  html[data-theme="apricot"] {
${blocks.apricot.join('\n')}
  }

` + css.slice(darkStatus);

rep(`  .text-primary-foreground .bilingual-secondary,
  .text-primary-foreground .bilingual-separator,`, `  .text-primary-foreground .bilingual-secondary,
  .text-primary-foreground .bilingual-separator,
  .text-primary-soft-foreground .bilingual-secondary,
  .text-primary-soft-foreground .bilingual-separator,`);
rep(`  .text-primary-foreground .text-muted-foreground,
  .text-secondary-foreground .text-muted-foreground,`, `  .text-primary-foreground .text-muted-foreground,
  .text-primary-soft-foreground .text-muted-foreground,
  .text-secondary-foreground .text-muted-foreground,`);
rep(`button.bg-primary,
button.bg-destructive,
[data-slot="button"].bg-primary,`, `button.bg-primary,
button.bg-primary-soft,
button.bg-destructive,
[data-slot="button"].bg-primary,
[data-slot="button"].bg-primary-soft,
a[class~="inline-flex"].bg-primary-soft,`);
rep(`@apply border-input hover:border-foreground/20;`, `@apply border-input hover:border-foreground/15;`);
css += `
/* ── Fields: a whisper at rest, the accent while typing ──────────────────
   --input sits at the card's own hairline (~1.18), so a field at rest is
   found by its fill, label and placeholder, as on windsurf.com. While it has
   focus the edge takes the theme's link tone (>=4.6:1 on the page), on top
   of the 2px keyboard outline, so the field being typed into is never in
   doubt. Pointer focus gets the edge alone: no frame inside a frame. */
input[class~="border-input"]:focus,
textarea[class~="border-input"]:focus,
[role="combobox"][class~="border-input"]:focus,
[role="combobox"][class~="border-input"][data-state="open"] {
  border-color: hsl(var(--ring));
}
`;
// ── One accent everywhere ───────────────────────────────────────────────
// The lively tone is --primary itself, so every solid accent (pills, rings,
// avatars, badges, charts, buttons) shows the same colour. The deeper tone
// survives as --primary-mid, used only for faint tints (Tailwind maps /5../40
// to it) so a 10% wash of a pastel does not vanish into the card.
let swapped = 0;
css = css.replace(
  /(\s*)--primary:\s+([^;]+);\n\s*--primary-foreground:\s+0 0% 100%;\n\s*--primary-accessible:\s+([^;]+);\n\s*--primary-soft:\s+([^;]+);([^\n]*)\n\s*--primary-soft-foreground:\s+([^;]+);([^\n]*)/g,
  (_, ws, mid, text, fill, fillNote, ink, inkNote) => {
    swapped++;
    const i = ws.replace(/^\n/, '');
    return `${ws}--primary: ${fill};${fillNote}\n${i}--primary-foreground: ${ink};${inkNote}\n${i}--primary-mid: ${mid};${' '.repeat(Math.max(1, 26 - mid.length))}/* tints only (/5../40) */\n${i}--primary-accessible: ${text};`;
  },
);
if (swapped < 8) throw new Error('primary groups swapped: ' + swapped);
rep(`  html.dark,
  html[data-theme="cofounder"],
  html[data-theme="system"] {
    --primary-soft: var(--primary);
    --primary-soft-foreground: var(--primary-foreground);
  }`, `  html.dark,
  html[data-theme="cofounder"],
  html[data-theme="system"] {
    --primary-mid: var(--primary);
  }`);
rep(`  /* Dark surfaces already fill with a pastel and a dark label, so the soft
     fill is the primary itself there. */`, `  /* Dark surfaces already fill with a pastel and a dark label; their tints
     come from that same tone. */`);
rep(`       --primary        the mid tone: tints (/5 /10), bars, rings, small solid
                        marks with a white label (4.6:1)
       --primary-soft   the filled button: a pastel with a dark ink label of
                        its own hue (9.6:1) — Cursor's "Upgrade" chip and
                        Windsurf's "Download" button, not a saturated block
                        with white text shouting from every page header
       --primary-accessible  link and emphasis text, >=5:1 on a card */`,
`       --primary        the accent wherever it is solid: buttons, active pills,
                        rings, bars, avatars, badges, chart series. A lively
                        fill with a near-black ink label of its own hue
                        (--primary-foreground, 9.6:1) - Cursor's "Upgrade",
                        Windsurf's "Download"
       --primary-mid    the deeper tone, only for faint tints (/5../40), which
                        a pastel cannot carry
       --primary-accessible  link and emphasis text, >=5:1 on a card
       --ink            the label on any lively status mark */`);
css = css.split('\n').filter((l) => !/primary-soft/.test(l)).join('\n');
css = css.replace(/hsl\(var\(--primary\) \//g, 'hsl(var(--primary-mid) /');
rep(`    --primary-accessible: 250 40.7% 55%;\n`, `    --primary-accessible: 250 40.7% 55%;\n    --ink:              232 20% 10%;\n`);
rep(`  .dark,
  [data-theme="cofounder"],
  [data-theme="system"] {
`, `  .dark,
  [data-theme="cofounder"],
  [data-theme="system"] {
    /* Dark text tones are already light pastels; they are the marks too. */
    --status-success-mark: var(--status-success-fg);
    --status-warning-mark: var(--status-warning-fg);
    --status-danger-mark:  var(--status-danger-fg);
    --status-info-mark:    var(--status-info-fg);
    --status-accent-mark:  var(--status-accent-fg);
    --status-neutral-mark: var(--status-neutral-fg);
`);

fs.writeFileSync(FILE, css);
console.log('ok');
