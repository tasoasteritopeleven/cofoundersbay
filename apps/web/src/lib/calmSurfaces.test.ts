import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Emphasis is one flat wash and one whisper edge, never a gradient.
 *
 * A brand or status gradient on a card is two colours competing inside one
 * box, and a page with three "highlighted" gradient cards has no highlight at
 * all - the eye is asked to rank them on every visit. 30 of them across 24
 * files were flattened to `bg-primary/[0.03]` with `border-primary/15`; this
 * keeps a later edit from painting them back.
 *
 * Neutral gradients (background -> muted, image scrims) carry no hue and are
 * not matched. The exceptions below are listed with their reason.
 */
const DIRS = ['src/app', 'src/components'];

const HUED_GRADIENT =
  /bg-gradient-to-[a-z]+[^"'`]*\b(?:from|via|to)-(?:primary|accent|status-[a-z]+)(?:\/|\b)/;

const EXCEPTIONS: { file: string; reason: string }[] = [
  { file: 'app/LandingHome.tsx', reason: 'hero headline: brand gradient clipped to text (bg-clip-text), the one marketing flourish' },
  { file: 'app/themes/alliance/page.tsx', reason: 'a theme preview; its gradients are the thing being previewed' },
  { file: 'app/themes/alliance/loading.tsx', reason: 'skeleton of the theme preview' },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe('calm surfaces', () => {
  it('paints no brand or status gradient onto a surface', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(dir)) {
        const unix = file.split('\\').join('/');
        const exception = EXCEPTIONS.find((e) => unix.endsWith(e.file));
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          if (!HUED_GRADIENT.test(line)) return;
          if (exception && /bg-clip-text|themes\/alliance/.test(line + unix)) return;
          offenders.push(`${unix}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every exception justified', () => {
    for (const e of EXCEPTIONS) expect(e.reason.length).toBeGreaterThan(20);
  });
});
