/*
 * One tone recipe, four hues. Every accent theme gets the same chroma and the
 * same lightness steps, so lilac, cyan, mint and apricot read equally quiet;
 * only the hue changes. Values are solved against WCAG, not picked by eye.
 */
function hsl2rgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const lum = ([r, g, b]) => {
  const c = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const cr = (a, b) => { const x = lum(hsl2rgb(...a)), y = lum(hsl2rgb(...b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const chroma = (s, l) => s * (1 - Math.abs(2 * l / 100 - 1));
const sFor = (c, l) => +(c / (1 - Math.abs(2 * l / 100 - 1))).toFixed(1);
const f = (t) => `${t[0]} ${t[1]}% ${t[2]}%`;

const THEMES = {
  role_mentor:   { hue: 190, bgH: 232, bgS: 7,  bg: 96.6, cardS: 12, card: 99.4 },
  role_investor: { hue: 32,  bgH: 232, bgS: 7,  bg: 96.6, cardS: 12, card: 99.4 },
  role_org:      { hue: 262, bgH: 232, bgS: 7,  bg: 96.6, cardS: 12, card: 99.4 },
  light:    { hue: 250, bgH: 232, bgS: 7,  bg: 96.6, cardS: 12, card: 99.4 },
  alliance: { hue: 205, bgH: 205, bgS: 16, bg: 96.4, cardS: 24, card: 99.3 },
  minimal:  { hue: 158, bgH: 40,  bgS: 26, bg: 95.6, cardS: 32, card: 98.8 },
  apricot:  { hue: 24,  bgH: 30,  bgS: 12, bg: 96.6, cardS: 22, card: 99.3 },
};

const FILL_L = 74, FILL_C = 30;     // pastel fill: Cursor's chip, Windsurf's button
const INK_L = 14, INK_S = 34;       // label on the fill: dark ink of the same hue
const TEXT_C = 21;                  // link/emphasis text: the status band
const out = {};
for (const [name, t] of Object.entries(THEMES)) {
  const bg = [t.bgH, t.bgS, t.bg], card = [t.bgH, t.cardS, t.card];
  // Same perceived weight for every hue: solve the fill lightness for one
  // contrast against the card instead of one L (green at L74 read half as
  // heavy as lilac at L74, because luminance is not hue-blind).
  let fillL = 85, fill;
  for (; fillL > 55; fillL -= 0.25) { fill = [t.hue, sFor(FILL_C, fillL), +fillL.toFixed(2)]; if (cr(fill, card) >= 1.95) break; }
  const ink = [t.hue, INK_S, INK_L];
  // darkest-necessary text: highest L that clears 5.0 on card and 4.6 on page
  let textL = 50, text;
  for (; textL > 20; textL -= 0.5) { text = [t.hue, sFor(TEXT_C, textL), textL]; if (cr(text, card) >= 5.0 && cr(text, bg) >= 4.6) break; }
  // Mid tone: chroma 30, the lightest L where a white label still clears 4.6.
  let midL = 70, mid;
  for (; midL > 25; midL -= 0.25) { mid = [t.hue, sFor(30, midL), +midL.toFixed(2)]; if (cr([0,0,100], mid) >= 4.6) break; }
  const ring = text; // focus ring clears 3:1 by construction (it is the link tone)
  const tint = [t.hue, 34, 95.4], tintBorder = [t.hue, 10, 89.5];
  const border = [t.bgH, Math.max(5, t.bgS - 2), +(t.bg - 3).toFixed(1)];
  const input = [t.bgH, Math.max(5, t.bgS - 2), +(t.bg - 4.6).toFixed(1)];
  out[name] = { mid, fill, ink, text, ring, tint, tintBorder, border, input };
  console.log(`\n== ${name} (hue ${t.hue})`);
  console.log(`  --primary: ${f(mid)}   white on it ${cr([0,0,100],mid).toFixed(2)}, mid/10 tint vs card n/a`);
  console.log(`  --primary-soft: ${f(fill)}   chroma ${chroma(fill[1], fill[2]).toFixed(1)}`);
  console.log(`  --primary-soft-foreground: ${f(ink)}   ink on fill ${cr(ink, fill).toFixed(2)}`);
  console.log(`  --primary-accessible: ${f(text)}   on card ${cr(text, card).toFixed(2)}, on page ${cr(text, bg).toFixed(2)}, on tint ${cr(text, tint).toFixed(2)}`);
  console.log(`  --ring: ${f(ring)}   ring vs page ${cr(ring, bg).toFixed(2)}`);
  console.log(`  --border: ${f(border)}   on card ${cr(border, card).toFixed(2)}`);
  console.log(`  --input: ${f(input)}   on card ${cr(input, card).toFixed(2)}`);
  console.log(`  fill vs card ${cr(fill, card).toFixed(2)}   tint ${f(tint)} border ${f(tintBorder)}`);
}
require('fs').writeFileSync(__dirname + '/tone_solver.json', JSON.stringify(out, null, 1));
