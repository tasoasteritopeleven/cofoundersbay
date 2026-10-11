const fs = require('fs');
const FILE = __dirname + '/apply_themes.cjs';
let s = fs.readFileSync(FILE, 'utf8');
const R = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 90)); s = s.split(a).join(b); };

// lilac (:root + founder), at the reference buttons' luminance
R(`    --primary:          250 34.7% 56.75%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 250 21% 50%;
    --primary-soft:     250 89.6% 83.25%;
    --primary-soft-foreground: 250 34% 14%;`,
`    --primary:          250 45.9% 59%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 250 40.7% 55%;
    --primary-soft:     250 74% 82.6%;
    --primary-soft-foreground: 250 30% 9.5%;`);
R(`    --ring:             250 21% 50%;   /* the link tone: 4.9:1 on the page */`,
  `    --ring:             250 40.7% 55%; /* the link tone: 4.9:1 on the page */`);
R(`perceived weight against its card (1.95:1)`,
  `relative luminance as the reference buttons (0.49: Cursor #7bafe9,
       Windsurf #34e8bb, Windsurf #f09f6d)`);
R(`Solved, not picked: .probes/tone_solver.cjs.`,
  `Read from the reference pixels, then solved for contrast:
       .probes/sample_pixels.mjs, .probes/tone_solver2.cjs.`);
R(`its own hue (8.7:1)`, `its own hue (9.6:1)`);
R(`founder:  { p: '250 34.7% 56.75%', a: '250 21% 50%',     s: '250 89.6% 83.25%', i: '250 34% 14%' },`,
  `founder:  { p: '250 45.9% 59%', a: '250 40.7% 55%', s: '250 74% 82.6%', i: '250 30% 9.5%' },`);
R(`mentor:   { p: '190 38.2% 39.25%', a: '190 26.9% 39%',   s: '190 44.4% 66.25%', i: '190 34% 14%' },`,
  `mentor:   { p: '190 45.9% 38%', a: '190 40.7% 36.5%', s: '190 74% 58.7%', i: '190 30% 9.5%' },`);
R(`investor: { p: '32 35.5% 42.25%',  a: '32 25.9% 40.5%',  s: '32 48% 68.75%',    i: '32 34% 14%' },`,
  `investor: { p: '32 45.9% 41%', a: '32 40.7% 39.25%', s: '32 74% 67%', i: '32 30% 9.5%' },`);
R(`org:      { p: '262 33.5% 55.25%', a: '262 21% 50%',     s: '262 83.3% 82%',    i: '262 34% 14%' },`,
  `org:      { p: '262 45.9% 57.75%', a: '262 40.7% 54.5%', s: '262 74% 81.8%', i: '262 30% 9.5%' },`);

// accent locks: the exact reference fills and their inks
R(`    --primary: 205 33.1% 45.25%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 205 24.7% 42.5%;
    --primary-soft: 205 53.1% 71.75%;
    --primary-soft-foreground: 205 34% 14%;
    --accent: 200 16% 93.4%;
    --accent-foreground: 220 30% 10%;
    --ring: 205 24.7% 42.5%;`,
`    --primary: 212 44.3% 48.25%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 212 39.3% 45.5%;
    --primary-soft: 212 71.4% 69.8%;           /* Cursor "Upgrade" #7bafe9 */
    --primary-soft-foreground: 0 0% 9.4%;      /* its label, #181818 */
    --accent: 210 10% 94%;
    --accent-foreground: 220 15% 10%;
    --ring: 212 39.3% 45.5%;`);
R(`    --primary: 158 41.7% 36%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 158 28.8% 36.5%;
    --primary-soft: 158 40.3% 62.75%;
    --primary-soft-foreground: 158 34% 14%;
    --accent: 42 22% 91.8%;
    --accent-foreground: 30 8% 12%;
    --ring: 158 28.8% 36.5%;`,
`    --primary: 165 49.4% 34.25%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 165 43.8% 31.5%;
    --primary-soft: 165 79.6% 55.7%;           /* Windsurf "Download" #34e8bb */
    --primary-soft-foreground: 168 18.5% 5.3%; /* its label, #0b100f */
    --accent: 43 24.1% 82.9%;                  /* Windsurf active nav #ded8c9 */
    --accent-foreground: 30 8% 11%;
    --ring: 165 43.8% 31.5%;`);
R(`    --primary: 24 33.5% 44.75%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 24 24.7% 42.5%;
    --primary-soft: 24 52.6% 71.5%;
    --primary-soft-foreground: 24 34% 14%;
    --accent: 30 14% 93%;
    --accent-foreground: 24 10% 13%;
    --ring: 24 24.7% 42.5%;`,
`    --primary: 23 50.5% 44%;
    --primary-foreground: 0 0% 100%;
    --primary-accessible: 23 44.8% 41.5%;
    --primary-soft: 23 81.4% 68.4%;            /* Windsurf quota bar #f09f6d */
    --primary-soft-foreground: 20 30% 9%;
    --accent: 30 22% 92.6%;
    --accent-foreground: 24 10% 12%;
    --ring: 23 44.8% 41.5%;`);

// cyan: Cursor's neutral-cool surfaces (the tokens after the anchor override earlier ones in the block)
R(`     Accent tokens are in the accent-lock block below the role palettes. ── */
  [data-theme="alliance"] {`,
`     Neutral-cool surfaces; the accent lives in the accent-lock block below. ── */
  [data-theme="alliance"] {`);
