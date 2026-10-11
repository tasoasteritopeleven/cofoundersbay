/*
 * The four light accents, from the reference pixels (sample_pixels.mjs):
 *   Cursor "Upgrade" button  #7bafe9  hsl(212 71% 70%)  ink #181818
 *   Windsurf "Download"      #34e8bb  hsl(165 80% 56%)  ink #0b100f
 *   Windsurf quota bar       #f09f6d  hsl(23 81% 68%)
 * Lilac is solved to sit at the same relative luminance as those three, so it
 * is "the same mild tone" in the one sense the eye measures.
 */
function hsl2rgb(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)]; }
const lum = ([r, g, b]) => { const c = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
const L = (t) => lum(hsl2rgb(...t));
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const f = (t) => `${t[0]} ${t[1]}% ${t[2]}%`;

const cursor = [212, 71.4, 69.8], mint = [165, 79.6, 55.7], orange = [23, 81.4, 68.4];
const target = (L(cursor) + L(mint) + L(orange)) / 3;
let lilac;
for (let l = 60; l < 90; l += 0.1) { lilac = [250, 74, +l.toFixed(1)]; if (L(lilac) >= target) break; }

const THEMES = {
  light:    { fill: lilac,  ink: [250, 30, 9.5],  card: [232, 12, 99.4], bg: [232, 7, 96.6] },
  alliance: { fill: cursor, ink: [0, 0, 9.4],     card: [210, 12, 99.4], bg: [210, 8, 96.4] },
  minimal:  { fill: mint,   ink: [168, 18.5, 5.3], card: [37, 57.1, 94.5], bg: [40, 57.1, 91.8] },
  apricot:  { fill: orange, ink: [20, 30, 9],     card: [30, 30, 98.4], bg: [30, 25, 95.5] },
};
console.log('target luminance', target.toFixed(3), 'lilac', f(lilac));
const out = {};
for (const [name, t] of Object.entries(THEMES)) {
  const h = t.fill[0];
  // mid tone: same hue, the lightest L where a white label clears 4.6
  let mid; for (let l = 70; l > 20; l -= 0.25) { mid = [h, Math.min(60, t.fill[1] * 0.62).toFixed(1) * 1, +l.toFixed(2)]; if (cr([0, 0, 100], mid) >= 4.6) break; }
  // link/emphasis text: lightest L clearing 5.0 on the card and 4.6 on the page
  let text; for (let l = 55; l > 15; l -= 0.25) { text = [h, Math.min(48, t.fill[1] * 0.55).toFixed(1) * 1, +l.toFixed(2)]; if (cr(text, t.card) >= 5.0 && cr(text, t.bg) >= 4.6) break; }
  out[name] = { fill: t.fill, ink: t.ink, mid, text };
  console.log(`\n== ${name}`);
  console.log(`  --primary-soft: ${f(t.fill)}            fill vs card ${cr(t.fill, t.card).toFixed(2)}`);
  console.log(`  --primary-soft-foreground: ${f(t.ink)}   ink on fill ${cr(t.ink, t.fill).toFixed(2)}`);
  console.log(`  --primary: ${f(mid)}                 white on it ${cr([0, 0, 100], mid).toFixed(2)}`);
  console.log(`  --primary-accessible: ${f(text)}      on card ${cr(text, t.card).toFixed(2)}, on page ${cr(text, t.bg).toFixed(2)}`);
}
require('fs').writeFileSync(__dirname + '/tone_solver2.json', JSON.stringify(out, null, 1));
