/*
 * Reads the real pixel colours out of the reference screenshots (Windsurf
 * usage page, Cursor spending page). For each region it reports the most
 * common colour and the most saturated one, so a picker landing on text
 * inside a button cannot mislead us.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(new URL('../package.json', import.meta.url))('@playwright/test');

const DIR = 'C:/Users/anast/AppData/Local/Temp/devin-pasted-images/';
const SHOTS = {
  windsurf: DIR + '1790978348644815500-18868-0-pasted.png',
  cursor: DIR + '1790976938095276600-14088-1-pasted.png',
  windsurfKeys: DIR + '1790976938093093200-14088-0-pasted.png',
};
// Regions in image pixels [x, y, w, h], from the screenshots' 1024-wide layout.
const REGIONS = {
  windsurf: {
    page_bg: [100, 450, 60, 40],
    card_bg: [560, 150, 200, 20],
    card_border: [308, 140, 536, 3],
    download_btn: [945, 25, 75, 40],
    purchase_btn: [750, 317, 74, 18],
    enable_btn: [786, 379, 38, 18],
    bar_orange: [330, 233, 360, 5],
    bar_mint: [330, 279, 170, 5],
    bar_track: [710, 233, 110, 5],
    nav_active: [178, 204, 104, 16],
    text_body: [326, 208, 110, 12],
    text_muted: [326, 222, 230, 7],
  },
  cursor: {
    page_bg: [200, 380, 60, 60],
    sidebar_bg: [20, 300, 100, 60],
    card_bg: [320, 120, 200, 20],
    upgrade_card: [600, 82, 260, 10],
    upgrade_btn: [600, 126, 32, 12],
    bar_blue: [310, 276, 540, 4],
    bar_grey: [310, 323, 540, 4],
    nav_active: [12, 227, 130, 10],
  },
};

function analyse(pixels) {
  const counts = new Map();
  let sat = null;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx - mn;
    if (!sat || s > sat.s) sat = { s, rgb: [r, g, b] };
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  return { mode: top, vivid: sat.rgb };
}
function hex([r, g, b]) { return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''); }
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [shot, regions] of Object.entries(REGIONS)) {
  const b64 = readFileSync(SHOTS[shot]).toString('base64');
  const result = await page.evaluate(async ({ b64, regions }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const out = { size: [img.width, img.height] };
    for (const [name, [x, y, w, h]] of Object.entries(regions)) {
      out[name] = Array.from(ctx.getImageData(x, y, w, h).data);
    }
    return out;
  }, { b64, regions });
  console.log(`\n=== ${shot} (${result.size.join('x')})`);
  for (const name of Object.keys(regions)) {
    const a = analyse(result[name]);
    console.log(`${name.padEnd(14)} mode ${hex(a.mode)}  hsl(${hsl(a.mode)})   vivid ${hex(a.vivid)}  hsl(${hsl(a.vivid)})`);
  }
}
await browser.close();