R(`rep(\`    --accent: 34 40% 41%;
    --accent-foreground: 0 0% 100%;
    --destructive: 2 30.5% 42.6%;\`,
\`    --accent: 200 16% 93.4%;           /* hover surface */
    --accent-foreground: 220 30% 10%;
    --destructive: 2 30.5% 42.6%;\`);`,
`rep(\`    --accent: 34 40% 41%;
    --accent-foreground: 0 0% 100%;
    --destructive: 2 30.5% 42.6%;\`,
\`    --accent: 210 10% 94%;             /* hover surface */
    --accent-foreground: 220 15% 10%;
    --destructive: 2 30.5% 42.6%;\`);
rep(\`    --background: 195 26% 96%;\`, \`    --background: 210 8% 96.4%;\`);
rep(\`    --card: 195 30% 99.2%;\`, \`    --card: 210 12% 99.4%;\`);
rep(\`    --secondary: 200 16% 93.6%;\`, \`    --secondary: 210 8% 94.6%;\`);
rep(\`    --muted: 190 22% 94%;\`, \`    --muted: 210 8% 94.2%;\`);`);
R(`\`    --border: 200 12% 93.4%;           /* ~1.13 on card */
    --input: 200 12% 92%;              /* ~1.18 on card */\``,
`\`    --border: 210 8% 93.4%;            /* ~1.13 on card */
    --input: 210 8% 91.8%;             /* ~1.18 on card */\``);

// mint: Windsurf cream, exact
R(`    --background:        42 28% 95.4%;  /* Windsurf cream, one step quieter */
    --foreground:        30 8% 12%;
    --card:              42 40% 98.8%;`,
`    --background:        40 57.1% 91.8%; /* Windsurf page #f6eede */
    --foreground:        30 8% 11%;
    --card:              37 57.1% 94.5%; /* Windsurf card #f9f3e9 */`);
R(`    --secondary:         42 20% 92.8%;`, `    --secondary:         40 38% 89.4%;`);
R(`    --muted:             42 20% 92.4%;
    --muted-foreground:  30 6% 37%;

    --accent:            42 22% 91.8%;`,
`    --muted:             40 34% 88.8%;
    --muted-foreground:  30 8% 33%;

    --accent:            43 24.1% 82.9%;`);
R(`    --border:            40 18% 90.6%;  /* ~1.15 on card */
    --input:             40 18% 89.4%;  /* ~1.19 on card — was 3.14, a drawn box */`,
`    --border:            38 30% 87.6%;  /* ~1.15 on card */
    --input:             38 28% 86.2%;  /* ~1.19 on card — was 3.14, a drawn box */`);

// apricot surfaces
R(`    --background: 30 12% 96.6%;
    --foreground: 24 10% 13%;
    --card: 30 22% 99.3%;`,
`    --background: 30 25% 95.5%;
    --foreground: 24 10% 12%;
    --card: 30 30% 98.4%;`);
R(`    --secondary: 30 10% 94.4%;
    --secondary-foreground: 24 10% 18%;
    --muted: 30 10% 94%;
    --muted-foreground: 26 6% 40%;
    --accent: 30 14% 93%;              /* hover surface */
    --accent-foreground: 24 10% 13%;`,
`    --secondary: 30 18% 93%;
    --secondary-foreground: 24 10% 17%;
    --muted: 30 18% 92.6%;
    --muted-foreground: 26 8% 38%;
    --accent: 30 22% 92.6%;            /* hover surface */
    --accent-foreground: 24 10% 12%;`);
R(`    --border: 30 10% 93.6%;            /* ~1.13 on card */
    --input: 30 10% 92%;               /* ~1.18 on card */`,
`    --border: 30 16% 92.6%;            /* ~1.13 on card */
    --input: 30 16% 91%;               /* ~1.18 on card */`);

// extras that were hand-applied, folded in so one run reproduces everything
R(`fs.writeFileSync(FILE, css);
console.log('ok');`,
`rep(\`  .text-primary-foreground .bilingual-secondary,
  .text-primary-foreground .bilingual-separator,\`, \`  .text-primary-foreground .bilingual-secondary,
  .text-primary-foreground .bilingual-separator,
  .text-primary-soft-foreground .bilingual-secondary,
  .text-primary-soft-foreground .bilingual-separator,\`);
rep(\`  .text-primary-foreground .text-muted-foreground,
  .text-secondary-foreground .text-muted-foreground,\`, \`  .text-primary-foreground .text-muted-foreground,
  .text-primary-soft-foreground .text-muted-foreground,
  .text-secondary-foreground .text-muted-foreground,\`);
rep(\`button.bg-primary,
button.bg-destructive,
[data-slot="button"].bg-primary,\`, \`button.bg-primary,
button.bg-primary-soft,
button.bg-destructive,
[data-slot="button"].bg-primary,
[data-slot="button"].bg-primary-soft,
a[class~="inline-flex"].bg-primary-soft,\`);
rep(\`@apply border-input hover:border-foreground/20;\`, \`@apply border-input hover:border-foreground/12;\`);
css += \`
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
\`;
fs.writeFileSync(FILE, css);
console.log('ok');`);

fs.writeFileSync(FILE, s);
console.log('patched');
