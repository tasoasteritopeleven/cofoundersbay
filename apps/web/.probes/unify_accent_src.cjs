/*
 * Source side of "one accent everywhere".
 *  1. Status text tones used as graphics (ring strokes, chart series, bar
 *     fills, dots) -> the lively --status-*-mark tone.
 *  2. Solid `bg-status-X` fills -> `bg-status-X-mark`, and a white label on
 *     one -> the dark ink (white on a lively mark is ~2:1).
 *  3. Solid `text-primary` used as *text* -> `text-primary-accessible`
 *     (the lively tone is a fill, not a text colour). Graphics keep it.
 * Prints every file it touched.
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const walk = (d) => fs.readdirSync(d).flatMap((n) => { const f = path.join(d, n); return fs.statSync(f).isDirectory() ? walk(f) : /\.(tsx|ts)$/.test(n) && !/\.test\./.test(n) ? [f] : []; });

const touched = {};
const note = (f, k) => { const r = path.relative(SRC, f); touched[r] = touched[r] || new Set(); touched[r].add(k); };

for (const file of walk(SRC)) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  // 1. graphics coloured with a status text tone
  s = s.replace(/hsl\(var\(--status-(success|warning|danger|info|accent|neutral)-fg\)\)/g, (m, t) => { note(file, 'status-fg->mark'); return `hsl(var(--status-${t}-mark))`; });

  // 2. solid status fills, line by line so the label swap stays local
  s = s.split('\n').map((line) => {
    if (!/\bbg-status-(success|warning|danger|info|accent|neutral)(?![-\w/])/.test(line)) return line;
    note(file, 'bg-status->mark');
    let l = line.replace(/\b((?:hover:|group-hover:)?)bg-status-(success|warning|danger|info|accent|neutral)(?![-\w/])/g, '$1bg-status-$2-mark');
    l = l.replace(/\btext-white(?![-\w])/g, 'text-ink');
    return l;
  }).join('\n');

  // 3. solid text-primary on text elements (not svg strokes / rings)
  s = s.split('\n').map((line) => {
    if (!/\btext-primary(?![-\w/])/.test(line)) return line;
    if (/transition-\[stroke|<circle|<path|stroke=|Loader2|animate-spin/.test(line)) return line;
    note(file, 'text-primary->accessible');
    return line.replace(/\b((?:hover:|group-hover:)?)text-primary(?![-\w/])/g, '$1text-primary-accessible');
  }).join('\n');

  if (s !== before) fs.writeFileSync(file, s);
}
for (const [f, ks] of Object.entries(touched)) console.log(f.padEnd(62), [...ks].join(', '));
console.log(Object.keys(touched).length, 'files');
