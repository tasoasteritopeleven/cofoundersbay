/*
 * Status tones per accent theme. Same band for all (fg chroma 21, tint chroma
 * ~1, a faint edge), hues picked so no status tone sits within ~25 degrees of
 * the theme's own accent - otherwise a "warning" chip in the apricot theme
 * reads as a brand chip. Each fg is the lightest L that clears 5.0 on its own
 * tint and on the theme's card.
 */
function hsl2rgb(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)]; }
const lum = ([r, g, b]) => { const c = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
const cr = (a, b) => { const x = lum(hsl2rgb(...a)), y = lum(hsl2rgb(...b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sFor = (c, l) => +(c / (1 - Math.abs(2 * l / 100 - 1))).toFixed(1);
const f = (t) => `${t[0]} ${t[1]}% ${t[2]}%`;

const THEMES = {
  root:     { card: [232, 12, 99.4],   tintL: 95.6, hues: { success: 158, warning: 36, danger: 4, info: 212, accent: 250 }, neutral: 232 },
  alliance: { card: [210, 12, 99.4],   tintL: 95.6, hues: { success: 158, warning: 36, danger: 4, info: 232, accent: 212 }, neutral: 210 },
  minimal:  { card: [37, 57.1, 94.5],  tintL: 90.6, hues: { success: 135, warning: 36, danger: 4, info: 212, accent: 165 }, neutral: 38 },
  apricot:  { card: [30, 30, 98.4],    tintL: 94.6, hues: { success: 158, warning: 46, danger: 350, info: 212, accent: 23 }, neutral: 30 },
};

let css = '';
for (const [name, t] of Object.entries(THEMES)) {
  css += `\n/* ${name} */\n`;
  for (const [tone, h] of Object.entries(t.hues)) {
    const bg = [h, sFor(name === "minimal" ? 3.2 : 1.0, t.tintL), t.tintL];
    const border = [h, 6, +(t.tintL - 5).toFixed(1)];
    let L = 50, fg;
    for (; L > 20; L -= 0.25) { fg = [h, sFor(21, L), +L.toFixed(2)]; if (cr(fg, bg) >= 5.0 && cr(fg, t.card) >= 5.0) break; }
    css += `    --status-${tone}-fg:${' '.repeat(Math.max(1, 8 - tone.length))}${f(fg)};   /* ${cr(fg, bg).toFixed(2)} on tint, ${cr(fg, t.card).toFixed(2)} on card */\n`;
    css += `    --status-${tone}-bg:${' '.repeat(Math.max(1, 8 - tone.length))}${f(bg)};\n`;
    css += `    --status-${tone}-border:${' '.repeat(Math.max(1, 4 - tone.length))}${f(border)};\n`;
    // The mark: rings, bars, dots, chart series. Lively like the accent
    // (S 62), at relative luminance 0.36 - a step under the accent's 0.49,
    // so the theme colour stays the brightest thing on the page.
    let mark; for (let ml = 30; ml < 90; ml += 0.25) { mark = [h, 62, +ml.toFixed(2)]; if (lum(hsl2rgb(...mark)) >= 0.36) break; }
    css += `    --status-${tone}-mark:${' '.repeat(Math.max(1, 6 - tone.length))}${f(mark)};   /* ${cr(mark, t.card).toFixed(2)} on card, ink ${cr([232, 20, 10], mark).toFixed(2)} */\n`;
  }
  const n = t.neutral;
  // The neutral chip sits on the same tint step as the other tones, so on a
  // cream card it is darker than the card, not a white patch on it.
  css += `    --status-neutral-fg:     ${n} 6% 40%;\n    --status-neutral-bg:     ${n} 6% ${(t.tintL - 0.6).toFixed(1)}%;\n    --status-neutral-border: ${n} 4.5% ${(t.tintL - 4.6).toFixed(1)}%;\n    --status-neutral-mark:   ${n} 8% 66%;\n`;
}
console.log(css);
require('fs').writeFileSync(__dirname + '/status_solver.css', css);
